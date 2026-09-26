import { pathToFileURL } from "node:url";
import type { CandidatMeta, Proposition } from "../types";
import { genererPropositions, genererPropositionsDetaillee, creerClient, type ClientAnthropicMinimal } from "./generate";
import { clientEnFlux } from "./flux";
import { verifier } from "./verify";
import type { FetchImpl } from "./checks";
import type { PropositionGeneree } from "./schema";
import {
  chargerAVerifier,
  chargerJournal,
  chargerMeta,
  chargerPropositions,
  chargerSyntheses,
  combinaisonDejaCherchee,
  combinaisonDejaCouverte,
  enregistrerAVerifier,
  enregistrerJournal,
  enregistrerPropositions,
  enregistrerSynthese,
  enregistrerSyntheseAVerifier,
  supprimerSyntheseAVerifier,
  type EntreeAVerifier,
} from "./depot";
import { genererSynthese, verifierSyntheseParModele } from "./synthese";
import { chargerEnv } from "./env";
import { analyserArguments, type OptionsCLI } from "./cli";
import { Budget, TARIFS_PAR_MODELE } from "./budget";
import { definirBudget } from "./appel";
import { chargerCorpus, executerCandidatCorpus, formaterPlan, planifier } from "./run-corpus";
import themesData from "../../data/themes.json";

const themes = themesData as Array<{ id: string; libelle: string; description: string }>;

export interface CombinaisonACouvrir {
  slug: string;
  themeId: string;
  themeLibelle: string;
}

export interface OptionsExecution {
  racine?: string;
  fetchImpl?: FetchImpl;
  force?: boolean;
}

export { genererIdProposition } from "./ids";
import { genererIdProposition } from "./ids";

export interface ResultatCombinaison {
  fusionnees: Proposition[];
  enAttente: EntreeAVerifier[];
}

export async function executerCombinaison(
  client: ClientAnthropicMinimal,
  meta: CandidatMeta,
  combinaison: CombinaisonACouvrir,
  propositionsExistantes: Proposition[],
  options: OptionsExecution = {},
): Promise<ResultatCombinaison> {
  const titresExistants = propositionsExistantes.filter((p) => p.theme !== combinaison.themeId).map((p) => p.titre);
  const { propositions: generees, diagnostic } = await genererPropositionsDetaillee(
    client,
    meta,
    combinaison.themeId,
    combinaison.themeLibelle,
    titresExistants,
  );
  // Journal écrit tout de suite, avant la vérification : la recherche est payée qu'elle donne
  // des mesures ou non, et son résultat doit rester consultable même si la suite échoue.
  enregistrerJournal(
    meta.slug,
    {
      theme: combinaison.themeId,
      date: new Date().toISOString().slice(0, 10),
      resultat: generees.length === 0 ? "aucune_mesure" : "propositions_generees",
      nombre_propositions: generees.length,
      arret: diagnostic.stop_reason,
      duree_ms: diagnostic.dureeMs,
      jetons_entree: diagnostic.usage?.input_tokens ?? 0,
      jetons_sortie: diagnostic.usage?.output_tokens ?? 0,
      requetes: diagnostic.activite.requetes,
      urls_lues: diagnostic.activite.urlsLues,
      urls_echouees: diagnostic.activite.echecs,
      ecartees: diagnostic.ecartees,
      chemin_trace: diagnostic.cheminTrace,
    },
    options.racine,
  );
  const verdicts = await verifier(client, meta, generees, options.fetchImpl);

  const fusionnees: Proposition[] = [];
  const enAttente: EntreeAVerifier[] = [];
  let indexSuivant = propositionsExistantes.filter((p) => p.theme === combinaison.themeId).length + 1;

  for (const proposition of generees) {
    const verdict = verdicts.get(proposition.titre);
    if (verdict?.statut === "PASS") {
      fusionnees.push({
        ...proposition,
        id: genererIdProposition(meta.slug, combinaison.themeId, indexSuivant),
        candidat: meta.slug,
        theme: combinaison.themeId,
        date_derniere_verification: new Date().toISOString().slice(0, 10),
      });
      indexSuivant += 1;
    } else {
      enAttente.push({
        theme: combinaison.themeId,
        proposition,
        raison: verdict?.statut === "FAIL" ? verdict.raison : "Aucun verdict reçu",
      });
    }
  }

  if (fusionnees.length > 0) {
    enregistrerPropositions(meta.slug, [...propositionsExistantes, ...fusionnees], options.racine);
  }
  if (enAttente.length > 0) {
    const existantes = chargerAVerifier(meta.slug, options.racine);
    enregistrerAVerifier(meta.slug, [...existantes, ...enAttente], options.racine);
  }

  return { fusionnees, enAttente };
}

