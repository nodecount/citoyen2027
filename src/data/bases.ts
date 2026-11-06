import basesJson from "../../data/bases/bases.json";
import type { EntreeAVerifier } from "../ingestion/depot";
import { construireQuestionnaire, type Questionnaire } from "../questionnaire";
import { champsDeBase } from "../schemaBase";
import type { CandidatMeta, ChampProfil, Proposition, Remarque, ResumeRefuse, ResumeTheme, SyntheseTheme, Theme } from "../types";
import { appliquerPartiCommun } from "./partiCommun";
import { assemblerCandidats, type CandidatCharge, type CandidatsCharges } from "./chargerCandidats";

// Une « base de connaissances » = un référentiel de thèmes + un dossier par candidat, dans data/bases/<id>/.
// Toutes les bases ont exactement la même structure de fichiers (meta.json, propositions.json, synthese.json, resumes.json) :
// le moteur et l'interface sont communs, seule la provenance des données change. Ajouter une base = ajouter un
// dossier et une entrée dans data/bases/bases.json, aucun autre code.

export interface InfoBase {
  id: string;
  libelle: string;
  description: string;
  // Texte affiché sur la page de résultats : ce que cette base garantit, et ce qu'elle ne garantit pas.
  avertissement: string;
  defaut?: boolean;
  // Base mise de côté : elle ne peut plus être choisie (la modale la grise, un ancien choix mémorisé est ignoré).
  desactivee?: boolean;
}

export interface BaseCharge {
  info: InfoBase;
  themes: Theme[];
  // Les questions de CETTE base (data/bases/<id>/profils-schema.json) : une autre source en pose d'autres.
  champs: ChampProfil[];
  // Questions générales + questions par thème, calculées depuis la pertinence propre à la base.
  questionnaire: Questionnaire;
  metas: Record<string, CandidatMeta>;
  propositions: Record<string, Proposition[]>;
  syntheses: Record<string, SyntheseTheme[]>;
  resumes: Record<string, ResumeTheme[]>;
  // Remarques de relecture sur un résumé publié malgré un défaut relevé (voir Remarque) : à côté, jamais dans le calcul.
  remarques: Record<string, Remarque[]>;
  // Dernier refus de résumé enregistré par thème (voir ResumeRefuse) : un thème avec des mesures mais sans résumé s'y
  // trouve, sauf s'il n'a encore jamais été tenté (voir `resumesManquants`, qui ne dépend pas de ce détail).
  resumesRefuses: Record<string, ResumeRefuse[]>;
  aVerifier: Record<string, EntreeAVerifier[]>;
}

const infosBases = basesJson as InfoBase[];

const themesModules = import.meta.glob("../../data/bases/*/themes.json", { eager: true }) as Record<string, { default: Theme[] }>;
const questionnaireModules = import.meta.glob("../../data/bases/*/questionnaire.json", { eager: true }) as Record<string, { default: { pertinence: Record<string, string[]> } }>;
const metaModules = import.meta.glob("../../data/bases/*/programmes/*/meta.json", { eager: true }) as Record<string, { default: CandidatMeta }>;
const propositionsModules = import.meta.glob("../../data/bases/*/programmes/*/propositions.json", { eager: true }) as Record<string, { default: Proposition[] }>;
const synthesesModules = import.meta.glob("../../data/bases/*/programmes/*/synthese.json", { eager: true }) as Record<string, { default: SyntheseTheme[] }>;
const resumesModules = import.meta.glob("../../data/bases/*/programmes/*/resumes.json", { eager: true }) as Record<string, { default: ResumeTheme[] }>;
const remarquesModules = import.meta.glob("../../data/bases/*/programmes/*/remarques.json", { eager: true }) as Record<string, { default: Remarque[] }>;
const resumesRefusesModules = import.meta.glob("../../data/bases/*/programmes/*/_resumes-refuses.json", { eager: true }) as Record<string, { default: ResumeRefuse[] }>;
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
  return bases.find((b) => b.id === demandee && !b.desactivee) ?? baseParDefaut(bases);
}

export function chargerBase(id: string): BaseCharge {
  const info = resoudreBase(id);
  const themes = Object.entries(themesModules).find(([chemin]) => extraireBase(chemin) === info.id)?.[1].default ?? [];
  const pertinence = Object.entries(questionnaireModules).find(([chemin]) => extraireBase(chemin) === info.id)?.[1].default.pertinence ?? {};
  return {
    info,
    themes,
    champs: champsDeBase(info.id),
    questionnaire: construireQuestionnaire(champsDeBase(info.id), pertinence, themes),
    metas: appliquerPartiCommun(regrouperParBaseEtSlug(metaModules, info.id)),
    propositions: regrouperParBaseEtSlug(propositionsModules, info.id),
    syntheses: regrouperParBaseEtSlug(synthesesModules, info.id),
    resumes: regrouperParBaseEtSlug(resumesModules, info.id),
    remarques: regrouperParBaseEtSlug(remarquesModules, info.id),
    resumesRefuses: regrouperParBaseEtSlug(resumesRefusesModules, info.id),
    aVerifier: regrouperParBaseEtSlug(aVerifierModules, info.id),
  };
}

export function candidatsDeBase(base: BaseCharge): CandidatsCharges {
  return assemblerCandidats(base.metas, base.propositions, base.syntheses, base.resumes, base.remarques);
}

export interface ResumeManquant {
  nom: string;
  themeLibelle: string;
  nombreMesures: number;
  // Raison du dernier refus connu pour ce thème, si la génération a déjà été tentée (voir ResumeRefuse) ; null si elle
  // n'a jamais encore été lancée (candidat ou thème récent).
  raison: string | null;
}

// Thèmes où un candidat a au moins une mesure affichable mais aucun résumé : ni caché ni deviné, listé pour que
// l'absence ne soit jamais silencieuse (décision du porteur du projet, 2026-09-28). N'affecte ni le calcul ni
// l'indicateur : le détail des mesures reste affiché intégralement pour ces thèmes.
export function resumesManquants(base: BaseCharge, candidats: CandidatCharge[]): ResumeManquant[] {
  const manquants: ResumeManquant[] = [];
  for (const candidat of candidats) {
    const nombreParTheme = new Map<string, number>();
    for (const p of candidat.propositions) {
      if (p.statut !== "complet" && p.statut !== "partiel") continue;
      nombreParTheme.set(p.theme, (nombreParTheme.get(p.theme) ?? 0) + 1);
    }
    for (const theme of base.themes) {
      const nombreMesures = nombreParTheme.get(theme.id) ?? 0;
      if (nombreMesures === 0) continue;
      if ((candidat.resumes ?? []).some((r) => r.theme === theme.id)) continue;
      const refus = (base.resumesRefuses[candidat.meta.slug] ?? []).find((r) => r.theme === theme.id);
      manquants.push({ nom: candidat.meta.nom, themeLibelle: theme.libelle, nombreMesures, raison: refus?.raison ?? null });
    }
  }
  return manquants;
}

// Date de mise à jour à afficher au visiteur : la plus récente des dates de mise à jour des candidats de la base
// (format ISO AAAA-MM-JJ, comparable en chaîne). Null si la base n'a aucun candidat — jamais une date inventée.
export function derniereMiseAJour(base: BaseCharge): string | null {
  const dates = Object.values(base.metas)
    .map((m) => m.date_derniere_maj)
    .filter((d): d is string => typeof d === "string" && d.length > 0);
  return dates.length > 0 ? dates.reduce((plusRecente, d) => (d > plusRecente ? d : plusRecente)) : null;
}
