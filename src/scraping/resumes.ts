import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { motsEvaluatifsTrouves } from "../ingestion/synthese";
import { remplirGabarit } from "../ingestion/generate";
import type { Proposition, SegmentResume } from "../types";
import type { OutilsAppel } from "./structuration";

// Résumé de toutes les mesures d'un candidat sur un thème, en 40 à 60 mots (60 au plus), avec des mots clés rattachés à leurs
// mesures. Le modèle rédige (commande claude, abonnement) ; le CODE vérifie la longueur, que chaque mesure est couverte
// par exactement un mot clé, et l'absence de mot évaluatif ; un second appel relit la fidélité et la neutralité.

const ICI = dirname(fileURLToPath(import.meta.url));
export const MOTS_MAX = 60;
export const MOTS_MAX_MOT_CLE = 12;
export const MOTS_MAX_LIAISON = 3;
const ESSAIS = 4;

export const SCHEMA_RESUME = {
  type: "object",
  properties: {
    segments: {
      type: "array",
      items: {
        type: "object",
        properties: { texte: { type: "string" }, mesures: { type: "array", items: { type: "string" } } },
        required: ["texte", "mesures"],
        additionalProperties: false,
      },
    },
  },
  required: ["segments"],
  additionalProperties: false,
} as const;

export const SCHEMA_VERDICT = {
  type: "object",
  properties: { verdict: { type: "string", enum: ["PASS", "FAIL"] }, raison: { type: "string" } },
  required: ["verdict"],
  additionalProperties: false,
} as const;

function lirePrompt(nom: string): string {
  return readFileSync(resolve(ICI, "prompts", nom), "utf-8");
}

// Texte d'une mesure donné au modèle : titre, et le résumé factuel s'il apporte plus.
export function texteMesure(p: Proposition): string {
  return p.resume_factuel && p.resume_factuel !== p.titre ? `${p.titre} — ${p.resume_factuel}` : p.titre;
}

// Change dès que les mesures, leurs textes ou les prompts changent : le résumé est alors à refaire.
export function empreinteResume(propositions: Proposition[]): string {
  const h = createHash("sha256").update(lirePrompt("resume.md")).update(lirePrompt("verification-resume.md"));
  for (const p of [...propositions].sort((a, b) => a.id.localeCompare(b.id))) h.update(`\n${p.id}\n${texteMesure(p)}`);
  return h.digest("hex").slice(0, 16);
}

export function compterMots(texte: string): number {
  return texte.split(/\s+/).filter((mot) => /[\p{L}\p{N}]/u.test(mot)).length;
}

export function texteComplet(segments: SegmentResume[]): string {
  return segments.map((s) => s.texte).join("").replace(/\s+/g, " ").trim();
}

// Références courtes données au modèle (m1, m2…), plus sûres à recopier que les identifiants longs.
export function references(propositions: Proposition[]): Map<string, string> {
  return new Map(propositions.map((p, i) => [`m${i + 1}`, p.id]));
}

// Un mot clé ne commence ni ne finit par une ponctuation, une espace ou une liaison (« et », « ou ») : ces morceaux sont
// déplacés dans des segments de liaison voisins. Aucun mot n'est modifié, le texte complet reste identique.
export function normaliserSegments(segments: SegmentResume[]): SegmentResume[] {
  const resultat: SegmentResume[] = [];
  const ajouterLiaison = (texte: string) => {
    if (!texte) return;
    const dernier = resultat[resultat.length - 1];
    if (dernier && dernier.mesures.length === 0) dernier.texte += texte;
    else resultat.push({ texte, mesures: [] });
  };
  for (const s of segments) {
    if (s.mesures.length === 0) {
      ajouterLiaison(s.texte);
      continue;
    }
    const debut = s.texte.match(/^(?:[\s,;:.]|(?:et|ou)\s)*/i)?.[0] ?? "";
    const fin = s.texte.slice(debut.length).match(/[\s,;:.]*$/)?.[0] ?? "";
    const coeur = s.texte.slice(debut.length, s.texte.length - fin.length);
    if (!coeur) {
      ajouterLiaison(s.texte);
      continue;
    }
    ajouterLiaison(debut);
    resultat.push({ texte: coeur, mesures: s.mesures });
    ajouterLiaison(fin);
  }
  return resultat;
}

