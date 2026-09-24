import type { Proposition, Source, StatutProposition } from "../types";

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
        },
        required: ["type", "label", "url"],
        additionalProperties: false,
      },
    },
    chiffrage_disponible: { type: "boolean" },
    hypotheses_calcul: { type: "string" },
    statut: { type: "string", enum: ["complet", "partiel", "provisoire"] },
    date_derniere_verification: { type: "string" },
  },
  required: [
    "titre",
    "resume_factuel",
    "sources",
    "chiffrage_disponible",
    "hypotheses_calcul",
    "statut",
    "date_derniere_verification",
  ],
  additionalProperties: false,
} as const;

export type PropositionGeneree = Omit<Proposition, "id" | "candidat" | "theme">;

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
  }

  return true;
}