export function combinaisonsDiffere(existantes: Proposition[], fraiches: PropositionGeneree[]): boolean {
  if (existantes.length !== fraiches.length) return true;
  const normaliser = (p: { titre: string; resume_factuel: string; hypotheses_calcul: string; sources: { url: string }[] }) =>
    JSON.stringify({
      titre: p.titre,
      resume_factuel: p.resume_factuel,
      hypotheses_calcul: p.hypotheses_calcul,
      sources: p.sources.map((s) => s.url).sort(),
    });
  const existantesTriees = [...existantes].sort((a, b) => a.titre.localeCompare(b.titre)).map(normaliser);
  const fraichesTriees = [...fraiches].sort((a, b) => a.titre.localeCompare(b.titre)).map(normaliser);
  return existantesTriees.some((valeur, i) => valeur !== fraichesTriees[i]);
}

export async function executerRefresh(
  client: ClientAnthropicMinimal,
  meta: CandidatMeta,
  themeId: string,
  themeLibelle: string,
  options: OptionsExecution = {},
): Promise<{ divergence: boolean }> {
  const toutesPropositions = chargerPropositions(meta.slug, options.racine);
  const existantes = toutesPropositions.filter((p) => p.theme === themeId);
  const titresAutresThemes = toutesPropositions.filter((p) => p.theme !== themeId).map((p) => p.titre);
  const fraiches = await genererPropositions(client, meta, themeId, themeLibelle, titresAutresThemes);

  if (!combinaisonsDiffere(existantes, fraiches)) {
    return { divergence: false };
  }

  const entreesAVerifier = fraiches.map((proposition) => ({
    theme: themeId,
    proposition,
    raison: "refresh : divergence avec l'existant",
  }));
  const dejaEnAttente = chargerAVerifier(meta.slug, options.racine);
  enregistrerAVerifier(meta.slug, [...dejaEnAttente, ...entreesAVerifier], options.racine);
  return { divergence: true };
}

export function tirerEchantillon<T>(elements: T[], proportion: number, alea: () => number = Math.random): T[] {
  if (elements.length === 0) return [];
  const nombreATirer = Math.max(0, Math.round(elements.length * proportion));
  const copie = [...elements];
  const resultat: T[] = [];
  for (let i = 0; i < nombreATirer && copie.length > 0; i += 1) {
    const index = Math.floor(alea() * copie.length);
    resultat.push(copie.splice(index, 1)[0]);
  }
  return resultat;
}

export async function executerLot(
  client: ClientAnthropicMinimal,
  combinaisons: CombinaisonACouvrir[],
  options: OptionsExecution = {},
): Promise<void> {
  for (const combinaison of combinaisons) {
    try {
      const meta = chargerMeta(combinaison.slug, options.racine);
      const propositionsExistantes = chargerPropositions(combinaison.slug, options.racine);
      if (!options.force && combinaisonDejaCouverte(propositionsExistantes, combinaison.themeId)) {
        console.log(`[sauté] ${combinaison.slug} × ${combinaison.themeId} déjà couvert`);
        continue;
      }
      if (!options.force && combinaisonDejaCherchee(chargerJournal(combinaison.slug, options.racine), combinaison.themeId)) {
        console.log(
          `[sauté] ${combinaison.slug} × ${combinaison.themeId} déjà cherché sans résultat (voir _journal-recherche.json) ; --force pour refaire`,
        );
        continue;
      }
      console.log(`[en cours] ${combinaison.slug} × ${combinaison.themeId}`);
      const { fusionnees, enAttente } = await executerCombinaison(
        client,
        meta,
        combinaison,
        propositionsExistantes,
        options,
      );
      console.log(
        `[terminé] ${combinaison.slug} × ${combinaison.themeId} : ${fusionnees.length} fusionnée(s), ${enAttente.length} en attente`,
      );
    } catch (erreur) {
      console.error(`[erreur] ${combinaison.slug} × ${combinaison.themeId} :`, erreur);
    }
  }
}

