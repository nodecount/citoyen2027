import type { CandidatMeta, Proposition } from "../types";
import { budgetActuel } from "./appel";
import { BudgetDepasse, estimerAppelUsd, type Tarifs } from "./budget";
import type { FetchImpl } from "./checks";
import { construireCorpus, type Corpus } from "./corpus";
import {
  chargerAVerifier,
  chargerJournal,
  chargerPropositions,
  combinaisonDejaCherchee,
  combinaisonDejaCouverte,
  enregistrerAVerifier,
  enregistrerJournal,
  enregistrerPropositions,
  type EntreeAVerifier,
} from "./depot";
import { chargerDocument, type TexteDocument, type TextePdf } from "./documents";
import { MAX_TOKENS_EXTRACTION, assemblerProposition, extraireMesures, type MesureModele } from "./extraction";
import type { ClientAnthropicMinimal } from "./generate";
import { genererIdProposition } from "./ids";
import type { PropositionGeneree } from "./schema";
import { verifierMesuresParPassages, type MesureAVerifier } from "./verification-extraction";

// Orchestration du mode « corpus » : lire une fois (documents → texte), interroger une fois par thème.

export interface ThemeExtraction {
  id: string;
  libelle: string;
  description: string;
}

export interface OptionsCorpus {
  racine?: string;
  fetchImpl?: FetchImpl;
  dossierCache?: string;
  actualiser?: boolean;
  force?: boolean;
  extracteurPdf?: (octets: Buffer) => Promise<TextePdf>;
  // Injecté par run.ts (évite une dépendance circulaire) : produit le texte de synthèse d'un thème.
  synthese?: (client: ClientAnthropicMinimal, meta: CandidatMeta, themeId: string, themeLibelle: string, options: { racine?: string; force?: boolean }) => Promise<unknown>;
}

export interface CorpusCharge {
  corpus: Corpus;
  echecs: Array<{ cible: string; code: string }>;
}

export async function chargerCorpus(meta: CandidatMeta, options: OptionsCorpus = {}): Promise<CorpusCharge> {
  const declares = meta.documents ?? [];
  if (declares.length === 0) {
    throw new Error(`Aucun document déclaré dans meta.json pour ${meta.nom} (champ « documents ») : rien à lire`);
  }
  const charges: TexteDocument[] = [];
  const echecs: Array<{ cible: string; code: string }> = [];
  // Séquentiel : on ne martèle pas un site officiel.
  for (const doc of declares) {
    try {
      charges.push(
        await chargerDocument(doc, {
          fetchImpl: options.fetchImpl,
          dossierCache: options.dossierCache,
          actualiser: options.actualiser,
          extracteurPdf: options.extracteurPdf,
        }),
      );
    } catch (erreur) {
      echecs.push({ cible: doc.url, code: erreur instanceof Error ? erreur.message : String(erreur) });
    }
  }
  if (charges.length === 0) {
    throw new Error(`Aucun document lisible pour ${meta.nom} : ${echecs.map((e) => e.code).join(" ; ")}`);
  }
  return { corpus: construireCorpus(charges), echecs };
}

// ---- Plan et estimation de coût (avant tout appel) ----------------------------------------------------------

// Hypothèses de sortie « typique » pour l'estimation ATTENDUE (le pire cas utilise les maxima). Le plafond dur, lui,
// s'appuie sur le coût réel de chaque appel.
const SORTIE_ATTENDUE = { extraction: 3000, verification: 1500, synthese: 1000, verificationSynthese: 300 };
const ENTREE_FIXE = { instructions: 3500, verification: 8000, synthese: 4000 };
const MAX_TOKENS = { verification: 4000, synthese: 4000, verificationSynthese: 4000 };

export interface PlanTheme {
  themeId: string;
  deja: boolean;
  estimationUsd: number;
}

export interface Plan {
  slug: string;
  documents: Corpus["documents"];
  echecs: CorpusCharge["echecs"];
  corpusJetons: number;
  themes: PlanTheme[];
  attenduUsd: number;
  pireCasUsd: number;
}

