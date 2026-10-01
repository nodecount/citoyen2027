import type { CandidatMeta } from "../types";
import type { CardTheme, LigneCandidat } from "./cards";

// Mode « à l'aveugle » : le simulateur sans l'identité des candidats, pour lire les indicateurs sans être influencé par un
// nom. Fonction pure appliquée aux cartes déjà calculées : le moteur ne voit jamais la différence (l'indicateur ne
// dépend que des mesures), seul l'affichage change.
//  - chaque candidat devient « Candidat A », « B »… ; les lettres sont tirées au hasard (`graine`) pour que l'ordre
//    alphabétique ne trahisse pas l'identité, et restent les mêmes d'un thème à l'autre pour suivre un même candidat ;
//  - les noms (de tous les candidats, pas seulement du candidat lu) et les partis sont remplacés dans les textes ;
//  - photos et sources (dont le nom et l'adresse trahissent l'auteur) ne sont pas affichées.
// Limite assumée : seuls les noms et partis connus sont remplacés ; une mesure très reconnaissable ou un dérivé du nom
// (« lepéniste »…) peut encore mettre sur la voie.

export const PREFIXE_ANONYME = "anonyme-";

export interface Correspondance {
  lettre: string;
  nom: string;
  slug: string;
  parti: string;
}

const MOTS_OUTILS = new Set(["de", "du", "des", "le", "la", "les", "van", "von", "der", "den", "el", "al"]);
const echapper = (texte: string) => texte.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function empreinte(texte: string): number {
  let h = 2166136261;
  for (const c of texte) h = Math.imul(h ^ c.codePointAt(0)!, 16777619) >>> 0;
  return h;
}

const lettreDuRang = (rang: number) => (rang < 26 ? String.fromCharCode(65 + rang) : String(rang + 1));

// Remplace noms (nom complet, puis chacun de ses mots) et partis, dans tous les textes affichés.
export function fabriquerEpurateur(metas: CandidatMeta[]): (texte: string) => string {
  const genre = new Map<string, "nom" | "parti">();
  for (const meta of metas) {
    // Nom complet et ses fins (« Marine Le Pen », « Le Pen »), puis chaque mot significatif (« Marine », « Pen »).
    const mots = meta.nom.split(/\s+/);
    const fins = mots.map((_, i) => mots.slice(i).join(" "));
    const variantes = [...fins, ...meta.nom.split(/[\s-]+/).filter((mot) => mot.length >= 3 && !MOTS_OUTILS.has(mot.toLowerCase()))];
    for (const v of variantes) {
      genre.set(v, "nom");
      genre.set(v.toLocaleUpperCase("fr"), "nom");
    }
    const parti = meta.parti.trim();
    if (parti && !/^non renseign/i.test(parti)) genre.set(parti, "parti");
  }
  if (genre.size === 0) return (texte) => texte;
  const motif = [...genre.keys()].sort((a, b) => b.length - a.length).map(echapper).join("|");
  const regex = new RegExp(`(?<![\\p{L}\\p{N}])(?:${motif})(?![\\p{L}\\p{N}])`, "gu");
  return (texte) =>
    texte
      .replace(regex, (trouve, position: number) => {
        const remplacement = genre.get(trouve) === "parti" ? "son parti" : "le candidat";
        const debutDePhrase = position === 0 || /[.!?]\s+$/.test(texte.slice(0, position));
        return debutDePhrase ? remplacement.charAt(0).toUpperCase() + remplacement.slice(1) : remplacement;
      })
      .replace(/\b(parti|groupe|mouvement) son parti\b/gi, "$1")
      .replace(/\bde le candidat/g, "du candidat")
      .replace(/\bDe le candidat/g, "Du candidat")
      .replace(/\bà le candidat/g, "au candidat");
}

export function anonymiserCards(cards: CardTheme[], graine: number): { cards: CardTheme[]; correspondance: Correspondance[] } {
  const metas = new Map<string, CandidatMeta>();
  for (const card of cards) for (const m of [...card.lignes.map((l) => l.meta), ...card.absents]) metas.set(m.slug, m);
  const ordre = [...metas.keys()].sort((a, b) => empreinte(`${graine}:${a}`) - empreinte(`${graine}:${b}`));
  const rang = new Map(ordre.map((slug, i) => [slug, i]));
  const epurer = fabriquerEpurateur([...metas.values()]);

  const anonyme = (meta: CandidatMeta): CandidatMeta => {
    const lettre = lettreDuRang(rang.get(meta.slug)!);
    return { slug: `${PREFIXE_ANONYME}${lettre}`, nom: `Candidat ${lettre}`, parti: "", sources_officielles: [], date_derniere_maj: "" };
  };

  // Les identifiants de mesures commencent par le nom du candidat : renumérotés, partout où ils sont cités.
  const nouveauxIds = new Map<string, string>();
  const id = (ancien: string) => {
    if (!nouveauxIds.has(ancien)) nouveauxIds.set(ancien, `mesure-${nouveauxIds.size + 1}`);
    return nouveauxIds.get(ancien)!;
  };
  const sansSource = <T extends { extrait: string }>(effet: T): T => ({ ...effet, extrait: epurer(effet.extrait), source_url: "" });

  const ligneAnonyme = (l: LigneCandidat): LigneCandidat => {
    const meta = anonyme(l.meta);
    return {
      meta,
      propositions: l.propositions.map((p) => ({
        ...p,
        id: id(p.id),
        candidat: meta.nom,
        titre: epurer(p.titre),
        resume_factuel: epurer(p.resume_factuel),
        hypotheses_calcul: epurer(p.hypotheses_calcul),
        sous_theme: p.sous_theme === undefined ? undefined : epurer(p.sous_theme),
        sources: [],
        effets: p.effets?.map(sansSource),
        // Les étiquettes de position portent aussi l'adresse de la source (qui trahit l'auteur) et un extrait à épurer.
        positions: p.positions?.map(sansSource),
      })),
      projection: l.projection && {
        ...l.projection,
        effetsRetenus: l.projection.effetsRetenus.map((r) => ({ ...r, propositionId: id(r.propositionId), effet: sansSource(r.effet) })),
      },
      messagesSansBadge: l.messagesSansBadge.map(epurer),
      messagesIncertitude: l.messagesIncertitude.map(epurer),
      messagesEffetsExclus: l.messagesEffetsExclus.map(epurer),
      synthese: l.synthese && { ...l.synthese, texte: epurer(l.synthese.texte), propositions: l.synthese.propositions.map(id) },
      resume: l.resume && {
        ...l.resume,
        propositions: l.resume.propositions.map(id),
        segments: l.resume.segments.map((s) => ({ texte: epurer(s.texte), mesures: s.mesures.map(id) })),
      },
      sources: [],
      remarques: l.remarques.map((r) => ({ ...r, texte: epurer(r.texte), mesures: r.mesures.map(id) })),
    };
  };

  const rangDe = (l: LigneCandidat) => rang.get(l.meta.slug)!;
  return {
    cards: cards.map((card) => ({
      ...card,
      lignes: [...card.lignes].sort((a, b) => rangDe(a) - rangDe(b)).map(ligneAnonyme),
      absents: card.absents.map(anonyme),
    })),
    correspondance: ordre.map((slug, i) => ({ lettre: lettreDuRang(i), nom: metas.get(slug)!.nom, slug, parti: metas.get(slug)!.parti })),
  };
}
