import type { ConstatIntegrite } from "../data/integrite";
import type { Proposition } from "../types";
import type { ChoixPositions } from "../positions";
import { projeterPosition } from "./positions";
import type { NiveauProjection } from "./projection";

// « Candidat idéal » : le SEUL endroit du produit où l'on désigne un candidat (exception décidée le 2026-09-30, voir
// CLAUDE.md). Règle publique et identique pour tous : solde = thèmes « améliorant » moins thèmes « dégradant » ; « mixte »,
// « non concerné » et l'absence d'indicateur comptent zéro ; aucune pondération entre thèmes.
export interface LignePourSolde {
  meta: { slug: string };
  projection: { niveau: NiveauProjection | null; effetsRetenus?: Array<{ propositionId: string }> } | null;
  propositions: Proposition[];
  // Résumé du candidat sur le thème (mots clés qui regroupent ses mesures) : sert à nommer les groupes derrière le score.
  resume?: { segments: Array<{ texte: string; mesures: string[] }> } | null;
}

// Structure minimale d'une card de thème (`CardTheme` y est assignable) : ce module ne dépend pas de l'interface.
export interface CardPourSolde {
  theme: { id: string };
  lignes: LignePourSolde[];
  absents: Array<{ slug: string }>;
}

// Un point du score : un thème (situation) ou un sujet × thème (convictions) compté +1 ou −1, avec les GROUPES de mesures qui le
// fondent (mots clés du résumé du candidat, ceux numérotés en « Explorer les mesures » ; le titre de la mesure s'il n'y a pas de
// résumé). Le nombre de points de chaque liste est donc exactement celui du score.
export interface Raison {
  // Identifiant du thème où le point compte (l'interface n'en montre que l'icône).
  theme: string;
  groupes: string[];
  // Titres des mesures elles-mêmes (une fois chacune), pour qui préfère les voir plutôt que leurs groupes.
  mesures: string[];
}

export interface Solde {
  slug: string;
  ameliorants: number;
  degradants: number;
  // Thèmes (situation) ou constats groupe × thème (convictions) où le candidat a un niveau : la couverture du solde.
  analyses: number;
  solde: number;
  // Les mesures derrière le score : seuls les thèmes (ou constats) comptés +1 ou −1 y figurent, jamais les « mixte ».
  pour: Raison[];
  contre: Raison[];
}

function soldesVides(cards: CardPourSolde[]): Map<string, Solde> {
  const slugs = new Set<string>();
  for (const card of cards) {
    for (const l of card.lignes) slugs.add(l.meta.slug);
    for (const a of card.absents) slugs.add(a.slug);
  }
  return new Map([...slugs].sort().map((slug) => [slug, { slug, ameliorants: 0, degradants: 0, analyses: 0, solde: 0, pour: [], contre: [] }]));
}

// `pour` / `contre` : le point à ajouter à la liste correspondante si le niveau est « améliorant » / « dégradant ».
function compter(s: Solde, niveau: NiveauProjection | null, pour?: Raison, contre?: Raison): void {
  if (niveau === null) return;
  s.analyses += 1;
  if (niveau === "ameliorant") {
    s.ameliorants += 1;
    if (pour) s.pour.push(pour);
  }
  if (niveau === "degradant") {
    s.degradants += 1;
    if (contre) s.contre.push(contre);
  }
  s.solde = s.ameliorants - s.degradants;
}

// Groupes (mots clés du résumé) qui couvrent les mesures de `ids`, dans l'ordre du résumé, une fois chacun. Une mesure absente du
// résumé (pas de résumé, ou résumé périmé) garde son titre : jamais de point sans rien à lire.
function titresMesures(ligne: LignePourSolde, ids: Set<string>): string[] {
  const titres: string[] = [];
  for (const p of ligne.propositions) if (ids.has(p.id) && !titres.includes(p.titre)) titres.push(p.titre);
  return titres;
}

// Un point du score pour ce candidat et ce thème : groupes et mesures qui le fondent.
function point(ligne: LignePourSolde, theme: string, ids: Set<string>): Raison {
  return { theme, groupes: groupes(ligne, ids), mesures: titresMesures(ligne, ids) };
}