export function planifier(
  meta: CandidatMeta,
  charge: CorpusCharge,
  themes: ThemeExtraction[],
  tarifs: Tarifs,
  options: { racine?: string; force?: boolean } = {},
): Plan {
  const propositions = chargerPropositions(meta.slug, options.racine);
  const journal = chargerJournal(meta.slug, options.racine);
  let premier = true;
  let attendu = 0;
  let pireCas = 0;
  const lignes: PlanTheme[] = [];

  for (const theme of themes) {
    const deja = !options.force && (combinaisonDejaCouverte(propositions, theme.id) || combinaisonDejaCherchee(journal, theme.id));
    if (deja) {
      lignes.push({ themeId: theme.id, deja: true, estimationUsd: 0 });
      continue;
    }
    const cache = premier ? "ecriture" : "lecture";
    premier = false;
    const extraction = (sortie: number) =>
      estimerAppelUsd(tarifs, { jetonsCorpus: charge.corpus.jetons, jetonsAutres: ENTREE_FIXE.instructions, jetonsSortieMax: sortie, cache });
    const autres = (entree: number, sortie: number) => estimerAppelUsd(tarifs, { jetonsCorpus: 0, jetonsAutres: entree, jetonsSortieMax: sortie, cache: "aucun" });
    const attenduTheme =
      extraction(SORTIE_ATTENDUE.extraction) + autres(ENTREE_FIXE.verification, SORTIE_ATTENDUE.verification) + autres(ENTREE_FIXE.synthese, SORTIE_ATTENDUE.synthese) + autres(ENTREE_FIXE.synthese, SORTIE_ATTENDUE.verificationSynthese);
    const pireTheme =
      extraction(MAX_TOKENS_EXTRACTION) + autres(ENTREE_FIXE.verification, MAX_TOKENS.verification) + autres(ENTREE_FIXE.synthese, MAX_TOKENS.synthese) + autres(ENTREE_FIXE.synthese, MAX_TOKENS.verificationSynthese);
    attendu += attenduTheme;
    pireCas += pireTheme;
    lignes.push({ themeId: theme.id, deja: false, estimationUsd: attenduTheme });
  }
  return { slug: meta.slug, documents: charge.corpus.documents, echecs: charge.echecs, corpusJetons: charge.corpus.jetons, themes: lignes, attenduUsd: attendu, pireCasUsd: pireCas };
}

// ---- Exécution ----------------------------------------------------------------------------------------------

export interface ResumeTheme {
  themeId: string;
  mesuresExtraites: number;
  fusionnees: number;
  enAttente: number;
  erreur?: string;
}

export interface ResumeCandidat {
  slug: string;
  themes: ResumeTheme[];
  arretBudget: boolean;
}

// Fiche « brute » d'une mesure qui n'a pas pu être assemblée : pour la relecture humaine dans _a-verifier.json.
function propositionBrute(m: MesureModele): PropositionGeneree {
  return {
    titre: m.titre,
    resume_factuel: m.resume_factuel,
    sources: [],
    chiffrage_disponible: m.chiffrage_disponible,
    hypotheses_calcul: m.hypotheses_calcul,
    statut: m.statut,
    date_derniere_verification: new Date().toISOString().slice(0, 10),
    effets: m.effets.map((e) => ({ cibles: e.cibles, dimension: e.dimension, sens: e.sens, source_url: e.document, extrait: e.extrait })),
  };
}

async function executerTheme(
  client: ClientAnthropicMinimal,
  meta: CandidatMeta,
  charge: CorpusCharge,
  theme: ThemeExtraction,
  options: OptionsCorpus,
): Promise<ResumeTheme> {
  const existantes = chargerPropositions(meta.slug, options.racine);
  const titresAutres = existantes.filter((p) => p.theme !== theme.id).map((p) => p.titre);

  const extraction = await extraireMesures(client, meta, charge.corpus, theme.id, theme.libelle, theme.description, titresAutres);

  // Journal écrit tout de suite : la recherche est payée qu'elle donne des mesures ou non.
  const usage = extraction.reponse.usage;
  enregistrerJournal(
    meta.slug,
    {
      theme: theme.id,
      date: new Date().toISOString().slice(0, 10),
      resultat: extraction.mesures.length === 0 ? "aucune_mesure" : "propositions_generees",
      nombre_propositions: extraction.mesures.length,
      arret: extraction.reponse.stop_reason,
      duree_ms: extraction.dureeMs,
      jetons_entree: (usage?.input_tokens ?? 0) + (usage?.cache_creation_input_tokens ?? 0) + (usage?.cache_read_input_tokens ?? 0),
      jetons_sortie: usage?.output_tokens ?? 0,
      requetes: [],
      urls_lues: charge.corpus.documents.map((d) => d.url),
      urls_echouees: charge.echecs,
      ecartees: extraction.ecartees,
      chemin_trace: extraction.cheminTrace,
    },
    options.racine,
  );

  const enAttente: EntreeAVerifier[] = [];
  const assemblees: MesureAVerifier[] = [];
  for (const mesure of extraction.mesures) {
    const r = assemblerProposition(mesure, charge.corpus);
    if (r.ok) assemblees.push({ proposition: r.proposition, fenetres: r.fenetres });
    else enAttente.push({ theme: theme.id, proposition: propositionBrute(mesure), raison: r.raison });
  }

  const verdicts = await verifierMesuresParPassages(client, meta, assemblees);
  const fusionnees: Proposition[] = [];
  let index = existantes.filter((p) => p.theme === theme.id).length + 1;
  for (const { proposition } of assemblees) {
    const verdict = verdicts.get(proposition.titre);
    if (verdict?.statut === "PASS") {
      fusionnees.push({ ...proposition, id: genererIdProposition(meta.slug, theme.id, index), candidat: meta.slug, theme: theme.id });
      index += 1;
    } else {
      enAttente.push({ theme: theme.id, proposition, raison: verdict?.statut === "FAIL" ? verdict.raison : "Aucun verdict reçu" });
    }
  }

  if (fusionnees.length > 0) enregistrerPropositions(meta.slug, [...existantes, ...fusionnees], options.racine);
  if (enAttente.length > 0) enregistrerAVerifier(meta.slug, [...chargerAVerifier(meta.slug, options.racine), ...enAttente], options.racine);

  if (options.synthese) {
    await options.synthese(client, meta, theme.id, theme.libelle, { racine: options.racine, force: options.force });
  }
  return { themeId: theme.id, mesuresExtraites: extraction.mesures.length, fusionnees: fusionnees.length, enAttente: enAttente.length };
}

