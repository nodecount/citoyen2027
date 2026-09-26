import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CHAMPS_CIBLES, DIMENSIONS_EFFET, SENS_EFFET, validerEffet, type CritereCible, type Effet } from "../effets";
import { localiserExtrait } from "../ingestion/corpus";
import { descriptionChampsProfil, remplirGabarit } from "../ingestion/generate";
import type { SortieCli } from "./claude-cli";

// Structuration des propositions d'une base « comparateurs » : un modèle (par la commande claude, sans API) décrit les
// effets de chaque proposition sur un citoyen ; le CODE vérifie que chaque extrait est retrouvé mot pour mot dans le
// texte de la proposition, qu'un second appel relit les effets, et la polarité (favorable/défavorable) reste dans le
// moteur. Un effet invalide ou refusé à la relecture fait perdre à la proposition TOUS ses effets : mieux vaut pas de
// badge qu'un badge fondé sur une moitié de la mesure.

const ICI = dirname(fileURLToPath(import.meta.url));

// Thèmes sans effet possible sur un citoyen (décision de conception du fil rouge : défense et diplomatie ne se
// projettent pas sur une situation personnelle) : leurs propositions sont marquées « analysées, sans effet » sans appel.
export const THEMES_SANS_EFFET = new Set(["defense", "europe-international"]);
export const TAILLE_GROUPE = 25;
const LONGUEUR_MIN_TEXTE = 15;

export interface EntreeStructuration {
  id: string;
  texte: string;
  url: string;
}

export type ResultatProposition =
  | { statut: "structuree"; effets: Effet[] }
  | { statut: "rejetee"; raison: string };

const SCHEMA_EFFET = {
  type: "object",
  properties: {
    cibles: {
      type: "array",
      items: {
        type: "object",
        properties: { champ: { type: "string", enum: [...CHAMPS_CIBLES] }, valeurs: { type: "array", items: { type: "string" } } },
        required: ["champ", "valeurs"],
        additionalProperties: false,
      },
    },
    dimension: { type: "string", enum: [...DIMENSIONS_EFFET] },
    sens: { type: "string", enum: [...SENS_EFFET] },
    extrait: { type: "string" },
  },
  required: ["cibles", "dimension", "sens", "extrait"],
  additionalProperties: false,
} as const;

export const SCHEMA_STRUCTURATION = {
  type: "object",
  properties: {
    resultats: {
      type: "array",
      items: {
        type: "object",
        properties: { id: { type: "string" }, effets: { type: "array", items: SCHEMA_EFFET } },
        required: ["id", "effets"],
        additionalProperties: false,
      },
    },
  },
  required: ["resultats"],
  additionalProperties: false,
} as const;

export const SCHEMA_VERIFICATION = {
  type: "object",
  properties: {
    verdicts: {
      type: "array",
      items: {
        type: "object",
        properties: { id: { type: "string" }, verdict: { type: "string", enum: ["PASS", "FAIL"] }, raison: { type: "string" } },
        required: ["id", "verdict"],
        additionalProperties: false,
      },
    },
  },
  required: ["verdicts"],
  additionalProperties: false,
} as const;

function lirePrompt(nom: string): string {
  return readFileSync(resolve(ICI, "prompts", nom), "utf-8");
}

export function empreintePrompts(): string {
  return createHash("sha256").update(lirePrompt("structuration.md")).update(lirePrompt("verification-structuration.md")).digest("hex").slice(0, 16);
}

// Change dès que le texte d'une proposition, l'ensemble des propositions du groupe ou les prompts changent : le
// groupe est alors à refaire ; sinon il est ignoré (rejouable sans repayer).
export function empreinteGroupe(entrees: EntreeStructuration[]): string {
  const h = createHash("sha256").update(empreintePrompts());
  for (const e of entrees) h.update(`\n${e.id}\n${e.texte}`);
  return h.digest("hex").slice(0, 16);
}