function groupes(ligne: LignePourSolde, ids: Set<string>): string[] {
  const noms: string[] = [];
  const couverts = new Set<string>();
  for (const s of ligne.resume?.segments ?? []) {
    const touches = s.mesures.filter((id) => ids.has(id));
    const nom = s.texte.trim();
    if (touches.length === 0 || !nom) continue;
    touches.forEach((id) => couverts.add(id));
    if (!noms.includes(nom)) noms.push(nom);
  }
  for (const p of ligne.propositions) if (ids.has(p.id) && !couverts.has(p.id) && !noms.includes(p.titre)) noms.push(p.titre);
  return noms;
}

export function soldesSituation(cards: CardPourSolde[]): Solde[] {
  const soldes = soldesVides(cards);
  for (const card of cards) {
    for (const l of card.lignes) {
      const ids = new Set((l.projection?.effetsRetenus ?? []).map((e) => e.propositionId));
      const raison = point(l, card.theme.id, ids);
      // Un thème « améliorant » ne retient que des effets favorables, un thème « dégradant » que des défavorables.
      compter(soldes.get(l.meta.slug)!, l.projection?.niveau ?? null, raison, raison);
    }
  }
  return [...soldes.values()];
}

// Convictions : un constat par sujet choisi et par thème (voir engine/positions.ts). « Pas d'avis » n'entre pas dans le solde.
export function soldesConvictions(cards: CardPourSolde[], choix: ChoixPositions): Solde[] {
  const soldes = soldesVides(cards);
  for (const card of cards) {
    for (const l of card.lignes) {
      for (const [sujet, position] of Object.entries(choix)) {
        const constat = projeterPosition(sujet, position, l.propositions);
        const ids = (conforme: boolean) => new Set(constat.retenues.filter((r) => r.conforme === conforme).map((r) => r.propositionId));
        compter(
          soldes.get(l.meta.slug)!,
          constat.niveau,
          point(l, card.theme.id, ids(true)),
          point(l, card.theme.id, ids(false)),
        );
      }
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
  // Des candidats avec des données existent, mais l'intégrité les a TOUS écartés : ce n'est pas un manque de données.
  tousEcartes: boolean;
}

// Rien à désigner et rien à expliquer : aucun gagnant et personne d'écarté (aucun candidat n'a d'indicateur). Le résultat
// « convictions » est alors omis plutôt que de promettre un résultat qui n'existe pas.
export function sansDonnees(m: Meilleurs): boolean {
  return m.gagnants.length === 0 && m.ecartes === 0;
}

// Un candidat sans aucun indicateur (`analyses === 0`) n'est pas éligible : il gagnerait par simple absence de données.
// Une égalité n'est JAMAIS tranchée par l'ordre alphabétique : tous les ex æquo sont renvoyés.
export function meilleurs(soldes: Solde[], ecartes: ReadonlySet<string> = new Set()): Meilleurs | null {
  if (soldes.length === 0) return null;
  const retenus = soldes.filter((s) => !ecartes.has(s.slug));
  const eligibles = retenus.filter((s) => s.analyses > 0);
  const nombreEcartes = soldes.length - retenus.length;
  if (eligibles.length === 0) {
    const tousEcartes = soldes.some((s) => s.analyses > 0);
    return { solde: 0, gagnants: [], departageable: false, ecartes: nombreEcartes, tousEcartes };
  }
  const max = Math.max(...eligibles.map((s) => s.solde));
  const gagnants = eligibles.filter((s) => s.solde === max);
  const toutALegalite = gagnants.length === eligibles.length && eligibles.length > 1;
  return { solde: max, gagnants, departageable: !(toutALegalite && max === 0), ecartes: nombreEcartes, tousEcartes: false };
}

// Faits d'intégrité (voir data/integrite.ts) : seuls les candidats à condamnation définitive RECENSÉE sont écartés ; un
// candidat « non vérifié » n'est pas écarté (l'absence de donnée n'est pas une condamnation).
export function ecartesParIntegrite(integrites: Record<string, ConstatIntegrite> | null): Set<string> {
  const ecartes = new Set<string>();
  for (const [slug, constat] of Object.entries(integrites ?? {})) if (constat.etat === "recensee") ecartes.add(slug);
  return ecartes;
}
