import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { motsEvaluatifsTrouves } from "../ingestion/synthese";
import { remplirGabarit } from "../ingestion/generate";
import type { Proposition, SegmentResume } from "../types";
import type { OutilsAppel } from "./structuration";

// Résumé de toutes les mesures d'un candidat sur un thème, avec des mots clés rattachés à leurs mesures. Le modèle
// rédige (commande claude, abonnement) ; le CODE vérifie la longueur (voir motsMaxPour), que chaque mesure est
// couverte par exactement un mot clé, et l'absence de mot évaluatif ; un second appel relit la fidélité et la neutralité.

const ICI = dirname(fileURLToPath(import.meta.url));
// Visé : 40 à 60 mots avec peu de mesures. Le prompt (resume.md) demande de les regrouper en 6 à 10 mots clés au
// maximum plutôt que de forcer une longueur fixe : avec beaucoup de mesures, rester fidèle à chacune dans un texte
// aussi court qu'avec 5 mesures est impossible sans déformer certaines d'entre elles — le plafond suit donc le nombre
// de mesures (décision du porteur du projet, 2026-09-28), avec un plancher de 50 mots pour les thèmes à peu de mesures.
export function motsMaxPour(nombreMesures: number): number {
  return Math.max(50, nombreMesures * 2);
}
// Même logique par mot clé (décision du porteur du projet, 2026-09-28) : un mot clé qui regroupe plusieurs mesures a
// besoin de plus de mots pour rester fidèle à toutes qu'un mot clé qui n'en couvre qu'une.
export function motsMaxMotClePour(nombreMesures: number): number {
  return Math.max(8, nombreMesures * 3);
}
export const MOTS_MAX_LIAISON = 4;
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
    const motsMaxMotCle = motsMaxMotClePour(ids.length);
    if (ids.length > 0 && compterMots(texte) > motsMaxMotCle)
      return { ok: false, raison: `mot clé trop long (plus de ${motsMaxMotCle} mots pour ${ids.length} mesure(s) couverte(s)) : « ${texte.trim()} »` };
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
  const motsMax = motsMaxPour(refs.size);
  if (mots > motsMax) return { ok: false, raison: `texte trop long : ${mots} mots pour ${motsMax} au plus` };
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
  // Présent quand le résumé est publié malgré un défaut relevé par la relecture (voir `resumerTheme`) : la raison du
  // refus, et les mesures qu'elle désigne (identifiants réels), pour l'afficher à côté d'elles dans le détail.
  remarque?: { texte: string; mesures: string[] };
  coutReferenceUsd: number;
  appels: number;
}

// Références de mesures (« m3 », « m12»…) trouvées dans un texte de relecture, résolues en identifiants réels.
export function mesuresCiteesDansLaRaison(raison: string, refs: Map<string, string>): string[] {
  const trouvees = new Set<string>();
  for (const m of raison.matchAll(/\bm\d+\b/g)) {
    const id = refs.get(m[0]);
    if (id) trouvees.add(id);
  }
  return [...trouvees];
}

// Longueur visée selon le nombre de mesures : un texte long pour une ou deux mesures pousse à découper une mesure en
// plusieurs mots clés, ce qui est refusé. Au-delà de 5 mesures, la cible haute suit le plafond réel (motsMaxPour) :
// jamais une cible qui pousserait à sacrifier la fidélité d'un mot clé pour tenir dans un total trop serré.
export function longueurVisee(nombreMesures: number): string {
  if (nombreMesures <= 2) return "10 à 25 mots, un seul mot clé par mesure";
  if (nombreMesures <= 5) return "20 à 45 mots, un mot clé par mesure ou presque";
  return `40 à ${motsMaxPour(nombreMesures)} mots`;
}

// Quatre essais au plus : une réponse refusée (contrôles ou relecture) est renvoyée au modèle avec la raison du refus.
// Un résumé qui échoue les contrôles déterministes n'est jamais publié (structure invalide, rien à en tirer). Un résumé
// qui les passe mais que la relecture rejette encore après les quatre essais EST publié tout de même (décision du
// porteur du projet, 2026-09-28 : mieux vaut un résumé imparfait que pas de résumé) — avec la dernière raison de
// relecture gardée à part comme remarque, jamais mêlée au texte affiché.
export async function resumerTheme(candidat: string, theme: string, propositions: Proposition[], outils: OutilsAppel): Promise<ResultatResume> {
  const refs = references(propositions);
  const mesures = listeMesures(propositions, refs);
  const systeme = remplirGabarit(lirePrompt("resume.md"), { CANDIDAT: candidat, THEME: theme });
  const systemeRelecture = remplirGabarit(lirePrompt("verification-resume.md"), { CANDIDAT: candidat, THEME: theme });
  let cout = 0;
  let appels = 0;
  let raison = "";
  // Dernier résumé structurellement valide (contrôles déterministes passés) ET la raison de relecture qui l'a rejeté,
  // gardés ENSEMBLE (jamais la raison d'un autre essai) : le filet de sécurité si aucun essai n'obtient un PASS complet.
  let dernierValide: { segments: SegmentResume[]; raisonRelecture: string } | undefined;

  const motsMax = motsMaxPour(refs.size);
  const marge = 8; // vise un peu en dessous du plafond, pour absorber l'arrondi du modèle.

  for (let essai = 1; essai <= ESSAIS; essai += 1) {
    const exces = raison.match(/^texte trop long : (\d+) mots/);
    const conseil = raison.startsWith("mot clé trop long")
      ? " Raccourcis ce mot clé pour rester dans la limite indiquée (elle dépend du nombre de mesures qu'il couvre), sans en perdre la fidélité — ou découpe-le en deux mots clés (jamais deux mots clés pour la même référence)."
      : raison.startsWith("mesures rattachées à plusieurs")
        ? " Une mesure a probablement plusieurs volets (ex. baisser X et réduire Y) : mets-les dans UN SEUL mot clé qui les couvre tous deux (relie-les par « et » à l'intérieur du mot clé), ne crée jamais un second mot clé pour la même référence."
        : exces
        ? ` Retire au moins ${Number(exces[1]) - (motsMax - marge)} mots : regroupe davantage de mesures sous moins de mots clés, plus courts.`
        : "";
    const consigne = raison ? `\n\nTa réponse précédente a été refusée : ${raison}. Corrige ce défaut.${conseil}` : "";
    const longueur = `\n\nLongueur visée pour ces ${refs.size} mesure(s) : ${longueurVisee(refs.size)} (jamais plus de ${motsMax}).`;
    const sortie = await outils.appeler(`Mesures (${refs.size}) :\n${mesures}${longueur}${consigne}`, systeme, SCHEMA_RESUME);
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
    raison = v?.raison ?? "refusé sans raison";
    dernierValide = { segments: controle.segments, raisonRelecture: raison };
  }
  // Aucun essai n'a obtenu un PASS complet : publié quand même si au moins un essai était structurellement valide et a
  // été rejeté par la relecture (jamais si SEULS les contrôles déterministes ont échoué : pas de structure exploitable).
  if (dernierValide) {
    const { segments, raisonRelecture } = dernierValide;
    return { ok: true, segments, remarque: { texte: raisonRelecture, mesures: mesuresCiteesDansLaRaison(raisonRelecture, refs) }, coutReferenceUsd: cout, appels };
  }
  return { ok: false, raison, coutReferenceUsd: cout, appels };
}
