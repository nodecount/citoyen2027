import { createHash } from "node:crypto";
import { empreinteTexte, estimerJetons, type TexteDocument } from "./documents";

// Corpus = le texte des documents officiels d'un candidat, balisé, donné au modèle en UN bloc mis en cache.
// Le modèle cite des extraits ; c'est le CODE qui les retrouve dans le texte extrait, qui en déduit la page,
// et qui fabrique les fenêtres de contexte pour la relecture.

// Au-delà, le coût d'un corpus relu douze fois et la dilution de l'attention ne se justifient plus :
// on scinde ou on retire des documents (voir docs/etude-sources-officielles).
export const JETONS_CORPUS_MAX = 150_000;
const LONGUEUR_MIN_EXTRAIT = 15; // en caractères normalisés : en dessous, l'extrait trouverait toujours une correspondance

export interface ResumeDocument {
  id: string;
  nom: string;
  annee: number;
  url: string;
  caracteres: number;
  jetons: number;
  empreinte: string;
}

export interface Corpus {
  texte: string;
  jetons: number;
  // Empreinte de l'ensemble des documents (identifiants + contenus, indépendante de l'ordre) : deux corpus de
  // même empreinte donnent les mêmes extractions, donc rien à refaire.
  empreinte: string;
  documents: ResumeDocument[];
  parId: Map<string, TexteDocument>;
}

export function construireCorpus(documents: TexteDocument[]): Corpus {
  const parId = new Map<string, TexteDocument>();
  const blocs: string[] = [];
  const resumes: ResumeDocument[] = [];
  for (const d of documents) {
    if (parId.has(d.id)) throw new Error(`Deux documents portent le même identifiant « ${d.id} » : une citation serait ambiguë`);
    parId.set(d.id, d);
    blocs.push(`<<<DOCUMENT ${d.id} | ${d.nom} | ${d.annee} | ${d.url}>>>\n${d.texte}\n<<<FIN DOCUMENT ${d.id}>>>`);
    resumes.push({ id: d.id, nom: d.nom, annee: d.annee, url: d.url, caracteres: d.texte.length, jetons: estimerJetons(d.texte), empreinte: d.empreinte ?? empreinteTexte(d.texte) });
  }
  const texte = blocs.join("\n\n");
  const jetons = estimerJetons(texte);
  if (jetons > JETONS_CORPUS_MAX) {
    throw new Error(
      `Corpus trop volumineux : ~${jetons} jetons pour une limite de ${JETONS_CORPUS_MAX}. Retirer des documents ou les scinder en deux corpus.`,
    );
  }
  const empreinte = createHash("sha256")
    .update(resumes.map((r) => `${r.id}:${r.empreinte}`).sort().join("|"))
    .digest("hex")
    .slice(0, 16);
  return { texte, jetons, empreinte, documents: resumes, parId };
}

// Normalisation avec correspondance de positions : chaque caractère normalisé garde l'indice du caractère
// d'origine, pour pouvoir dire OÙ (page, fenêtre) se trouve un extrait dans le texte réel.
function normaliserAvecPositions(texte: string): { norm: string; pos: number[] } {
  const norm: string[] = [];
  const pos: number[] = [];
  let separateur = true; // évite un espace en tête et les espaces doubles
  for (let i = 0; i < texte.length; i += 1) {
    const base = texte[i].normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    let ecrit = false;
    for (const c of base) {
      if (/[a-z0-9]/.test(c)) {
        norm.push(c);
        pos.push(i);
        ecrit = true;
        separateur = false;
      }
    }
    if (!ecrit && !separateur) {
      norm.push(" ");
      pos.push(i);
      separateur = true;
    }
  }
  while (norm.length > 0 && norm[norm.length - 1] === " ") {
    norm.pop();
    pos.pop();
  }
  return { norm: norm.join(""), pos };
}

function normaliser(texte: string): string {
  return normaliserAvecPositions(texte).norm;
}

export interface Localisation {
  trouve: boolean;
  page?: number;
  debut?: number;
  fin?: number;
}

// Deux morceaux d'une citation coupée par « … » doivent se suivre dans le document, à moins de cette distance
// (en caractères) : au-delà, la coupe relierait des passages sans rapport.
const ECART_MAX_ENTRE_MORCEAUX = 2500;
const LONGUEUR_MIN_MORCEAU = 8;

function chercher(norm: string, pos: number[], morceau: string, apres: number): { debut: number; fin: number } | null {
  const indice = norm.indexOf(morceau, apres);
  if (indice === -1) return null;
  return { debut: indice, fin: indice + morceau.length };
}

// Casse, accents, guillemets et ponctuation sont tolérés ; les mots, eux, doivent être identiques. Le texte des
// repères « [[page N]] » est ignoré pour ne pas casser un extrait à cheval sur deux pages. Une citation peut être
// abrégée par « … » ou « ... » (convention d'usage) : chaque morceau doit être recopié mot pour mot, dans l'ordre du
// document, à moins de ECART_MAX_ENTRE_MORCEAUX caractères du précédent.
export function localiserExtrait(document: TexteDocument, extrait: string): Localisation {
  const morceaux = extrait
    .split(/\.{3}|…/)
    .map((m) => normaliser(m))
    .filter((m) => m.length >= LONGUEUR_MIN_MORCEAU);
  const total = morceaux.reduce((somme, m) => somme + m.length, 0);
  if (morceaux.length === 0 || total < LONGUEUR_MIN_EXTRAIT) return { trouve: false };

  const sansRepere = document.texte.replace(/\[\[page \d+\]\]/g, (m) => " ".repeat(m.length));
  const { norm, pos } = normaliserAvecPositions(sansRepere);

  let curseur = 0;
  let premier: number | undefined;
  let dernierFin = 0;
  let finPrecedenteOriginale: number | undefined;
  for (const morceau of morceaux) {
    const trouve = chercher(norm, pos, morceau, curseur);
    if (!trouve) return { trouve: false };
    const debutOriginal = pos[trouve.debut];
    if (finPrecedenteOriginale !== undefined && debutOriginal - finPrecedenteOriginale > ECART_MAX_ENTRE_MORCEAUX) {
      return { trouve: false };
    }
    if (premier === undefined) premier = trouve.debut;
    dernierFin = trouve.fin;
    finPrecedenteOriginale = pos[trouve.fin - 1] + 1;
    curseur = trouve.fin;
  }

  const debut = pos[premier!];
  const fin = pos[dernierFin - 1] + 1;
  let page: number | undefined;
  if (document.type === "pdf") {
    for (const m of document.texte.slice(0, debut).matchAll(/\[\[page (\d+)\]\]/g)) page = Number(m[1]);
  }
  return { trouve: true, page, debut, fin };
}
// Extrait + contexte, dans le texte d'origine et borné aux limites du document.
// Marge de 1 500 caractères : à 600, le relecteur rejetait des mesures dont l'information se trouvait juste hors de la
// fenêtre (par exemple un objectif chiffré quelques lignes plus loin).
export function fenetreAutour(document: TexteDocument, debut: number, fin: number, marge = 1500): string {
  return document.texte.slice(Math.max(0, debut - marge), Math.min(document.texte.length, fin + marge));
}