// Contrôles déterministes. Renvoie les segments (identifiants réels) ou la raison du refus.
export function controlerResume(structure: unknown, refs: Map<string, string>): { ok: true; segments: SegmentResume[] } | { ok: false; raison: string } {
  const bruts = (structure as { segments?: unknown })?.segments;
  if (!Array.isArray(bruts) || bruts.length === 0) return { ok: false, raison: "aucun segment" };
  const segments: SegmentResume[] = [];
  const vues = new Map<string, number>();
  for (const b of bruts) {
    const texte = (b as { texte?: unknown })?.texte;
    const mesures = (b as { mesures?: unknown })?.mesures;
    if (typeof texte !== "string" || texte.length === 0 || !Array.isArray(mesures)) return { ok: false, raison: "segment mal formé" };
    const ids: string[] = [];
    for (const m of mesures) {
      const id = typeof m === "string" ? refs.get(m.trim()) : undefined;
      if (!id) return { ok: false, raison: `référence inconnue : « ${String(m)} »` };
      vues.set(id, (vues.get(id) ?? 0) + 1);
      ids.push(id);
    }
    if (ids.length > 0 && compterMots(texte) > MOTS_MAX_MOT_CLE) return { ok: false, raison: `mot clé trop long (plus de ${MOTS_MAX_MOT_CLE} mots) : « ${texte.trim()} »` };
    if (ids.length > 0 && compterMots(texte) === 0) return { ok: false, raison: "mot clé vide" };
    segments.push({ texte, mesures: ids });
  }
  const normalises = normaliserSegments(segments);
  if (normalises.some((s) => s.mesures.length > 0 && compterMots(s.texte) === 0)) return { ok: false, raison: "mot clé vide" };
  segments.splice(0, segments.length, ...normalises);
  // Style à l'infinitif, sans introduction : le texte commence par un mot clé, les liaisons ne sont que de petits mots.
  if (segments[0].mesures.length === 0) return { ok: false, raison: `le texte doit commencer directement par un mot clé, sans introduction (« ${segments[0].texte.trim()} »)` };
  const liaisonLongue = segments.find((s) => s.mesures.length === 0 && compterMots(s.texte) > MOTS_MAX_LIAISON);
  if (liaisonLongue) return { ok: false, raison: `liaison trop longue (plus de ${MOTS_MAX_LIAISON} mots) : « ${liaisonLongue.texte.trim()} »` };
  const oubliees = [...refs.entries()].filter(([, id]) => !vues.has(id)).map(([ref]) => ref);
  if (oubliees.length > 0) return { ok: false, raison: `mesures non couvertes par un mot clé : ${oubliees.join(", ")}` };
  const doublons = [...refs.entries()].filter(([, id]) => (vues.get(id) ?? 0) > 1).map(([ref]) => ref);
  if (doublons.length > 0) return { ok: false, raison: `mesures rattachées à plusieurs mots clés : ${doublons.join(", ")}` };
  const texte = texteComplet(segments);
  const mots = compterMots(texte);
  if (mots > MOTS_MAX) return { ok: false, raison: `texte trop long : ${mots} mots pour ${MOTS_MAX} au plus` };
  const evaluatifs = motsEvaluatifsTrouves(texte);
  if (evaluatifs.length > 0) return { ok: false, raison: `mots évaluatifs : ${evaluatifs.join(", ")}` };
  return { ok: true, segments };
}

function listeMesures(propositions: Proposition[], refs: Map<string, string>): string {
  const parId = new Map(propositions.map((p) => [p.id, p]));
  return [...refs.entries()].map(([ref, id]) => `${ref}. ${texteMesure(parId.get(id)!)}`).join("\n");
}

export interface ResultatResume {
  ok: boolean;
  segments?: SegmentResume[];
  raison?: string;
  coutReferenceUsd: number;
  appels: number;
}

// Trois essais au plus : une réponse refusée (contrôles ou relecture) est renvoyée au modèle avec la raison du refus.
export async function resumerTheme(candidat: string, theme: string, propositions: Proposition[], outils: OutilsAppel): Promise<ResultatResume> {
  const refs = references(propositions);
  const mesures = listeMesures(propositions, refs);
  const systeme = remplirGabarit(lirePrompt("resume.md"), { CANDIDAT: candidat, THEME: theme });
  const systemeRelecture = remplirGabarit(lirePrompt("verification-resume.md"), { CANDIDAT: candidat, THEME: theme });
  let cout = 0;
  let appels = 0;
  let raison = "";

  for (let essai = 1; essai <= ESSAIS; essai += 1) {
    const exces = raison.match(/^texte trop long : (\d+) mots/);
    const conseil = raison.startsWith("mot clé trop long")
      ? " Raccourcis ce mot clé à 8 mots au plus, ou découpe-le en deux mots clés."
      : exces
        ? ` Retire au moins ${Number(exces[1]) - MOTS_MAX + 3} mots : regroupe davantage de mesures sous moins de mots clés, plus courts.`
        : "";
    const consigne = raison ? `\n\nTa réponse précédente a été refusée : ${raison}. Corrige ce défaut.${conseil}` : "";
    const sortie = await outils.appeler(`Mesures (${refs.size}) :\n${mesures}${consigne}`, systeme, SCHEMA_RESUME);
    cout += sortie.coutReferenceUsd;
    appels += 1;
    const controle = controlerResume(sortie.structure, refs);
    if (!controle.ok) {
      raison = controle.raison;
      continue;
    }
    const inverse = new Map([...refs.entries()].map(([ref, id]) => [id, ref]));
    const aRelire = controle.segments.map((s) => (s.mesures.length ? `[${s.texte}](${s.mesures.map((id) => inverse.get(id)).join(", ")})` : s.texte)).join("");
    const verdict = await outils.appeler(`Mesures :\n${mesures}\n\nRésumé (mots clés entre crochets, suivis des mesures couvertes) :\n${aRelire}`, systemeRelecture, SCHEMA_VERDICT);
    cout += verdict.coutReferenceUsd;
    appels += 1;
    const v = verdict.structure as { verdict?: string; raison?: string };
    if (v?.verdict === "PASS") return { ok: true, segments: controle.segments, coutReferenceUsd: cout, appels };
    raison = `relecture : ${v?.raison ?? "refusé sans raison"}`;
  }
  return { ok: false, raison, coutReferenceUsd: cout, appels };
}
