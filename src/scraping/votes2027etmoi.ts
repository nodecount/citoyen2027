import type { Proposition, Source, Theme } from "../types";
import { dateEnClair, tronquer } from "../votes/conversion";

// Base « 2027etmoi » : les votes nominatifs des candidats au Parlement (jeu de données 2027etmoi, Licence Ouverte 2.0), lus par le
// même moteur que les mesures de programme. Un vote devient une proposition par candidat ; le texte voté est décrit une fois,
// et c'est le moteur (src/engine/sensDuVote.ts) qui inverse un vote « contre ».

export type PositionVote = "pour" | "contre" | "abstention" | "absent" | "non_votant";

export interface ScrutinSource {
  id: string;
  chambre: "AN" | "SENAT" | "PE";
  date: string;
  titre: string;
  type: string;
  resultat: string;
  url: string;
  votes: Record<string, PositionVote>;
}

export interface TexteLoi {
  texte: string;
  url: string;
  libelle: string;
}

// Une seule règle pour tous les candidats : ni le candidat ni son bord n'entrent dans la sélection. Sont écartés le Parlement
// européen (accès automatique refusé, textes très techniques), les motions de censure, les propositions de résolution et les
// déclarations du Gouvernement (aucun texte de loi, aucun effet direct sur un citoyen).
export function retenirScrutins(scrutins: ScrutinSource[]): ScrutinSource[] {
  return scrutins.filter(
    (s) => (s.chambre === "AN" || s.chambre === "SENAT") && s.type !== "motion_censure" && !/^(la |l['’])?(proposition de résolution|déclaration du gouvernement)/i.test(s.titre.trim()),
  );
}

// Pilote : ne garder que les votes des candidats demandés, et les scrutins où l'un d'eux a voté pour ou contre. Sans liste, rien ne
// change.
export function restreindreAuxCandidats(scrutins: ScrutinSource[], slugs: string[] | undefined): ScrutinSource[] {
  if (slugs === undefined) return scrutins;
  const restreints: ScrutinSource[] = [];
  for (const s of scrutins) {
    const votes = Object.fromEntries(Object.entries(s.votes).filter(([slug]) => slugs.includes(slug)));
    if (Object.values(votes).some((v) => v === "pour" || v === "contre")) restreints.push({ ...s, votes });
  }
  return restreints;
}

const TAILLE_LOT = 20;

// Le fichier ne donne pas de thème : le modèle choisit, pour chaque scrutin, un thème de la base d'après son titre, ou « aucun ».
// Le code valide chaque réponse ; un scrutin sans thème valide n'entre pas dans la base.
export async function classerScrutins(
  scrutins: ScrutinSource[],
  themes: Theme[],
  appeler: (prompt: string) => Promise<Record<string, string>>,
): Promise<Map<string, string>> {
  const valides = new Set(themes.map((t) => t.id));
  const carte = new Map<string, string>();
  for (let i = 0; i < scrutins.length; i += TAILLE_LOT) {
    const lot = scrutins.slice(i, i + TAILLE_LOT);
    const prompt = [
      "Pour chaque scrutin parlementaire ci-dessous, choisis le thème qui concerne le plus directement la vie d'un citoyen, ou « aucun » si le titre ne permet pas de choisir.",
      'Réponds par un objet JSON { "<id du scrutin>": "<id du thème ou aucun>" }.',
      "",
      "Thèmes :",
      ...themes.map((t) => `- ${t.id} : ${t.question_citoyen}`),
      "",
      "Scrutins :",
      ...lot.map((s) => `- ${s.id} : ${s.titre}`),
    ].join("\n");
    const reponse = await appeler(prompt);
    for (const s of lot) {
      const theme = reponse[s.id];
      if (typeof theme === "string" && valides.has(theme)) carte.set(s.id, theme);
    }
  }
  return carte;
}

const CHAMBRE: Record<string, { label: string; nom: string }> = {
  AN: { label: "Assemblée nationale", nom: "Assemblée nationale" },
  SENAT: { label: "Sénat", nom: "Sénat" },
};

// « Sur l'ensemble du projet de loi… » et « L'ensemble du projet de loi… » → « l'ensemble du projet de loi… », pour finir la phrase
// « X a voté pour … ».
function objetDuVote(titre: string): string {
  const net = titre.trim().replace(/\.$/, "").replace(/^sur\s+/i, "");
  return net.charAt(0).toLowerCase() + net.slice(1);
}

// Fenêtre de texte donnée au modèle pour UNE LOI ENTIÈRE : plus large que celle d'un article (2 500 caractères), car les
// dispositions qui touchent un citoyen sont rarement dans les premiers articles. Un texte plus long est coupé et le dit
// (hypothèse affichée).
export const LONGUEUR_MAX_LOI = 8000;

export interface RapportVotes {
  propositions: number;
  sansTexte: number;
  ignores: number;
}

export function convertirVotes(
  scrutins: ScrutinSource[],
  themeParScrutin: Map<string, string>,
  textes: Map<string, TexteLoi | null>,
  nomsCandidats: Record<string, string>,
  dateVerification: string,
): { parCandidat: Map<string, Proposition[]>; rapport: RapportVotes } {
  const parCandidat = new Map<string, Proposition[]>();
  const rapport: RapportVotes = { propositions: 0, sansTexte: 0, ignores: 0 };

  for (const s of scrutins) {
    const theme = themeParScrutin.get(s.id);
    if (theme === undefined) continue;
    const texte = textes.get(s.id) ?? null;
    const chambre = CHAMBRE[s.chambre];
    if (chambre === undefined) continue;
    const annee = Number(s.date.slice(0, 4));
    const { texte: extrait, tronque } = texte ? tronquer(texte.texte, LONGUEUR_MAX_LOI) : { texte: s.titre, tronque: false };
    const sources: Source[] = [{ type: "primaire", label: `${chambre.label} — scrutin public`, url: s.url, nom: `${chambre.nom} (scrutin)`, annee }];
    if (texte) sources.push({ type: "primaire", label: `${chambre.label} — texte de la loi (${texte.libelle})`, url: texte.url, nom: `${chambre.nom} (texte)`, annee });

    for (const [slug, position] of Object.entries(s.votes)) {
      if (position !== "pour" && position !== "contre") {
        rapport.ignores += 1;
        continue;
      }
      const nom = nomsCandidats[slug];
      if (nom === undefined) continue;
      const hypotheses = [
        `Vote nominatif de ${nom} : ${position} (résultat du scrutin : ${s.resultat}). Ce n'est pas un engagement de programme pour 2027.`,
        position === "contre" ? "Pour un vote contre, le moteur retient le contraire de l'effet du texte : refuser un effet n'est pas proposer l'effet inverse, c'est une hypothèse de lecture." : "",
        texte ? "" : "Texte de la loi non retrouvé : aucun effet ne peut être décrit.",
        tronque ? `Texte tronqué à ${LONGUEUR_MAX_LOI} caractères.` : "",
      ]
        .filter((phrase) => phrase !== "")
        .join(" ");
      const proposition: Proposition = {
        id: `${slug}-${theme}-${s.id}`,
        candidat: slug,
        theme,
        titre: `${nom} a voté ${position} ${objetDuVote(s.titre)}, le ${dateEnClair(s.date)}.`,
        resume_factuel: extrait,
        sources,
        chiffrage_disponible: false,
        hypotheses_calcul: hypotheses,
        statut: "partiel",
        date_derniere_verification: dateVerification,
        sous_theme: s.titre,
        titre_litteral: false,
        vote: position,
      };
      const liste = parCandidat.get(slug) ?? [];
      liste.push(proposition);
      parCandidat.set(slug, liste);
      rapport.propositions += 1;
      if (!texte) rapport.sansTexte += 1;
    }
  }
  return { parCandidat, rapport };
}