export async function executerCandidatCorpus(
  client: ClientAnthropicMinimal,
  meta: CandidatMeta,
  themes: ThemeExtraction[],
  options: OptionsCorpus = {},
): Promise<ResumeCandidat> {
  const charge = await chargerCorpus(meta, options);
  console.log(
    `[corpus] ${meta.slug} : ${charge.corpus.documents.length} document(s), ~${charge.corpus.jetons} jetons` +
      (charge.echecs.length > 0 ? ` ; ${charge.echecs.length} document(s) non lu(s) : ${charge.echecs.map((e) => e.cible).join(" ; ")}` : ""),
  );

  const resume: ResumeCandidat = { slug: meta.slug, themes: [], arretBudget: false };
  for (const theme of themes) {
    const propositions = chargerPropositions(meta.slug, options.racine);
    if (!options.force && combinaisonDejaCouverte(propositions, theme.id)) {
      console.log(`[sauté] ${meta.slug} × ${theme.id} déjà couvert`);
      continue;
    }
    if (!options.force && combinaisonDejaCherchee(chargerJournal(meta.slug, options.racine), theme.id)) {
      console.log(`[sauté] ${meta.slug} × ${theme.id} déjà cherché sans résultat (voir _journal-recherche.json) ; --force pour refaire`);
      continue;
    }
    console.log(`[en cours] ${meta.slug} × ${theme.id}`);
    try {
      const r = await executerTheme(client, meta, charge, theme, options);
      resume.themes.push(r);
      console.log(`[terminé] ${meta.slug} × ${theme.id} : ${r.mesuresExtraites} extraite(s), ${r.fusionnees} fusionnée(s), ${r.enAttente} en attente`);
    } catch (erreur) {
      if (erreur instanceof BudgetDepasse) {
        console.error(`[budget] ${erreur.message}`);
        resume.arretBudget = true;
        break;
      }
      const message = erreur instanceof Error ? erreur.message : String(erreur);
      console.error(`[erreur] ${meta.slug} × ${theme.id} : ${message}`);
      resume.themes.push({ themeId: theme.id, mesuresExtraites: 0, fusionnees: 0, enAttente: 0, erreur: message });
    }
  }
  const budget = budgetActuel();
  if (budget) console.log(`[budget] ${meta.slug} : dépensé ${budget.depenseEur.toFixed(2)} € sur ${budget.plafondEur.toFixed(2)} €`);
  return resume;
}

// Plan lisible, affiché AVANT tout appel : ce qui sera lu, ce que ça devrait coûter, le plafond.
export function formaterPlan(plan: Plan, eurParUsd: number, plafondEur: number): string {
  const eur = (usd: number) => `${(usd * eurParUsd).toFixed(2)} €`;
  const lignes = [`[plan] ${plan.slug} : ${plan.documents.length} document(s) lu(s), ~${plan.corpusJetons} jetons`];
  for (const d of plan.documents) lignes.push(`   - ${d.id} (${d.nom}, ${d.annee}) ~${d.jetons} jetons`);
  for (const e of plan.echecs) lignes.push(`   ! non lu : ${e.cible} — ${e.code}`);
  for (const t of plan.themes) {
    lignes.push(t.deja ? `   · ${t.themeId} : déjà fait (ignoré)` : `   · ${t.themeId} : ~${eur(t.estimationUsd)}`);
  }
  lignes.push(`   coût attendu ${eur(plan.attenduUsd)} · pire cas ${eur(plan.pireCasUsd)} · plafond ${plafondEur.toFixed(2)} €`);
  return lignes.join("\n");
}
