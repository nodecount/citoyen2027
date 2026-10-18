import type { Proposition } from "../types";
import { PARTIS_GROUPES, positionDuGroupe, type DecompteGroupe } from "./groupes";
import type { LoiRetenue } from "./lois";

// Conversion d'un article clé voté en mesures de la base « votes » : une mesure par parti dont le groupe a voté POUR l'article
// (position nette, voir groupes.ts). Un vote CONTRE n'est pas converti : refuser une mesure n'est pas en proposer une autre, et le
// moteur ne sait décrire que ce qu'une mesure fait au citoyen. Le vote est attribué au GROUPE et daté, jamais présenté comme un
// engagement du candidat pour 2027 (règle d'attribution des positions de parti).
export interface ScrutinArticle {
  id: string; // VTANR5L17V1194
  date: string; // ISO
  pour: number;
  contre: number;
  abstention: number;
}

export interface ArticleVote {
  loi: LoiRetenue;
  scrutin: ScrutinArticle;
  article: string; // « 2 », « 3 bis »
  texteArticle: string;
  urlTexte: string;
  numeroTexte: string; // « T.A. n° 83 »
  decomptes: Record<string, DecompteGroupe>;
}

export const LONGUEUR_MAX_ARTICLE = 2500;

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export function dateEnClair(iso: string): string {
  // Les dates de l'Assemblée sont données à minuit heure de Paris (22 h ou 23 h UTC la veille) : +2 h les ramène au bon jour.
  const paris = new Date(new Date(iso).getTime() + 2 * 3600 * 1000);
  const jour = paris.getUTCDate();
  return `${jour === 1 ? "1er" : jour} ${MOIS[paris.getUTCMonth()]} ${paris.getUTCFullYear()}`;
}

export function numeroScrutin(id: string): string {
  return id.replace(/^.*V(\d+)$/, "$1");
}

// Coupe au dernier saut de ligne ou à la dernière phrase avant la limite, et le dit (hypothèse affichée).
export function tronquer(texte: string, max = LONGUEUR_MAX_ARTICLE): { texte: string; tronque: boolean } {
  if (texte.length <= max) return { texte, tronque: false };
  const coupe = texte.slice(0, max);
  const fin = Math.max(coupe.lastIndexOf("\n"), coupe.lastIndexOf(". "));
  return { texte: (fin > max * 0.5 ? coupe.slice(0, fin + 1) : coupe).trim(), tronque: true };
}

export interface RapportConversion {
  articles: number;
  mesures: number;
  parGroupe: Record<string, { pour: number; contre: number; partage: number; insuffisant: number }>;
  groupesNonRattaches: Record<string, number>;
}

export function convertir(entrees: ArticleVote[], dateVerification: string): { parCandidat: Map<string, Proposition[]>; rapport: RapportConversion } {
  const parCandidat = new Map<string, Proposition[]>();
  const rapport: RapportConversion = { articles: entrees.length, mesures: 0, parGroupe: {}, groupesNonRattaches: {} };
  const rattachement = new Map(PARTIS_GROUPES.map((p) => [p.groupe, p]));

  for (const e of entrees) {
    const annee = Number(e.scrutin.date.slice(0, 4));
    const { texte, tronque } = tronquer(e.texteArticle);
    for (const [groupe, decompte] of Object.entries(e.decomptes)) {
      const partie = rattachement.get(groupe);
      if (!partie) {
        rapport.groupesNonRattaches[groupe] = (rapport.groupesNonRattaches[groupe] ?? 0) + 1;
        continue;
      }
      const position = positionDuGroupe(decompte);
      const cpt = (rapport.parGroupe[groupe] ??= { pour: 0, contre: 0, partage: 0, insuffisant: 0 });
      cpt[position] += 1;
      if (position !== "pour") continue;

      const numero = numeroScrutin(e.scrutin.id);
      const proposition: Proposition = {
        id: `${partie.candidat}-${e.loi.theme}-v${numero}`,
        candidat: partie.candidat,
        theme: e.loi.theme,
        titre: `Le groupe ${groupe} (${partie.parti}) a voté pour l'article ${e.article} de la ${e.loi.intitule}, le ${dateEnClair(e.scrutin.date)}.`,
        resume_factuel: texte,
        sources: [
          { type: "primaire", label: `Assemblée nationale — texte adopté (${e.numeroTexte}), article ${e.article}`, url: e.urlTexte, nom: "Assemblée nationale (texte)", annee },
          { type: "primaire", label: `Assemblée nationale — scrutin public n° ${numero}`, url: `https://www.assemblee-nationale.fr/dyn/17/scrutins/${numero}`, nom: "Assemblée nationale (scrutin)", annee },
        ],
        chiffrage_disponible: false,
        hypotheses_calcul:
          `Vote du groupe ${groupe} : ${decompte.POUR} pour, ${decompte.CONTRE} contre, ${decompte.ABSTENTION} abstention(s) (groupe de chaque député à ce jour, et non à la date du vote). ` +
          `Un vote de groupe n'est pas un engagement de programme pour 2027${partie.reserve ? ` ; ${partie.reserve}` : ""}.` +
          (tronque ? ` Texte de l'article tronqué à ${LONGUEUR_MAX_ARTICLE} caractères.` : ""),
        statut: "partiel",
        date_derniere_verification: dateVerification,
        sous_theme: e.loi.intitule,
        titre_litteral: false,
      };
      const liste = parCandidat.get(partie.candidat) ?? [];
      liste.push(proposition);
      parCandidat.set(partie.candidat, liste);
      rapport.mesures += 1;
    }
  }
  return { parCandidat, rapport };
}
