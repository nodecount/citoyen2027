import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CandidatMeta, Proposition } from "../types";
import {
  detecterErreurReponse,
  remplirGabarit,
  type ClientAnthropicMinimal,
  type RequeteGeneration,
} from "./generate";
import type { Verdict } from "./verify";
import { appeler } from "./appel";

// Étape de synthèse : le texte « en quoi le programme de ce candidat touche ce thème » (fil rouge,
// CLAUDE.md). Rédigé à partir des SEULES propositions déjà vérifiées — aucun outil web, aucune
// connaissance extérieure — puis relu par un second appel indépendant. Les sources affichées à la fin
// du texte ne sont jamais rédigées ici : l'interface les construit (src/citations.ts).

const ICI = dirname(fileURLToPath(import.meta.url));
const MODELE = "claude-sonnet-5";
const MAX_TOKENS = 4000;
const TEXTE_MIN = 150;
const TEXTE_MAX = 1200;

// Pas de minItems/maxItems : l'API n'accepte que 0 ou 1. La couverture de toutes les mesures est
// vérifiée par erreurSynthese.
export const SCHEMA_SYNTHESE = {
  type: "object",
  properties: {
    texte: { type: "string" },
    propositions_utilisees: { type: "array", items: { type: "string" } },
  },
  required: ["texte", "propositions_utilisees"],
  additionalProperties: false,
} as const;

export interface SyntheseGeneree {
  texte: string;
  propositions_utilisees: string[];
}

// Racines (sans accents, en minuscules) d'un vocabulaire qui juge au lieu de décrire, y compris les
// niveaux de l'indicateur, réservés à l'interface. Filet volontairement grossier : un faux positif
// envoie la synthèse en relecture humaine, un faux négatif est rattrapé par la relecture du modèle.
const RACINES_EVALUATIVES = [
  "favorable",
  "avantageu",
  "desavantageu",
  "injuste",
  "ambitieu",
  "courageu",
  "dangereu",
  "catastroph",
  "benefique",
  "nefaste",
  "irresponsable",
  "demagogi",
  "populiste",
  "desastreu",
  "degradant",
  "ameliorant",
];

