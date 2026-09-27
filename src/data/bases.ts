import basesJson from "../../data/bases/bases.json";
import type { EntreeAVerifier } from "../ingestion/depot";
import { CHAMPS_PROFIL, construireQuestionnaire, type Questionnaire } from "../questionnaire";
import type { CandidatMeta, Proposition, SyntheseTheme, Theme } from "../types";
import { assemblerCandidats, type CandidatsCharges } from "./chargerCandidats";

// Une « base de connaissances » = un référentiel de thèmes + un dossier par candidat, dans data/bases/<id>/.
// Toutes les bases ont exactement la même structure de fichiers (meta.json, propositions.json, synthese.json) :
// le moteur et l'interface sont communs, seule la provenance des données change. Ajouter une base = ajouter un
// dossier et une entrée dans data/bases/bases.json, aucun autre code.

export interface InfoBase {
  id: string;
  libelle: string;
  description: string;
  // Texte affiché sur la page de résultats : ce que cette base garantit, et ce qu'elle ne garantit pas.
  avertissement: string;
  defaut?: boolean;
}

export interface BaseCharge {
  info: InfoBase;
  themes: Theme[];
  // Questions générales + questions par thème, calculées depuis la pertinence propre à la base.
  questionnaire: Questionnaire;
  metas: Record<string, CandidatMeta>;
  propositions: Record<string, Proposition[]>;
  syntheses: Record<string, SyntheseTheme[]>;
  aVerifier: Record<string, EntreeAVerifier[]>;
}

const infosBases = basesJson as InfoBase[];

const themesModules = import.meta.glob("../../data/bases/*/themes.json", { eager: true }) as Record<string, { default: Theme[] }>;
const questionnaireModules = import.meta.glob("../../data/bases/*/questionnaire.json", { eager: true }) as Record<string, { default: { pertinence: Record<string, string[]> } }>;
const metaModules = import.meta.glob("../../data/bases/*/programmes/*/meta.json", { eager: true }) as Record<string, { default: CandidatMeta }>;
const propositionsModules = import.meta.glob("../../data/bases/*/programmes/*/propositions.json", { eager: true }) as Record<string, { default: Proposition[] }>;
const synthesesModules = import.meta.glob("../../data/bases/*/programmes/*/synthese.json", { eager: true }) as Record<string, { default: SyntheseTheme[] }>;
const aVerifierModules = import.meta.glob("../../data/bases/*/programmes/*/_a-verifier.json", { eager: true }) as Record<string, { default: EntreeAVerifier[] }>;

// "/…/data/bases/<base>/programmes/<slug>/fichier.json" → { base, slug }
export function extraireBaseEtSlug(cheminModule: string): { base: string; slug: string } | null {
  const m = cheminModule.match(/data\/bases\/([^/]+)\/programmes\/([^/]+)\//);
  return m ? { base: m[1], slug: m[2] } : null;
}

export function extraireBase(cheminModule: string): string | null {
  const m = cheminModule.match(/data\/bases\/([^/]+)\//);
  return m ? m[1] : null;
}

export function regrouperParBaseEtSlug<T>(modules: Record<string, { default: T }>, base: string): Record<string, T> {
  const resultat: Record<string, T> = {};
  for (const [chemin, module] of Object.entries(modules)) {
    const position = extraireBaseEtSlug(chemin);
    if (position && position.base === base) resultat[position.slug] = module.default;
  }
  return resultat;
}

export function listerBases(): InfoBase[] {
  return infosBases;
}

export function baseParDefaut(bases: InfoBase[] = infosBases): InfoBase {
  return bases.find((b) => b.defaut) ?? bases[0];
}

// Base demandée (adresse ?base=… ou choix mémorisé) → une base qui existe vraiment, sinon la base par défaut.
export function resoudreBase(demandee: string | null | undefined, bases: InfoBase[] = infosBases): InfoBase {
  return bases.find((b) => b.id === demandee) ?? baseParDefaut(bases);
}

export function chargerBase(id: string): BaseCharge {
  const info = resoudreBase(id);
  const themes = Object.entries(themesModules).find(([chemin]) => extraireBase(chemin) === info.id)?.[1].default ?? [];
  const pertinence = Object.entries(questionnaireModules).find(([chemin]) => extraireBase(chemin) === info.id)?.[1].default.pertinence ?? {};
  return {
    info,
    themes,
    questionnaire: construireQuestionnaire(CHAMPS_PROFIL, pertinence, themes),
    metas: regrouperParBaseEtSlug(metaModules, info.id),
    propositions: regrouperParBaseEtSlug(propositionsModules, info.id),
    syntheses: regrouperParBaseEtSlug(synthesesModules, info.id),
    aVerifier: regrouperParBaseEtSlug(aVerifierModules, info.id),
  };
}

export function candidatsDeBase(base: BaseCharge): CandidatsCharges {
  return assemblerCandidats(base.metas, base.propositions, base.syntheses);
}

// Date de mise à jour à afficher au visiteur : la plus récente des dates de mise à jour des candidats de la base
// (format ISO AAAA-MM-JJ, comparable en chaîne). Null si la base n'a aucun candidat — jamais une date inventée.
export function derniereMiseAJour(base: BaseCharge): string | null {
  const dates = Object.values(base.metas)
    .map((m) => m.date_derniere_maj)
    .filter((d): d is string => typeof d === "string" && d.length > 0);
  return dates.length > 0 ? dates.reduce((plusRecente, d) => (d > plusRecente ? d : plusRecente)) : null;
}
