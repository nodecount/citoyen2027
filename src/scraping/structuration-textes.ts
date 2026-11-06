import { createHash } from "node:crypto";
import type { Effet } from "../effets";
import { localiserExtrait } from "../ingestion/corpus";
import type { Proposition } from "../types";
import { empreintePrompts, structurerGroupe, type EntreeStructuration, type OutilsAppel } from "./structuration";
import { PanneCli } from "./claude-cli";

// Base « 2027etmoi » : les effets d'un VOTE sont ceux de la LOI votée, pas ceux du votant. Une loi est donc lue une seule fois,
// en entier (passage par passage), et ses effets sont donnés à tous ceux qui l'ont votée, pour comme contre : c'est le moteur
// (src/engine/sensDuVote.ts) qui lit un « contre » à l'envers. Avant, chaque votant repassait la même loi par le modèle, et
// seul le début (8 000 caractères) en était lu.

export const TAILLE_PASSAGE = 12_000;
// Plafond de lecture d'une loi (lois de finances, codes) : au-delà, le début seulement, et la mesure le dit.
export const LECTURE_MAX = 400_000;
// Passages envoyés ensemble au modèle (≈ 100 000 caractères par appel).
export const PASSAGES_PAR_APPEL = 8;

const NOM_LECTEUR = "le texte d'une loi votée au Parlement";
const REPERE_PASSAGES = "\n\n[Passages retenus plus loin dans la loi]\n";

export function decouperEnPassages(texte: string, taille: number = TAILLE_PASSAGE): { passages: string[]; tronque: boolean } {
  const tronque = texte.length > LECTURE_MAX;
  const lu = tronque ? texte.slice(0, LECTURE_MAX) : texte;
  const passages: string[] = [];
  let courant: string[] = [];
  let longueur = 0;
  const vider = () => {
    if (courant.length > 0) passages.push(courant.join("\n"));
    courant = [];
    longueur = 0;
  };
  for (const ligne of lu.split("\n")) {
    if (ligne.length > taille) {
      vider();
      for (let i = 0; i < ligne.length; i += taille) passages.push(ligne.slice(i, i + taille));
      continue;
    }
    if (courant.length > 0 && longueur + 1 + ligne.length > taille) vider();
    longueur += (courant.length > 0 ? 1 : 0) + ligne.length;
    courant.push(ligne);
  }
  vider();
  return { passages, tronque };
}

function cleEffet(e: Effet): string {
  const cibles = [...e.cibles].map((c) => ({ champ: c.champ, valeurs: [...c.valeurs].sort() })).sort((a, b) => a.champ.localeCompare(b.champ));
  return JSON.stringify([cibles, e.dimension, e.sens]);
}

// Deux passages d'une même loi peuvent décrire le même effet : un seul exemplaire (le premier, avec son extrait).
export function fusionnerEffets(listes: Effet[][]): Effet[] {
  const vus = new Set<string>();
  const fusion: Effet[] = [];
  for (const e of listes.flat()) {
    const cle = cleEffet(e);
    if (vus.has(cle)) continue;
    vus.add(cle);
    fusion.push(e);
  }
  return fusion;
}

// Change dès que le texte de la loi, la taille de lecture ou les prompts changent : la loi est alors à refaire.
export function empreinteTexte(texte: string): string {
  return createHash("sha256").update(empreintePrompts()).update(`\n${TAILLE_PASSAGE}/${LECTURE_MAX}\n`).update(texte).digest("hex").slice(0, 16);
}

// Nom du fichier où la récolte garde le texte complet d'une loi (cache hors dépôt), d'après l'adresse de son scrutin.
export function nomFichierTexte(urlScrutin: string): string {
  return `${createHash("sha1").update(urlScrutin).digest("hex")}.txt`;
}

export interface EffetsDuTexte {
  empreinte: string;
  passages: number;
  tronque: boolean;
  effets: Effet[];
  date: string;
  cout_reference_usd: number;
}

export type JournalTextes = Record<string, EffetsDuTexte>;

export interface TexteAStructurer {
  url: string;
  theme: string;
  texte: string;
}

// Une loi = une adresse de scrutin (première source de la mesure), quel que soit le candidat.
export function scrutinsDistincts(propositions: Proposition[]): Array<{ url: string; theme: string }> {
  const vus = new Map<string, string>();
  for (const p of propositions) {
    const url = p.sources[0]?.url;
    if (url !== undefined && !vus.has(url)) vus.set(url, p.theme);
  }
  return [...vus].map(([url, theme]) => ({ url, theme }));
}

export interface OptionsTextes {
  force?: boolean;
  concurrence?: number;
  plafondRefUsd?: number;
}

export interface ResultatTextes {
  journal: JournalTextes;
  faits: number;
  coutReferenceUsd: number;
  erreurs: Array<{ url: string; message: string }>;
  arret: "panne" | "plafond" | null;
  messageArret?: string;
}