export type ResultatSyntheseTheme = "enregistree" | "a_verifier" | "aucune_proposition" | "deja_a_jour";

// Étape 2 du pipeline, après les propositions : le texte « en quoi le programme touche ce thème »,
// rédigé à partir de TOUTES les mesures affichables du thème (jamais une sélection), relu par un
// second appel. Un texte refusé va dans _synthese-a-verifier.json, jamais dans synthese.json.
export async function executerSynthese(
  client: ClientAnthropicMinimal,
  meta: CandidatMeta,
  themeId: string,
  themeLibelle: string,
  options: OptionsExecution = {},
): Promise<ResultatSyntheseTheme> {
  const affichables = chargerPropositions(meta.slug, options.racine).filter(
    (p) => p.theme === themeId && (p.statut === "complet" || p.statut === "partiel"),
  );
  if (affichables.length === 0) return "aucune_proposition";

  const ids = affichables.map((p) => p.id);
  const existante = chargerSyntheses(meta.slug, options.racine).find((s) => s.theme === themeId);
  const memesMesures =
    existante !== undefined &&
    existante.propositions.length === ids.length &&
    [...existante.propositions].sort().join("|") === [...ids].sort().join("|");
  if (memesMesures && !options.force) return "deja_a_jour";

  const genere = await genererSynthese(client, meta, themeId, themeLibelle, affichables);
  if (!genere.ok) {
    enregistrerSyntheseAVerifier(
      meta.slug,
      { theme: themeId, texte: "", propositions: ids, raison: genere.erreur },
      options.racine,
    );
    return "a_verifier";
  }

  const verdict = await verifierSyntheseParModele(client, meta, themeLibelle, affichables, genere.synthese);
  if (verdict.statut === "FAIL") {
    enregistrerSyntheseAVerifier(
      meta.slug,
      {
        theme: themeId,
        texte: genere.synthese.texte,
        propositions: genere.synthese.propositions_utilisees,
        raison: verdict.raison,
      },
      options.racine,
    );
    return "a_verifier";
  }

  enregistrerSynthese(
    meta.slug,
    {
      theme: themeId,
      texte: genere.synthese.texte,
      propositions: ids,
      date_derniere_verification: new Date().toISOString().slice(0, 10),
    },
    options.racine,
  );
  supprimerSyntheseAVerifier(meta.slug, themeId, options.racine);
  return "enregistree";
}

export async function executerSyntheses(
  client: ClientAnthropicMinimal,
  combinaisons: CombinaisonACouvrir[],
  options: OptionsExecution = {},
): Promise<void> {
  for (const combinaison of combinaisons) {
    try {
      const meta = chargerMeta(combinaison.slug, options.racine);
      const resultat = await executerSynthese(client, meta, combinaison.themeId, combinaison.themeLibelle, options);
      if (resultat !== "aucune_proposition") {
        console.log(`[synthèse] ${combinaison.slug} × ${combinaison.themeId} : ${resultat}`);
      }
    } catch (erreur) {
      console.error(`[erreur synthèse] ${combinaison.slug} × ${combinaison.themeId} :`, erreur);
    }
  }
}