export function decouperEnGroupes<T>(elements: T[], taille: number = TAILLE_GROUPE): T[][] {
  const groupes: T[][] = [];
  for (let i = 0; i < elements.length; i += taille) groupes.push(elements.slice(i, i + taille));
  return groupes;
}

function listeNumerotee(entrees: EntreeStructuration[]): string {
  return JSON.stringify(entrees.map((e) => ({ id: e.id, texte: e.texte })), null, 1);
}

export function construireRequete(candidat: string, theme: string, entrees: EntreeStructuration[]): { systeme: string; prompt: string } {
  const systeme = remplirGabarit(lirePrompt("structuration.md"), { CANDIDAT: candidat, THEME: theme, CHAMPS_PROFIL: descriptionChampsProfil() });
  return { systeme, prompt: `Propositions à structurer (${entrees.length}) :\n${listeNumerotee(entrees)}` };
}

export function construireRequeteVerification(
  candidat: string,
  theme: string,
  entrees: EntreeStructuration[],
  effetsParId: Map<string, Effet[]>,
): { systeme: string; prompt: string } {
  const systeme = remplirGabarit(lirePrompt("verification-structuration.md"), { CANDIDAT: candidat, THEME: theme });
  const aRelire = entrees
    .filter((e) => (effetsParId.get(e.id) ?? []).length > 0)
    .map((e) => ({ id: e.id, texte: e.texte, effets: (effetsParId.get(e.id) ?? []).map(({ cibles, dimension, sens, extrait }) => ({ cibles, dimension, sens, extrait })) }));
  return { systeme, prompt: `Propositions et effets à relire (${aRelire.length}) :\n${JSON.stringify(aRelire, null, 1)}` };
}

function debut(texte: string): string {
  return texte.length > 60 ? `${texte.slice(0, 60)}…` : texte;
}

// Contrôles déterministes de la réponse : identifiants connus et non dupliqués, effets valides, extraits retrouvés mot pour mot
// dans LE texte de la proposition concernée. Toute proposition non conforme est rejetée avec sa raison.
export function controlerReponse(structure: unknown, entrees: EntreeStructuration[]): Map<string, ResultatProposition> {
  const resultats = new Map<string, ResultatProposition>();
  const parId = new Map(entrees.map((e) => [e.id, e]));
  const liste = (structure as { resultats?: unknown })?.resultats;
  if (!Array.isArray(liste)) throw new Error("Réponse inattendue : pas de tableau « resultats ».");

  const vus = new Set<string>();
  for (const brut of liste) {
    const id = (brut as { id?: unknown })?.id;
    if (typeof id !== "string" || !parId.has(id)) continue; // identifiant inventé : ignoré, la proposition réelle restera « sans réponse »
    if (vus.has(id)) {
      resultats.set(id, { statut: "rejetee", raison: "réponse en double pour cette proposition" });
      continue;
    }
    vus.add(id);
    const entree = parId.get(id)!;
    const effetsBruts = (brut as { effets?: unknown }).effets;
    if (!Array.isArray(effetsBruts)) {
      resultats.set(id, { statut: "rejetee", raison: "effets absents ou mal formés" });
      continue;
    }
    const document = { id: entree.id, url: entree.url, nom: "comparateur", annee: 0, type: "html" as const, texte: entree.texte };
    const effets: Effet[] = [];
    let raison: string | null = null;
    for (const e of effetsBruts) {
      const effet = { ...(e as Record<string, unknown>), source_url: entree.url };
      if (!validerEffet(effet, [entree.url])) {
        raison = "un effet est invalide (cibles, dimension, sens ou longueur de l'extrait)";
        break;
      }
      if (!localiserExtrait(document, effet.extrait).trouve) {
        raison = `l'extrait d'un effet n'est pas retrouvé dans le texte : « ${debut(effet.extrait)} »`;
        break;
      }
      effets.push({ cibles: effet.cibles as CritereCible[], dimension: effet.dimension, sens: effet.sens, source_url: entree.url, extrait: effet.extrait });
    }
    resultats.set(id, raison ? { statut: "rejetee", raison } : { statut: "structuree", effets });
  }
  for (const e of entrees) if (!resultats.has(e.id)) resultats.set(e.id, { statut: "rejetee", raison: "aucune réponse du modèle pour cette proposition" });
  return resultats;
}

