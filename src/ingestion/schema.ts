import type { Proposition, Source, StatutProposition } from "../types";
import {
  CHAMPS_CIBLES,
  DIMENSIONS_EFFET,
  SENS_EFFET,
  validerEffet,
  type Effet,
} from "../effets";

export const SCHEMA_PROPOSITION_GENEREE = {
  type: "object",
  properties: {
    titre: { type: "string" },
    resume_factuel: { type: "string" },
    sources: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["primaire", "secondaire"] },
          label: { type: "string" },
          url: { type: "string" },
          // Citation « nom · année » (src/citations.ts) : nom court de la source, et année du
          // document ou de la position (ex : 2021 pour un amendement de 2021).
          nom: { type: "string" },
          annee: { type: "integer" },
        },
        required: ["type", "label", "url", "nom", "annee"],
        additionalProperties: false,
      },
    },
    chiffrage_disponible: { type: "boolean" },
    hypotheses_calcul: { type: "string" },
    statut: { type: "string", enum: ["complet", "partiel", "provisoire"] },
    date_derniere_verification: { type: "string" },
    // Ce que la mesure fait directement à un citoyen (voir src/effets.ts). Pas de minItems : l'API
    // n'accepte que 0 ou 1 ; [] est d'ailleurs une réponse valide (aucun effet direct déterminable).
    effets: {
      type: "array",
      items: {
        type: "object",
        properties: {
          cibles: {
            type: "array",
            items: {
              type: "object",
              properties: {
                champ: { type: "string", enum: [...CHAMPS_CIBLES] },
                valeurs: { type: "array", items: { type: "string" } },
              },
              required: ["champ", "valeurs"],
              additionalProperties: false,
            },
          },
          dimension: { type: "string", enum: [...DIMENSIONS_EFFET] },
          sens: { type: "string", enum: [...SENS_EFFET] },
          source_url: { type: "string" },
          extrait: { type: "string" },
        },
        required: ["cibles", "dimension", "sens", "source_url", "extrait"],
        additionalProperties: false,
      },
    },
  },
  required: [
    "titre",
    "resume_factuel",
    "sources",
    "chiffrage_disponible",
    "hypotheses_calcul",
    "statut",
    "date_derniere_verification",
    "effets",
  ],
  additionalProperties: false,
} as const;

// Côté stockage `effets` est optionnel (les 71 propositions collectées à la main n'en ont pas
// encore) ; côté génération il est obligatoire, éventuellement vide.
export type PropositionGeneree = Omit<Proposition, "id" | "candidat" | "theme" | "effets"> & {
  effets: Effet[];
};

const STATUTS_VALIDES: StatutProposition[] = ["complet", "partiel", "provisoire"];
const TYPES_SOURCE_VALIDES: Source["type"][] = ["primaire", "secondaire"];

export function validerPropositionGeneree(valeur: unknown): valeur is PropositionGeneree {
  if (typeof valeur !== "object" || valeur === null) return false;
  const p = valeur as Record<string, unknown>;

  if (typeof p.titre !== "string" || p.titre.length === 0) return false;
  if (typeof p.resume_factuel !== "string" || p.resume_factuel.length === 0) return false;
  if (typeof p.chiffrage_disponible !== "boolean") return false;
  if (typeof p.hypotheses_calcul !== "string") return false;
  if (typeof p.statut !== "string" || !STATUTS_VALIDES.includes(p.statut as StatutProposition)) {
    return false;
  }
  if (typeof p.date_derniere_verification !== "string") return false;
  if (!Array.isArray(p.sources) || p.sources.length < 2) return false;

  for (const source of p.sources) {
    if (typeof source !== "object" || source === null) return false;
    const s = source as Record<string, unknown>;
    if (typeof s.type !== "string" || !TYPES_SOURCE_VALIDES.includes(s.type as Source["type"])) {
      return false;
    }
    if (typeof s.label !== "string" || s.label.length === 0) return false;
    if (typeof s.url !== "string" || s.url.length === 0) return false;
    if (typeof s.nom !== "string" || s.nom.trim().length === 0 || s.nom.length > 80) return false;
    if (!Number.isInteger(s.annee) || (s.annee as number) < 1990 || (s.annee as number) > 2035) return false;
  }

  if (!Array.isArray(p.effets)) return false;
  const urlsSources = (p.sources as Array<{ url: string }>).map((s) => s.url);
  if (!p.effets.every((effet) => validerEffet(effet, urlsSources))) return false;

  return true;
}
