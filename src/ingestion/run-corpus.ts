import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { CandidatMeta, Proposition } from "../types";
import { budgetActuel } from "./appel";
import { BudgetDepasse, estimerAppelUsd, type Tarifs } from "./budget";
import type { FetchImpl } from "./checks";
import { construireCorpus, type Corpus } from "./corpus";
import {
  chargerAVerifier,
  chargerJournal,
  chargerPropositions,
  combinaisonDejaCouverte,
  enregistrerAVerifier,
  enregistrerJournal,
  enregistrerPropositions,
  type EntreeAVerifier,
  type EntreeJournal,
} from "./depot";
import { chargerDocument, type TexteDocument, type TextePdf } from "./documents";
import { MAX_TOKENS_EXTRACTION, assemblerProposition, extraireMesures, type MesureModele, type ResultatExtraction } from "./extraction";
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
  // Refait contrôles, relecture et synthèse depuis les extractions en cache ; jamais d'appel d'extraction.
  retraiter?: boolean;
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

// ---- Extractions sauvegardées : un résultat payé ne doit jamais être perdu ni repayé ------------------------

const CACHE_SOURCES_PAR_DEFAUT = resolve(process.cwd(), "cache/sources");

interface ExtractionSauvegardee {
  empreinte_corpus: string;
  date: string;
  mesures: MesureModele[];
  ecartees: number;
  duree_ms: number;
  stop_reason?: string | null;
  usage?: ResultatExtraction["reponse"]["usage"];
  chemin_trace?: string;
}

function cheminExtraction(slug: string, themeId: string, dossierCache?: string): string {
  return resolve(dossierCache ?? CACHE_SOURCES_PAR_DEFAUT, "extractions", slug, `${themeId}.json`);
}

function chargerExtraction(slug: string, themeId: string, dossierCache?: string): ExtractionSauvegardee | undefined {
  const chemin = cheminExtraction(slug, themeId, dossierCache);
  if (!existsSync(chemin)) return undefined;
  try {
    return JSON.parse(readFileSync(chemin, "utf-8")) as ExtractionSauvegardee;
  } catch {
    return undefined;
  }
}

// Écrite dès que l'appel payant a réussi, AVANT les contrôles et la relecture : si un plafond de coût, une panne ou un
// rejet interrompt la suite, l'extraction (la partie chère) n'est pas à repayer. Au premier essai avec le corpus
// complet, 0,46 € ont été dépensés puis perdus faute de cette sauvegarde.
export function sauvegarderExtraction(slug: string, themeId: string, empreinteCorpus: string, e: ResultatExtraction, dossierCache?: string): void {
  const chemin = cheminExtraction(slug, themeId, dossierCache);
  mkdirSync(dirname(chemin), { recursive: true });
  const contenu: ExtractionSauvegardee = {
    empreinte_corpus: empreinteCorpus,
    date: new Date().toISOString(),
    mesures: e.mesures,
    ecartees: e.ecartees,
    duree_ms: e.dureeMs,
    stop_reason: e.reponse.stop_reason,
    usage: e.reponse.usage,
    chemin_trace: e.cheminTrace,
  };
  writeFileSync(chemin, JSON.stringify(contenu, null, 2));
}

// ---- Plan et estimation de coût (avant tout appel) ----------------------------------------------------------

// Hypothèses de sortie « typique » pour l'estimation ATTENDUE (le pire cas utilise les maxima). Le plafond dur, lui,
// s'appuie sur le coût réel de chaque appel.
// Extraction : 2 980 jetons mesurés pour la fiscalité (essai réel) ; 4 500 laissent de la marge pour un thème plus chargé.
const SORTIE_ATTENDUE = { extraction: 4500, verification: 1500, synthese: 1000, verificationSynthese: 300 };
const ENTREE_FIXE = { instructions: 3500, verification: 8000, synthese: 4000 };
const MAX_TOKENS = { verification: 4000, synthese: 4000, verificationSynthese: 4000 };

export type EtatTheme = "a_jour" | "obsolete" | "a_faire" | "sans_cache";

export interface PlanTheme {
  themeId: string;
  // À jour : rien à refaire (gratuit). Obsolète : des documents ont changé (ou recherche historique sans empreinte).
  etat: EtatTheme;
  deja: boolean;
  estimationUsd: number;
}

// Un thème est « à jour » si sa dernière recherche a été faite sur EXACTEMENT ces documents (même empreinte) et
// qu'elle a donné des mesures ou une absence de mesure enregistrée. Sinon, obsolète (documents changés) ou à faire.
export function etatDuTheme(
  propositions: Proposition[],
  journal: EntreeJournal[],
  themeId: string,
  empreinte: string,
  force?: boolean,
): EtatTheme {
  const entree = journal.find((e) => e.theme === themeId);
  const couvert = combinaisonDejaCouverte(propositions, themeId);
  if (force) return entree || couvert ? "obsolete" : "a_faire";
  if (entree && entree.empreinte_corpus === empreinte && (couvert || entree.resultat === "aucune_mesure")) return "a_jour";
  return entree || couvert ? "obsolete" : "a_faire";
}

