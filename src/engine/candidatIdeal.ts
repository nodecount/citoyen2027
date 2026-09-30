import type { GroupeSocial } from "../convictions";
import type { ConstatIntegrite } from "../data/integrite";
import type { Proposition } from "../types";
import { projeterConviction } from "./convictions";
import type { NiveauProjection } from "./projection";

// « Candidat idéal » : le SEUL endroit du produit où l'on désigne un candidat (exception décidée le 2026-09-30, voir
// CLAUDE.md). Règle publique et identique pour tous : solde = thèmes « améliorant » moins thèmes « dégradant » ; « mixte »,
// « non concerné » et l'absence d'indicateur comptent zéro ; aucune pondération entre thèmes.
export interface LignePourSolde {
  meta: { slug: string };
  projection: { niveau: NiveauProjection | null } | null;
  propositions: Proposition[];
}

// Structure minimale d'une card de thème (`CardTheme` y est assignable) : ce module ne dépend pas de l'interface.
export interface CardPourSolde {
  lignes: LignePourSolde[];
  absents: Array<{ slug: string }>;
}

export interface Solde {
  slug: string;
  ameliorants: number;
  degradants: number;
  // Thèmes (situation) ou constats groupe × thème (convictions) où le candidat a un niveau : la couverture du solde.
  analyses: number;
  solde: number;
}

function soldesVides(cards: CardPourSolde[]): Map<string, Solde> {
  const slugs = new Set<string>();
  for (const card of cards) {
    for (const l of card.lignes) slugs.add(l.meta.slug);
    for (const a of card.absents) slugs.add(a.slug);
  }
  return new Map([...slugs].sort().map((slug) => [slug, { slug, ameliorants: 0, degradants: 0, analyses: 0, solde: 0 }]));
}

function compter(s: Solde, niveau: NiveauProjection | null): void {
  if (niveau === null) return;
  s.analyses += 1;
  if (niveau === "ameliorant") s.ameliorants += 1;
  if (niveau === "degradant") s.degradants += 1;
  s.solde = s.ameliorants - s.degradants;
}

export function soldesSituation(cards: CardPourSolde[]): Solde[] {
  const soldes = soldesVides(cards);
  for (const card of cards) for (const l of card.lignes) compter(soldes.get(l.meta.slug)!, l.projection?.niveau ?? null);
  return [...soldes.values()];
}

// Convictions : un constat par groupe choisi et par thème (jamais une union de groupes, voir engine/convictions.ts).
export function soldesConvictions(cards: CardPourSolde[], groupes: GroupeSocial[]): Solde[] {
  const soldes = soldesVides(cards);
  for (const card of cards) {
    for (const l of card.lignes) {
      for (const g of groupes) compter(soldes.get(l.meta.slug)!, projeterConviction([g], l.propositions).niveau);
    }
  }
  return [...soldes.values()];
}

export interface Meilleurs {
  solde: number;
  gagnants: Solde[];
  // Faux seulement quand rien ne ressort : aucun candidat éligible, ou tous les éligibles à égalité à un solde NUL (aucun
  // n'est meilleur qu'un autre). Une égalité à un solde non nul reste désignée : tous les ex æquo sont montrés.
  departageable: boolean;
  ecartes: number;
}

// Un candidat sans aucun indicateur (`analyses === 0`) n'est pas éligible : il gagnerait par simple absence de données.
// Une égalité n'est JAMAIS tranchée par l'ordre alphabétique : tous les ex æquo sont renvoyés.
export function meilleurs(soldes: Solde[], ecartes: ReadonlySet<string> = new Set()): Meilleurs | null {
  if (soldes.length === 0) return null;
  const retenus = soldes.filter((s) => !ecartes.has(s.slug));
  const eligibles = retenus.filter((s) => s.analyses > 0);
  const nombreEcartes = soldes.length - retenus.length;
  if (eligibles.length === 0) return { solde: 0, gagnants: [], departageable: false, ecartes: nombreEcartes };
  const max = Math.max(...eligibles.map((s) => s.solde));
  const gagnants = eligibles.filter((s) => s.solde === max);
  const toutALegalite = gagnants.length === eligibles.length && eligibles.length > 1;
  return { solde: max, gagnants, departageable: !(toutALegalite && max === 0), ecartes: nombreEcartes };
}

// Faits d'intégrité (voir data/integrite.ts) : seuls les candidats à condamnation définitive RECENSÉE sont écartés ; un
// candidat « non vérifié » n'est pas écarté (l'absence de donnée n'est pas une condamnation).
export function ecartesParIntegrite(integrites: Record<string, ConstatIntegrite> | null): Set<string> {
  const ecartes = new Set<string>();
  for (const [slug, constat] of Object.entries(integrites ?? {})) if (constat.etat === "recensee") ecartes.add(slug);
  return ecartes;
}