async function mainCorpus(options: OptionsCLI): Promise<void> {
  const tarifs = TARIFS_PAR_MODELE["claude-sonnet-5"];
  const budget = new Budget(options.budgetEur, tarifs);
  const themesACouvrir = options.themes ? themes.filter((t) => options.themes!.includes(t.id)) : themes;
  if (options.candidats.length === 0) {
    console.error("Aucun candidat : indiquer --candidats=slug1,slug2 (voir data/programmes/).");
    process.exitCode = 1;
    return;
  }

  // 1. Lire les documents (gratuit, cache disque) et afficher le plan et le coût attendu AVANT tout appel.
  let attenduTotalEur = 0;
  const retenus: CandidatMeta[] = [];
  for (const slug of options.candidats) {
    try {
      const meta = chargerMeta(slug);
      const charge = await chargerCorpus(meta, { actualiser: options.actualiserSources });
      const plan = planifier(meta, charge, themesACouvrir, tarifs, { force: options.force });
      console.log(formaterPlan(plan, budget.eurParUsd, options.budgetEur));
      attenduTotalEur += budget.enEuros(plan.attenduUsd);
      retenus.push(meta);
    } catch (erreur) {
      console.error(`[erreur] ${slug} : ${erreur instanceof Error ? erreur.message : String(erreur)}`);
    }
  }
  console.log(`[plan] total attendu ${attenduTotalEur.toFixed(2)} € pour un plafond de ${budget.plafondEur.toFixed(2)} €`);

  if (options.dryRun) {
    console.log("[dry-run] aucun appel n'a été envoyé.");
    return;
  }
  if (attenduTotalEur > budget.plafondEur) {
    console.error(
      `[refus] coût attendu (${attenduTotalEur.toFixed(2)} €) supérieur au plafond (${budget.plafondEur.toFixed(2)} €) : augmenter --budget ou réduire --candidats / --themes. Rien n'a été envoyé.`,
    );
    process.exitCode = 1;
    return;
  }

  // 2. Exécuter, sous plafond dur : tout appel qui ferait dépasser le budget est refusé avant d'être envoyé.
  definirBudget(budget);
  const client = clientEnFlux(creerClient());
  for (const meta of retenus) {
    const resume = await executerCandidatCorpus(client, meta, themesACouvrir, {
      force: options.force,
      synthese: executerSynthese,
    });
    if (resume.arretBudget) break;
  }
}

async function main(): Promise<void> {
  chargerEnv();
  const options = analyserArguments(process.argv.slice(2));

  if (options.mode === "corpus" && !options.refresh) {
    await mainCorpus(options);
    return;
  }

  console.warn("[avertissement] mode « recherche-web » : le modèle explore le web lui-même — très coûteux (~15 € pour un seul thème mesuré). Préférer le mode « corpus ».");
  // Réponse reçue en flux (voir flux.ts) : connexion gardée active, progression affichée en direct.
  const client = clientEnFlux(creerClient());

  if (options.refresh) {
    const meta = chargerMeta(options.refresh.slug);
    const themesACouvrir = options.refresh.theme
      ? themes.filter((t) => t.id === options.refresh!.theme)
      : themes;
    for (const theme of themesACouvrir) {
      try {
        const { divergence } = await executerRefresh(client, meta, theme.id, theme.libelle);
        console.log(`[refresh] ${meta.slug} × ${theme.id} : ${divergence ? "divergence détectée, voir _a-verifier.json" : "inchangé"}`);
      } catch (erreur) {
        console.error(`[erreur refresh] ${meta.slug} × ${theme.id} :`, erreur);
      }
    }
    return;
  }

  const themesACouvrir = options.themes ? themes.filter((t) => options.themes!.includes(t.id)) : themes;
  const combinaisons: CombinaisonACouvrir[] = options.candidats.flatMap((slug) =>
    themesACouvrir.map((theme) => ({ slug, themeId: theme.id, themeLibelle: theme.libelle })),
  );

  await executerLot(client, combinaisons, { force: options.force });
  // Deuxième étape : une synthèse par candidat × thème pour lequel des mesures existent.
  await executerSyntheses(client, combinaisons, { force: options.force });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((erreur) => {
    console.error(erreur);
    process.exitCode = 1;
  });
}
