import type { ConstatIntegrite } from "../data/integrite";
import type { Proposition } from "../types";
import type { ChoixPositions } from "../positions";
import { projeterPosition } from "./positions";
import type { NiveauProjection } from "./projection";

// « Candidat idéal » : le SEUL endroit du produit où l'on désigne un candidat (exception décidée le 2026-09-30, voir
// CLAUDE.md). Règle publique et identique pour tous (décision du 2026-10-11, remplace le compte par thèmes) : score = nombre de
// MESURES favorables moins nombre de mesures défavorables à la situation (ou aux convictions), sans pourcentage ni pondération ; un
// thème « mixte » apporte ses mesures favorables d'un côté et ses défavorables de l'autre ; « non concerné » et l'absence d'indicateur
// n'apportent rien (un « mixte à préciser » compte ses effets déjà retenus).
export interface LignePourSolde {
  meta: { slug: string };
  projection: { niveau: NiveauProjection | null; effetsRetenus?: Array<{ propositionId: string; polarite?: "favorable" | "defavorable" }> } | null;
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

// Ce qui fonde le score pour un thème (situation) ou un sujet × thème (convictions) : les mesures elles-mêmes, et les GROUPES qui les
// rassemblent (mots clés du résumé du candidat, ceux numérotés en « Explorer les mesures » ; le titre de la mesure s'il n'y a pas de
// résumé). Le score compte les mesures ; les groupes n'en sont qu'une autre lecture, affichée à côté.
export interface Raison {
  // Identifiant du thème où le point compte (l'interface n'en montre que l'icône).
  theme: string;
  groupes: string[];
  // Titres des mesures elles-mêmes (une fois chacune), pour qui préfère les voir plutôt que leurs groupes.
  mesures: string[];
  // Adresse de la source de chaque mesure (titre → lien), quand elle en a une. Vide tant que le candidat est masqué : les cartes
  // anonymisées n'ont plus de source, l'adresse trahirait l'auteur.
  liens?: Record<string, string>;
}

export interface Solde {
  slug: string;
  // Nombres de mesures favorables et défavorables (chacune une fois par thème), et leur différence : le score.
  ameliorants: number;
  degradants: number;
  // Thèmes (situation) ou constats sujet × thème (convictions) où le candidat a un niveau : il n'est éligible que s'il y en a au moins un.
  analyses: number;
  solde: number;
  // Seulement pour le candidat idéal tous critères : la moyenne des notes (situation, convictions) sur 100, non arrondie. Alors
  // `solde` vaut cette moyenne et `ameliorants` / `degradants` additionnent les deux critères (affichage).
  noteMoyenne?: number;
  // Les mesures derrière le score ; un thème « mixte » figure dans les deux listes, avec ses seules mesures favorables d'un côté et
  // ses seules mesures défavorables de l'autre.
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

// Le score (décision du 2026-10-11) : la DIFFÉRENCE entre le nombre de mesures favorables et le nombre de mesures défavorables,
// sans pourcentage ni pondération. Une mesure n'est comptée qu'une fois par thème, de chaque côté (comme dans la fenêtre de détail).
// `analyses` (thèmes ou constats où le candidat a un niveau) ne sert plus qu'à savoir s'il a un résultat, donc s'il est éligible.
function mesurer(soldes: Map<string, Solde>): Solde[] {
  const distinctes = (points: Raison[]) => new Set(points.flatMap((p) => p.mesures.map((titre) => `${p.theme}|${titre}`))).size;
  for (const s of soldes.values()) {
    s.ameliorants = distinctes(s.pour);
    s.degradants = distinctes(s.contre);
    s.solde = s.ameliorants - s.degradants;
  }
  return [...soldes.values()];
}

// `pour` / `contre` : le point à ajouter à la liste correspondante si le niveau est « améliorant » / « dégradant ». Un « mixte » reçoit
// les deux points (ses mesures favorables d'un côté, défavorables de l'autre), y compris un « mixte à préciser » : ses effets déjà retenus comptent.
// Les nombres du score sont tirés de ces listes par `mesurer`.
function compter(s: Solde, niveau: NiveauProjection | null, pour?: Raison, contre?: Raison): void {
  if (niveau === null) return;
  s.analyses += 1;
  const mixte = niveau === "mixte";
  if ((niveau === "ameliorant" || mixte) && pour) s.pour.push(pour);
  if ((niveau === "degradant" || mixte) && contre) s.contre.push(contre);
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
  const liens = liensMesures(ligne, ids);
  return { theme, groupes: groupes(ligne, ids), mesures: titresMesures(ligne, ids), ...(Object.keys(liens).length > 0 ? { liens } : {}) };
}

// Lien vers la source de chaque mesure : la source primaire d'abord, à défaut la première qui a une adresse.
function liensMesures(ligne: LignePourSolde, ids: Set<string>): Record<string, string> {
  const liens: Record<string, string> = {};
  for (const p of ligne.propositions) {
    if (!ids.has(p.id) || liens[p.titre]) continue;
    const source = p.sources.find((s) => s.type === "primaire" && s.url) ?? p.sources.find((s) => s.url);
    if (source) liens[p.titre] = source.url;
  }
  return liens;
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
      const retenus = l.projection?.effetsRetenus ?? [];
      const niveau = l.projection?.niveau ?? null;
      const ids = (garde: (e: { polarite?: string }) => boolean) => new Set(retenus.filter(garde).map((e) => e.propositionId));
      // Un thème « améliorant » ne retient que des effets favorables, un thème « dégradant » que des défavorables : tous comptent.
      // Un « mixte » répartit ses mesures retenues entre les deux listes, favorables d'un côté et défavorables de l'autre. Cela vaut aussi
      // pour un « mixte à préciser » : les effets déjà retenus sont certains pour ce visiteur, seul le reste du thème attend une réponse.
      const favorables = ids((e) => e.polarite === "favorable");
      const defavorables = ids((e) => e.polarite === "defavorable");
      if (niveau === "mixte") {
        compter(
          soldes.get(l.meta.slug)!,
          niveau,
          favorables.size > 0 ? point(l, card.theme.id, favorables) : undefined,
          defavorables.size > 0 ? point(l, card.theme.id, defavorables) : undefined,
        );
      } else {
        const raison = point(l, card.theme.id, ids(() => true));
        compter(soldes.get(l.meta.slug)!, niveau, raison, raison);
      }
    }
  }
  return mesurer(soldes);
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
  return mesurer(soldes);
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

// Candidat idéal « toutes critères confondus » (décision du 2026-10-10) : le score de la situation PLUS celui des convictions,
// candidat par candidat, sans pondération (même règle, simplement additionnée). Sans convictions, c'est la situation seule.
export function combiner(situation: Solde[], convictions: Solde[]): Solde[] {
  const parSlug = new Map(convictions.map((s) => [s.slug, s]));
  return situation.map((s) => {
    const c = parSlug.get(s.slug);
    if (!c) return s;
    return {
      slug: s.slug,
      ameliorants: s.ameliorants + c.ameliorants,
      degradants: s.degradants + c.degradants,
      analyses: s.analyses + c.analyses,
      solde: s.solde + c.solde,
      pour: [...s.pour, ...c.pour],
      contre: [...s.contre, ...c.contre],
    };
  });
}

// Le 100 d'un critère : le plus grand nombre de mesures qui touchent le visiteur (favorables + défavorables) chez un seul candidat,
// tous candidats confondus (écartés compris : la référence ne bouge pas selon eux).
export function referenceDuCent(soldes: Solde[]): number {
  return Math.max(0, ...soldes.map((s) => s.ameliorants + s.degradants));
}

// Candidat idéal tous critères (décision du 2026-11-01, remplace l'addition des points bruts) : chaque critère est d'abord noté sur
// 100 avec SA référence, puis les deux notes sont moyennées. Un critère qui compte beaucoup plus de mesures que l'autre ne l'écrase
// donc plus. Le classement suit la moyenne non arrondie (les scores négatifs gardent leur ordre). Un candidat sans résultat
// « convictions » garde sa seule note de situation.
export function combinerParNotes(situation: Solde[], convictions: Solde[]): Solde[] {
  const refSituation = Math.max(1, referenceDuCent(situation));
  const refConvictions = Math.max(1, referenceDuCent(convictions));
  const parSlug = new Map(convictions.map((s) => [s.slug, s]));
  return situation.map((s) => {
    const c = parSlug.get(s.slug);
    const noteS = (s.solde / refSituation) * 100;
    if (!c) return { ...s, solde: noteS, noteMoyenne: noteS };
    const moyenne = (noteS + (c.solde / refConvictions) * 100) / 2;
    return { ...combiner([s], [c])[0], solde: moyenne, noteMoyenne: moyenne };
  });
}

// Le détail d'un critère pour UN candidat, tel qu'il entre dans la moyenne : les mesures dans le sens du visiteur et à l'opposé, le
// score, la référence du 100 et la note qui en découle (non arrondie et non bornée : c'est la valeur réellement moyennée).
export interface DetailCritere {
  ameliorants: number;
  degradants: number;
  score: number;
  reference: number;
  noteBrute: number;
  pour: Raison[];
  contre: Raison[];
}

export interface DetailCriteres {
  situation?: DetailCritere;
  convictions?: DetailCritere;
}

// Les deux notes d'un candidat, pour que le visiteur puisse refaire la moyenne lui-même. Même référence que `combinerParNotes`.
// Un critère absent (`null` ou candidat introuvable) n'est pas renvoyé.
export function detailCriteres(slug: string, situation: Solde[] | null, convictions: Solde[] | null): DetailCriteres {
  const detail = (soldes: Solde[] | null): DetailCritere | undefined => {
    const s = soldes?.find((x) => x.slug === slug);
    if (!soldes || !s) return undefined;
    const reference = Math.max(1, referenceDuCent(soldes));
    return { ameliorants: s.ameliorants, degradants: s.degradants, score: s.solde, reference, noteBrute: (s.solde / reference) * 100, pour: s.pour, contre: s.contre };
  };
  return { situation: detail(situation), convictions: detail(convictions) };
}

// Trois façons de compter le même résultat, pour les comparer dans la page « Tests de situations » (le produit utilise les mesures) :
// les mesures (règle du produit depuis le 2026-10-11), les groupes de mesures, ou les thèmes (ancienne règle, +1 / −1 par thème ou
// par sujet × thème). Toujours favorables moins défavorables ; un groupe ou une mesure n'est compté qu'une fois par thème.
export type Prisme = "mesures" | "groupes" | "themes";

export function selonPrisme(s: Solde, prisme: Prisme): Solde {
  const compter = (points: Raison[]) =>
    prisme === "themes"
      ? points.length
      : new Set(points.flatMap((p) => (prisme === "groupes" ? p.groupes : p.mesures).map((nom) => `${p.theme}|${nom}`))).size;
  const ameliorants = compter(s.pour);
  const degradants = compter(s.contre);
  // Le candidat idéal tous critères garde sa moyenne de notes dans le prisme des mesures (celui du produit).
  return { ...s, ameliorants, degradants, solde: prisme === "mesures" && s.noteMoyenne !== undefined ? s.noteMoyenne : ameliorants - degradants };
}

export interface Classe {
  solde: Solde;
  // 1 pour le meilleur score, puis 2, 3… sans trou : les ex æquo partagent la même place (1, 1, 2, 3…).
  rang: number;
  // Score noté sur 100 (décision du 2026-10-11) : le score du candidat rapporté au nombre de mesures qui touchent le visiteur
  // (favorables + défavorables) chez le candidat qui en a le plus (100 = ce nombre : toutes favorables). Jamais négatif : un score nul ou négatif vaut 0. Sert à la barre des tops ; le classement, lui, suit le score brut.
  note: number;
  // La référence du 100 : le plus grand nombre de mesures qui touchent le visiteur chez un seul candidat (voir `classement`).
  reference: number;
}

export function noteSur100(score: number, reference: number): number {
  return Math.min(100, Math.max(0, Math.round((score / Math.max(1, reference)) * 100)));
}

// Le top de `taille` PLACES (mêmes règles que `meilleurs` : ni écartés, ni sans indicateur). Les candidats à égalité de score
// occupent la même place et sont tous gardés : une égalité n'est jamais tranchée, ni par l'ordre alphabétique ni par la coupe.
// L'ordre à score égal est celui des données ; l'interface le range par lettre anonyme, sans rapport avec l'identité.
// `referenceImposee` : 100 pour le candidat idéal tous critères, dont le `solde` est déjà une note sur 100 (voir combinerParNotes).
export function classement(soldes: Solde[], ecartes: ReadonlySet<string> = new Set(), taille = 3, referenceImposee?: number): Classe[] {
  const tries = soldes.filter((s) => !ecartes.has(s.slug) && s.analyses > 0).sort((a, b) => b.solde - a.solde);
  const scores = [...new Set(tries.map((s) => s.solde))];
  // La référence du 100 : le plus grand nombre de mesures qui touchent le visiteur (favorables + défavorables) parmi TOUS les
  // candidats (écartés compris : elle ne bouge pas selon eux). Elle suit donc les réponses du visiteur.
  const reference = referenceImposee ?? referenceDuCent(soldes);
  return tries
    .map((s) => ({ solde: s, rang: scores.indexOf(s.solde) + 1, note: noteSur100(s.solde, reference), reference }))
    .filter((c) => c.rang <= taille);
}

// Faits d'intégrité (voir data/integrite.ts) : seuls les candidats à condamnation définitive RECENSÉE sont écartés ; un
// candidat « non vérifié » n'est pas écarté (l'absence de donnée n'est pas une condamnation).
export function ecartesParIntegrite(integrites: Record<string, ConstatIntegrite> | null): Set<string> {
  const ecartes = new Set<string>();
  for (const [slug, constat] of Object.entries(integrites ?? {})) if (constat.etat === "recensee") ecartes.add(slug);
  return ecartes;
}