export function appliquerVerdicts(resultats: Map<string, ResultatProposition>, verdicts: unknown): Map<string, ResultatProposition> {
  const liste = (verdicts as { verdicts?: unknown })?.verdicts;
  if (!Array.isArray(liste)) throw new Error("Réponse de relecture inattendue : pas de tableau « verdicts ».");
  const parId = new Map<string, { verdict?: string; raison?: string }>();
  for (const v of liste) if (typeof (v as { id?: unknown })?.id === "string") parId.set((v as { id: string }).id, v as { verdict?: string; raison?: string });

  const final = new Map<string, ResultatProposition>();
  for (const [id, resultat] of resultats) {
    if (resultat.statut !== "structuree" || resultat.effets.length === 0) {
      final.set(id, resultat); // rien à relire : pas d'effet, ou déjà rejetée
      continue;
    }
    const verdict = parId.get(id);
    if (verdict?.verdict === "PASS") final.set(id, resultat);
    else final.set(id, { statut: "rejetee", raison: verdict?.verdict === "FAIL" ? `relecture : ${verdict.raison ?? "refusé sans raison"}` : "relecture : aucun verdict reçu" });
  }
  return final;
}

export interface OutilsAppel {
  appeler: (prompt: string, systeme: string, schema: object) => Promise<SortieCli>;
}

export interface RapportGroupe {
  resultats: Map<string, ResultatProposition>;
  coutReferenceUsd: number;
  appels: number;
}

// Un groupe = un candidat × un thème (au plus TAILLE_GROUPE propositions). Deux appels : structuration puis relecture des
// seules propositions qui ont des effets. Les propositions trop courtes pour porter un extrait valide n'ont pas d'effet.
export async function structurerGroupe(candidat: string, theme: string, entrees: EntreeStructuration[], outils: OutilsAppel): Promise<RapportGroupe> {
  const trop_courtes = entrees.filter((e) => e.texte.trim().length < LONGUEUR_MIN_TEXTE);
  const aTraiter = entrees.filter((e) => e.texte.trim().length >= LONGUEUR_MIN_TEXTE);
  const resultats = new Map<string, ResultatProposition>(trop_courtes.map((e) => [e.id, { statut: "structuree", effets: [] }]));
  if (aTraiter.length === 0) return { resultats, coutReferenceUsd: 0, appels: 0 };

  const requete = construireRequete(candidat, theme, aTraiter);
  const premiere = await outils.appeler(requete.prompt, requete.systeme, SCHEMA_STRUCTURATION);
  const controles = controlerReponse(premiere.structure, aTraiter);
  let cout = premiere.coutReferenceUsd;
  let appels = 1;

  let finaux = controles;
  const effetsParId = new Map<string, Effet[]>();
  for (const [id, r] of controles) if (r.statut === "structuree") effetsParId.set(id, r.effets);
  if ([...effetsParId.values()].some((effets) => effets.length > 0)) {
    const relecture = construireRequeteVerification(candidat, theme, aTraiter, effetsParId);
    const seconde = await outils.appeler(relecture.prompt, relecture.systeme, SCHEMA_VERIFICATION);
    cout += seconde.coutReferenceUsd;
    appels += 1;
    finaux = appliquerVerdicts(controles, seconde.structure);
  }
  for (const [id, r] of finaux) resultats.set(id, r);
  return { resultats, coutReferenceUsd: cout, appels };
}
