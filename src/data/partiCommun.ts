import bordsPolitiques from "../../data/bords-politiques.json";
import type { CandidatMeta } from "../types";

// Le lien candidat → parti est un référentiel UNIQUE, valable pour toutes les bases (décision du 2026-11-06) : le jeu
// « Candidatures à l'élection présidentielle 2027 » de 2027etmoi, recopié dans data/bords-politiques.json par
// scripts/bords_politiques.py. Un comparateur peut garder un ancien nom de parti ou laisser le champ vide ; basculer d'une
// source à l'autre ne change donc jamais le parti d'un candidat. Un candidat que le référentiel ne connaît pas garde le parti
// de sa source.
const details = (bordsPolitiques as { details: Record<string, { parti_2027etmoi?: string }> }).details;

export function partiCommun(slug: string): string | null {
  const parti = details[slug]?.parti_2027etmoi;
  return typeof parti === "string" && parti.trim() !== "" ? parti : null;
}

export function appliquerPartiCommun(metas: Record<string, CandidatMeta>): Record<string, CandidatMeta> {
  return Object.fromEntries(Object.entries(metas).map(([slug, meta]) => [slug, { ...meta, parti: partiCommun(slug) ?? meta.parti }]));
}