async function lireUneLoi(texte: TexteAStructurer, themeLibelle: string, outils: OutilsAppel): Promise<{ effets: Effet[]; passages: number; tronque: boolean; cout: number }> {
  const { passages, tronque } = decouperEnPassages(texte.texte);
  const entrees: EntreeStructuration[] = passages.map((p, i) => ({ id: `p${i + 1}`, texte: p, url: texte.url }));
  const parPassage: Effet[][] = [];
  let cout = 0;
  for (let i = 0; i < entrees.length; i += PASSAGES_PAR_APPEL) {
    const rapport = await structurerGroupe(NOM_LECTEUR, themeLibelle, entrees.slice(i, i + PASSAGES_PAR_APPEL), outils);
    cout += rapport.coutReferenceUsd;
    // Un passage refusé (extrait introuvable, relecture) perd ses effets, mais pas ceux des autres passages.
    for (const r of rapport.resultats.values()) if (r.statut === "structuree") parPassage.push(r.effets);
  }
  return { effets: fusionnerEffets(parPassage), passages: passages.length, tronque, cout };
}

export async function decrireLesTextes(
  textes: TexteAStructurer[],
  journalInitial: JournalTextes,
  themeLibelle: (themeId: string) => string,
  outils: OutilsAppel,
  options: OptionsTextes = {},
  journaliser: (ligne: string) => void = () => undefined,
): Promise<ResultatTextes> {
  const resultat: ResultatTextes = { journal: { ...journalInitial }, faits: 0, coutReferenceUsd: 0, erreurs: [], arret: null };
  const file = textes.filter((t) => options.force === true || resultat.journal[t.url]?.empreinte !== empreinteTexte(t.texte));
  const plafond = options.plafondRefUsd ?? Infinity;

  async function travailleur(): Promise<void> {
    for (;;) {
      if (resultat.arret) return;
      if (resultat.coutReferenceUsd >= plafond) {
        resultat.arret = "plafond";
        resultat.messageArret = `Plafond de coût de référence atteint (${resultat.coutReferenceUsd.toFixed(2)} $ sur ${plafond} $).`;
        return;
      }
      const texte = file.shift();
      if (!texte) return;
      try {
        const lu = await lireUneLoi(texte, themeLibelle(texte.theme), outils);
        resultat.journal[texte.url] = {
          empreinte: empreinteTexte(texte.texte),
          passages: lu.passages,
          tronque: lu.tronque,
          effets: lu.effets,
          date: new Date().toISOString().slice(0, 10),
          cout_reference_usd: Number(lu.cout.toFixed(4)),
        };
        resultat.coutReferenceUsd += lu.cout;
        resultat.faits += 1;
        journaliser(`[loi] ${texte.url} : ${lu.passages} passage(s) → ${lu.effets.length} effet(s) (${lu.cout.toFixed(3)} $ de référence, cumul ${resultat.coutReferenceUsd.toFixed(2)} $)`);
      } catch (erreur) {
        const message = erreur instanceof Error ? erreur.message : String(erreur);
        if (erreur instanceof PanneCli) {
          resultat.arret = "panne";
          resultat.messageArret = message;
          return;
        }
        resultat.erreurs.push({ url: texte.url, message });
        journaliser(`[erreur] ${texte.url} : ${message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, options.concurrence ?? 3) }, () => travailleur()));
  return resultat;
}

// Toutes les mesures d'un candidat : celles dont la loi est décrite reçoivent ses effets ; celles sans texte de loi (une seule
// source : le scrutin) sont « analysées, sans effet » sans appel ; les autres attendent leur description.
export function appliquerAuxMesures(propositions: Proposition[], journal: JournalTextes): Proposition[] {
  return propositions.map((p) => {
    const decrit = journal[p.sources[0]?.url ?? ""];
    if (decrit) return appliquerEffetsDuTexte(p, decrit);
    return p.sources.length < 2 ? { ...p, effets: [] } : p;
  });
}

// Donne à une mesure les effets de sa loi. Le texte affiché reste le début de la loi, suivi des passages cités plus loin (sinon un
// extrait pris au milieu de la loi ne serait pas retrouvable dans la mesure). Rejouable sans doublon.
export function appliquerEffetsDuTexte(p: Proposition, decrit: EffetsDuTexte): Proposition {
  const debut = p.resume_factuel.split(REPERE_PASSAGES)[0];
  const document = { id: p.id, url: p.sources[0]?.url ?? "", nom: "loi", annee: 0, type: "html" as const, texte: debut };
  const ajouts = [...new Set(decrit.effets.map((e) => e.extrait))].filter((extrait) => !localiserExtrait(document, extrait).trouve);
  const hypotheses = p.hypotheses_calcul
    .replace(/\s?Loi lue en [\s\S]*$/, "")
    .replace(/\s?Texte tronqué à \d+ caractères\./, "")
    .trim();
  const lecture = decrit.tronque
    ? `Loi lue en ${decrit.passages} passages, début de la loi seulement (plafond de lecture : ${LECTURE_MAX} caractères) ; le texte affiché est abrégé.`
    : `Loi lue en ${decrit.passages} passage${decrit.passages > 1 ? "s" : ""}, les effets viennent de l'ensemble du texte ; le texte affiché est abrégé.`;
  return {
    ...p,
    effets: decrit.effets,
    resume_factuel: ajouts.length > 0 ? `${debut}${REPERE_PASSAGES}${ajouts.join("\n")}` : debut,
    hypotheses_calcul: `${hypotheses} ${lecture}`.trim(),
  };
}