export interface Plan {
  slug: string;
  documents: Corpus["documents"];
  // Documents dont le texte a changé depuis la dernière recherche (empreintes comparées au journal).
  documentsModifies: string[];
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
  options: { racine?: string; force?: boolean; retraiter?: boolean; dossierCache?: string } = {},
): Plan {
  const propositions = chargerPropositions(meta.slug, options.racine);
  const journal = chargerJournal(meta.slug, options.racine);
  let premier = true;
  let attendu = 0;
  let pireCas = 0;
  const lignes: PlanTheme[] = [];

  for (const theme of themes) {
    let etat = etatDuTheme(propositions, journal, theme.id, charge.corpus.empreinte, options.force);
    if (options.retraiter) {
      const enCache = chargerExtraction(meta.slug, theme.id, options.dossierCache);
      etat = enCache && enCache.empreinte_corpus === charge.corpus.empreinte ? "obsolete" : "sans_cache";
    }
    if (etat === "a_jour" || etat === "sans_cache") {
      lignes.push({ themeId: theme.id, etat, deja: true, estimationUsd: 0 });
      continue;
    }
    const cache = premier ? "ecriture" : "lecture";
    premier = false;
    const extraction = (sortie: number) =>
      estimerAppelUsd(tarifs, { jetonsCorpus: charge.corpus.jetons, jetonsAutres: ENTREE_FIXE.instructions, jetonsSortieMax: sortie, cache });
    const autres = (entree: number, sortie: number) => estimerAppelUsd(tarifs, { jetonsCorpus: 0, jetonsAutres: entree, jetonsSortieMax: sortie, cache: "aucun" });
    const sansExtraction = options.retraiter === true;
    const attenduTheme =
      (sansExtraction ? 0 : extraction(SORTIE_ATTENDUE.extraction)) + autres(ENTREE_FIXE.verification, SORTIE_ATTENDUE.verification) + autres(ENTREE_FIXE.synthese, SORTIE_ATTENDUE.synthese) + autres(ENTREE_FIXE.synthese, SORTIE_ATTENDUE.verificationSynthese);
    const pireTheme =
      (sansExtraction ? 0 : extraction(MAX_TOKENS_EXTRACTION)) + autres(ENTREE_FIXE.verification, MAX_TOKENS.verification) + autres(ENTREE_FIXE.synthese, MAX_TOKENS.synthese) + autres(ENTREE_FIXE.synthese, MAX_TOKENS.verificationSynthese);
    attendu += attenduTheme;
    pireCas += pireTheme;
    lignes.push({ themeId: theme.id, etat, deja: false, estimationUsd: attenduTheme });
  }
  const anciennes = journal.find((e) => e.empreintes_documents)?.empreintes_documents ?? {};
  const documentsModifies = charge.corpus.documents.filter((d) => anciennes[d.id] !== undefined && anciennes[d.id] !== d.empreinte).map((d) => d.id);
  return { slug: meta.slug, documents: charge.corpus.documents, documentsModifies, echecs: charge.echecs, corpusJetons: charge.corpus.jetons, themes: lignes, attenduUsd: attendu, pireCasUsd: pireCas };
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

  let extraction: ResultatExtraction;
  const sauvegarde = options.force ? undefined : chargerExtraction(meta.slug, theme.id, options.dossierCache);
  if (sauvegarde && sauvegarde.empreinte_corpus === charge.corpus.empreinte) {
    console.log(`[cache] ${meta.slug} × ${theme.id} : extraction déjà payée (${sauvegarde.date.slice(0, 10)}), réutilisée — aucun appel d'extraction`);
    extraction = {
      mesures: sauvegarde.mesures,
      ecartees: sauvegarde.ecartees,
      reponse: { content: [], stop_reason: sauvegarde.stop_reason, usage: sauvegarde.usage },
      dureeMs: sauvegarde.duree_ms,
      cheminTrace: sauvegarde.chemin_trace,
    };
  } else {
    extraction = await extraireMesures(client, meta, charge.corpus, theme.id, theme.libelle, theme.description, titresAutres);
    sauvegarderExtraction(meta.slug, theme.id, charge.corpus.empreinte, extraction, options.dossierCache);
  }

  // Journal écrit tout de suite : la recherche est payée qu'elle donne des mesures ou non.
  const usage = extraction.reponse.usage;
  const entreeJournal: EntreeJournal = {
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
  };
  // Écrit tout de suite, SANS empreinte : la recherche est tracée (elle est payée) mais le thème n'est pas encore
  // « à jour ». L'empreinte n'est ajoutée qu'une fois les mesures réellement enregistrées (voir plus bas), sinon un
  // arrêt pendant la relecture ferait ignorer le thème au passage suivant alors que ses mesures sont les anciennes.
  enregistrerJournal(meta.slug, entreeJournal, options.racine);

  const enAttente: EntreeAVerifier[] = [];
  const assemblees: MesureAVerifier[] = [];
  for (const mesure of extraction.mesures) {
    const r = assemblerProposition(mesure, charge.corpus);
    if (r.ok) assemblees.push({ proposition: r.proposition, fenetres: r.fenetres });
    else enAttente.push({ theme: theme.id, proposition: propositionBrute(mesure), raison: r.raison });
  }

  const verdicts = await verifierMesuresParPassages(client, meta, assemblees);
  const fusionnees: Proposition[] = [];
  let index = 1; // les mesures du thème sont REMPLACÉES : la numérotation repart de 1
  for (const { proposition } of assemblees) {
    const verdict = verdicts.get(proposition.titre);
    if (verdict?.statut === "PASS") {
      fusionnees.push({ ...proposition, id: genererIdProposition(meta.slug, theme.id, index), candidat: meta.slug, theme: theme.id });
      index += 1;
    } else {
      enAttente.push({ theme: theme.id, proposition, raison: verdict?.statut === "FAIL" ? verdict.raison : "Aucun verdict reçu" });
    }
  }

  // Remplacement, jamais ajout : refaire un thème (documents mis à jour, --force) ne doit pas dupliquer ses mesures.
  // L'historique reste dans git ; les entrées « à vérifier » du thème sont remplacées elles aussi.
  const avaitDesMesures = existantes.some((p) => p.theme === theme.id);
  if (avaitDesMesures || fusionnees.length > 0) {
    enregistrerPropositions(meta.slug, [...existantes.filter((p) => p.theme !== theme.id), ...fusionnees], options.racine);
  }
  const ancienAVerifier = chargerAVerifier(meta.slug, options.racine);
  if (ancienAVerifier.some((e) => e.theme === theme.id) || enAttente.length > 0) {
    enregistrerAVerifier(meta.slug, [...ancienAVerifier.filter((e) => e.theme !== theme.id), ...enAttente], options.racine);
  }

  // Le thème est terminé : mesures et entrées « à vérifier » sont enregistrées. Seulement maintenant, il devient
  // « à jour » pour cette empreinte de documents.
  enregistrerJournal(
    meta.slug,
    {
      ...entreeJournal,
      empreinte_corpus: charge.corpus.empreinte,
      empreintes_documents: Object.fromEntries(charge.corpus.documents.map((d) => [d.id, d.empreinte])),
    },
    options.racine,
  );

  if (options.synthese) {
    // Forcée : les identifiants peuvent être les mêmes alors que le contenu des mesures a changé.
    await options.synthese(client, meta, theme.id, theme.libelle, { racine: options.racine, force: true });
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
    let etat = etatDuTheme(chargerPropositions(meta.slug, options.racine), chargerJournal(meta.slug, options.racine), theme.id, charge.corpus.empreinte, options.force);
    if (options.retraiter) {
      const enCache = chargerExtraction(meta.slug, theme.id, options.dossierCache);
      etat = enCache && enCache.empreinte_corpus === charge.corpus.empreinte ? "obsolete" : "sans_cache";
    }
    if (etat === "sans_cache") {
      console.log(`[sauté] ${meta.slug} × ${theme.id} : aucune extraction en cache pour ces documents (--retraiter ne paie jamais d'extraction)`);
      continue;
    }
    if (etat === "a_jour") {
      console.log(`[sauté] ${meta.slug} × ${theme.id} à jour : les documents n'ont pas changé depuis la dernière recherche (--force pour refaire)`);
      continue;
    }
    console.log(`[en cours] ${meta.slug} × ${theme.id}${etat === "obsolete" ? " (obsolète : documents modifiés, mesures remplacées)" : ""}`);
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
  if (plan.documentsModifies.length > 0) lignes.push(`   ! document(s) modifié(s) depuis la dernière recherche : ${plan.documentsModifies.join(", ")}`);
  for (const t of plan.themes) {
    if (t.etat === "a_jour") lignes.push(`   · ${t.themeId} : à jour, documents inchangés (ignoré, gratuit)`);
    else if (t.etat === "sans_cache") lignes.push(`   · ${t.themeId} : aucune extraction en cache pour ces documents (ignoré, rien de payant)`);
    else lignes.push(`   · ${t.themeId} : ${t.etat === "obsolete" ? "obsolète, à refaire" : "à faire"} ~${eur(t.estimationUsd)}`);
  }
  lignes.push(`   coût attendu ${eur(plan.attenduUsd)} · pire cas ${eur(plan.pireCasUsd)} · plafond ${plafondEur.toFixed(2)} €`);
  return lignes.join("\n");
}