function sansAccents(texte: string): string {
  return texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function motsEvaluatifsTrouves(texte: string): string[] {
  const normalise = sansAccents(texte);
  return RACINES_EVALUATIVES.filter((racine) => normalise.includes(racine));
}

// null si la synthèse passe tous les contrôles déterministes, sinon la raison de l'échec.
export function erreurSynthese(valeur: unknown, idsAttendus: string[]): string | null {
  if (typeof valeur !== "object" || valeur === null) return "réponse invalide : objet attendu";
  const s = valeur as Record<string, unknown>;
  if (typeof s.texte !== "string") return "réponse invalide : `texte` absent";
  if (!Array.isArray(s.propositions_utilisees) || !s.propositions_utilisees.every((id) => typeof id === "string")) {
    return "réponse invalide : `propositions_utilisees` doit être une liste d'identifiants";
  }
  const texte = s.texte.trim();
  if (texte.length < TEXTE_MIN) return `texte trop court (${texte.length} caractères, minimum ${TEXTE_MIN})`;
  if (texte.length > TEXTE_MAX) return `texte trop long (${texte.length} caractères, maximum ${TEXTE_MAX})`;
  if (/https?:\/\/|www\./i.test(texte)) return "le texte contient une URL : les sources sont ajoutées par l'interface";
  const idCite = idsAttendus.find((id) => texte.includes(id));
  if (idCite) return `le texte cite un identifiant interne (${idCite})`;
  const mots = motsEvaluatifsTrouves(texte);
  if (mots.length > 0) return `vocabulaire évaluatif détecté : ${mots.join(", ")}`;

  const utilisees = new Set(s.propositions_utilisees as string[]);
  const manquantes = idsAttendus.filter((id) => !utilisees.has(id));
  if (manquantes.length > 0) return `toutes les mesures doivent être couvertes ; non couvertes : ${manquantes.join(", ")}`;
  const inconnues = [...utilisees].filter((id) => !idsAttendus.includes(id));
  if (inconnues.length > 0) return `mesures inconnues invoquées : ${inconnues.join(", ")}`;
  return null;
}

// Ce que le modèle voit d'une mesure : jamais d'URL ni d'extrait (il n'a pas à citer), mais les
// sources datées (pour dater et attribuer) et les effets (pour dire qui est concerné et de quoi).
function mesuresPourLeModele(propositions: Proposition[]): string {
  return JSON.stringify(
    propositions.map((p) => ({
      id: p.id,
      titre: p.titre,
      resume_factuel: p.resume_factuel,
      hypotheses_calcul: p.hypotheses_calcul,
      sources: p.sources.map((s) => ({ nom: s.nom, annee: s.annee, type: s.type })),
      effets: (p.effets ?? []).map((e) => ({ cibles: e.cibles, dimension: e.dimension, sens: e.sens })),
    })),
    null,
    2,
  );
}

export function construireRequeteSynthese(
  meta: CandidatMeta,
  themeId: string,
  themeLibelle: string,
  propositions: Proposition[],
): RequeteGeneration {
  const gabarit = readFileSync(resolve(ICI, "prompts/synthese.md"), "utf-8");
  return {
    model: MODELE,
    max_tokens: MAX_TOKENS,
    system: remplirGabarit(gabarit, { CANDIDAT: meta.nom, THEME: themeLibelle }),
    tools: [],
    output_config: { format: { type: "json_schema", schema: SCHEMA_SYNTHESE }, effort: "high" },
    messages: [
      {
        role: "user",
        content: `Thème « ${themeLibelle} » (id interne : ${themeId}). Mesures vérifiées de ${meta.nom} :\n${mesuresPourLeModele(propositions)}`,
      },
    ],
  };
}

export type ResultatSynthese =
  | { ok: true; synthese: SyntheseGeneree }
  // `texte` : dernier texte refusé, gardé pour la relecture humaine (avant, il était perdu).
  | { ok: false; erreur: string; texte?: string };

function texteDeReponse(reponse: { content: Array<{ type: string; text?: string }> }): string | undefined {
  return reponse.content.find((bloc) => bloc.type === "text")?.text;
}

const TENTATIVES_MAX = 2;

// Un refus déterministe (texte trop long, mesure omise, mot évaluatif…) se corrige presque toujours en
// renvoyant l'erreur au modèle : une seule nouvelle tentative, pour ~1 centime. Refus, troncature et pannes
// d'outil lèvent sans nouvelle tentative.
export async function genererSynthese(
  client: ClientAnthropicMinimal,
  meta: CandidatMeta,
  themeId: string,
  themeLibelle: string,
  propositions: Proposition[],
): Promise<ResultatSynthese> {
  const ids = propositions.map((p) => p.id);
  const requeteInitiale = construireRequeteSynthese(meta, themeId, themeLibelle, propositions);
  let messages = requeteInitiale.messages;
  let dernier: ResultatSynthese = { ok: false, erreur: "aucune tentative" };

  for (let tentative = 1; tentative <= TENTATIVES_MAX; tentative += 1) {
    const { reponse } = await appeler(client, { ...requeteInitiale, messages }, { phase: "synthèse", slug: meta.slug, themeId });
    if (reponse.stop_reason === "max_tokens") throw new Error(`genererSynthese (${meta.slug} × ${themeId}) : sortie tronquée (max_tokens)`);
    const erreurAppel = detecterErreurReponse(reponse);
    if (erreurAppel) throw new Error(`genererSynthese (${meta.slug} × ${themeId}) : ${erreurAppel}`);

    const texte = texteDeReponse(reponse);
    let erreur: string | null;
    let brut: unknown;
    if (!texte) {
      erreur = "réponse vide";
    } else {
      try {
        brut = JSON.parse(texte);
        erreur = erreurSynthese(brut, ids);
      } catch {
        erreur = "réponse non JSON";
      }
    }
    if (!erreur) {
      const { texte: contenu, propositions_utilisees } = brut as SyntheseGeneree;
      return { ok: true, synthese: { texte: contenu, propositions_utilisees } };
    }

    const refuse = brut && typeof brut === "object" && typeof (brut as { texte?: unknown }).texte === "string" ? (brut as { texte: string }).texte : texte;
    dernier = { ok: false, erreur, texte: refuse };
    if (tentative < TENTATIVES_MAX) {
      messages = [
        ...requeteInitiale.messages,
        { role: "assistant", content: texte ?? "" },
        { role: "user", content: `Ta réponse est refusée par un contrôle automatique : ${erreur}. Corrige ce point précis et renvoie l'objet JSON complet, sans rien changer d'autre.` },
      ];
    }
  }
  return dernier;
}
export function construireRequeteVerificationSynthese(
  meta: CandidatMeta,
  themeLibelle: string,
  propositions: Proposition[],
  synthese: SyntheseGeneree,
): RequeteGeneration {
  const gabarit = readFileSync(resolve(ICI, "prompts/verification-synthese.md"), "utf-8");
  return {
    model: MODELE,
    max_tokens: MAX_TOKENS,
    system: remplirGabarit(gabarit, { CANDIDAT: meta.nom, THEME: themeLibelle }),
    tools: [],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: { verdict: { type: "string", enum: ["PASS", "FAIL"] }, raison: { type: "string" } },
          required: ["verdict"],
          additionalProperties: false,
        },
      },
      effort: "high",
    },
    messages: [
      {
        role: "user",
        content: `Mesures vérifiées :\n${mesuresPourLeModele(propositions)}\n\nTexte de synthèse à vérifier :\n${synthese.texte}`,
      },
    ],
  };
}

// Jamais de PASS par défaut : une réponse illisible du relecteur est un échec.
export async function verifierSyntheseParModele(
  client: ClientAnthropicMinimal,
  meta: CandidatMeta,
  themeLibelle: string,
  propositions: Proposition[],
  synthese: SyntheseGeneree,
): Promise<Verdict> {
  const { reponse } = await appeler(
    client,
    construireRequeteVerificationSynthese(meta, themeLibelle, propositions, synthese),
    { phase: "vérification synthèse", slug: meta.slug },
  );
  const erreurAppel = detecterErreurReponse(reponse);
  if (erreurAppel) throw new Error(`verifierSynthese (${meta.slug}) : ${erreurAppel}`);

  const texte = texteDeReponse(reponse);
  let brut: unknown;
  try {
    brut = texte ? JSON.parse(texte) : undefined;
  } catch {
    brut = undefined;
  }
  const r = brut as { verdict?: unknown; raison?: unknown } | undefined;
  if (r?.verdict === "PASS") return { statut: "PASS" };
  if (r?.verdict === "FAIL") {
    return { statut: "FAIL", raison: typeof r.raison === "string" && r.raison ? r.raison : "Aucune raison fournie" };
  }
  return { statut: "FAIL", raison: "Réponse illisible du relecteur de la synthèse" };
}
