import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import type { DocumentOfficiel } from "../types";
import type { FetchImpl } from "./checks";

// Récupération et extraction LOCALES des documents officiels : c'est notre code, pas le modèle, qui va
// chercher les pages. Le modèle ne reçoit ensuite que du texte (voir corpus.ts), sans outil web.

export type DocumentSource = DocumentOfficiel;

export interface TexteDocument extends DocumentSource {
  type: "html" | "pdf";
  texte: string;
  pages?: number;
  // Empreinte du texte extrait : sert à détecter qu'un programme a changé entre deux lectures.
  empreinte?: string;
}

export function empreinteTexte(texte: string): string {
  return createHash("sha256").update(texte).digest("hex").slice(0, 16);
}

export interface OptionsChargement {
  fetchImpl?: FetchImpl;
  dossierCache?: string;
  // Ignore le cache et refait la requête.
  actualiser?: boolean;
  // Injectable pour les tests.
  extracteurPdf?: (octets: Buffer) => Promise<TextePdf>;
}

const CACHE_PAR_DEFAUT = resolve(process.cwd(), "cache/sources");
const OCTETS_MAX = 60e6;
const CARACTERES_PAR_PAGE_MIN = 300;
// Mesuré sur le premier essai réel (deux PDF de programme, ~99 800 caractères = 46 214 jetons) : 2,16 caractères
// par jeton, contre 3,6 supposé au départ. On garde 2,2 : mieux vaut surestimer un coût que le sous-estimer.
const CARACTERES_PAR_JETON = 2.2;
const ENTITES: Record<string, string> = { nbsp: " ", amp: "&", quot: '"', apos: "'", rsquo: "'", lsquo: "'", laquo: "«", raquo: "»", hellip: "…", ndash: "–", mdash: "—", eacute: "é", egrave: "è", agrave: "à" };

export function estimerJetons(texte: string): number {
  return Math.round(texte.length / CARACTERES_PAR_JETON);
}

// HTML → texte : on garde une ligne par bloc (titre, paragraphe, item) pour que les extraits restent
// des phrases lisibles, on retire scripts, styles et balises, on décode les entités courantes.
export function extraireTexteHtml(html: string): string {
  return html
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|blockquote)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, nom) => ENTITES[nom.toLowerCase()] ?? m)
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type AnalyseurPdf = (octets: Buffer, options?: Parameters<typeof pdfParse>[1]) => Promise<{ numpages: number; text: string }>;

export interface TextePdf {
  texte: string;
  pages: number;
  imageSuspecte: boolean;
}

// `analyseur` est injectable pour les tests ; par défaut, pdf-parse.
export async function extraireTextePdf(octets: Buffer, analyseur: AnalyseurPdf = pdfParse): Promise<TextePdf> {
  const resultat = await analyseur(octets, {
    pagerender: async (page) => {
      const contenu = await page.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false });
      let derniereLigne: number | undefined;
      let texte = "";
      for (const element of contenu.items) {
        const y = element.transform[5];
        texte += derniereLigne === undefined || derniereLigne === y ? element.str : `\n${element.str}`;
        derniereLigne = y;
      }
      const numero = page.pageNumber ?? (page.pageIndex ?? 0) + 1;
      return `\n[[page ${numero}]]\n${texte}`;
    },
  });
  const sansRepere = resultat.text.replace(/\[\[page \d+\]\]/g, "");
  return {
    texte: resultat.text.trim(),
    pages: resultat.numpages,
    imageSuspecte: resultat.numpages > 0 && sansRepere.trim().length / resultat.numpages < CARACTERES_PAR_PAGE_MIN,
  };
}

function cheminCache(dossier: string, url: string): string {
  return resolve(dossier, createHash("sha256").update(url).digest("hex").slice(0, 24));
}

export async function chargerDocument(doc: DocumentSource, options: OptionsChargement = {}): Promise<TexteDocument> {
  const dossier = cheminCache(options.dossierCache ?? CACHE_PAR_DEFAUT, doc.url);
  const fichierTexte = resolve(dossier, "texte.txt");
  const fichierMeta = resolve(dossier, "meta.json");

  if (!options.actualiser && existsSync(fichierTexte) && existsSync(fichierMeta)) {
    const meta = JSON.parse(readFileSync(fichierMeta, "utf-8")) as { type: "html" | "pdf"; pages?: number; empreinte?: string };
    const texteCache = readFileSync(fichierTexte, "utf-8");
    return { ...doc, type: meta.type, pages: meta.pages, texte: texteCache, empreinte: meta.empreinte ?? empreinteTexte(texteCache) };
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const reponse = await fetchImpl(doc.url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; simulateur-presidentielle-2027)" } });
  if (!reponse.ok) throw new Error(`${doc.url} : HTTP ${reponse.status}`);
  const annonce = Number(reponse.headers.get("content-length")) || 0;
  if (annonce > OCTETS_MAX) throw new Error(`${doc.url} : document trop volumineux (${Math.round(annonce / 1e6)} Mo)`);
  const octets = Buffer.from(await reponse.arrayBuffer());
  if (octets.length > OCTETS_MAX) throw new Error(`${doc.url} : document trop volumineux (${Math.round(octets.length / 1e6)} Mo)`);

  // Le type annoncé n'est pas fiable : on reconnaît un PDF à ses premiers octets.
  const estPdf = octets.subarray(0, 5).toString("latin1") === "%PDF-";
  let texte: string;
  let pages: number | undefined;
  if (estPdf) {
    const extrait = await (options.extracteurPdf ?? extraireTextePdf)(octets);
    if (extrait.imageSuspecte) {
      throw new Error(`${doc.url} : PDF quasi sans texte (image scannée ?), OCR nécessaire — document exclu`);
    }
    texte = extrait.texte;
    pages = extrait.pages;
  } else {
    texte = extraireTexteHtml(octets.toString("utf-8"));
  }

  mkdirSync(dossier, { recursive: true });
  writeFileSync(fichierTexte, texte);
  writeFileSync(
    fichierMeta,
    JSON.stringify(
      { url: doc.url, type: estPdf ? "pdf" : "html", pages, caracteres: texte.length, empreinte: empreinteTexte(texte), recupere_le: new Date().toISOString() },
      null,
      2,
    ),
  );
  return { ...doc, type: estPdf ? "pdf" : "html", pages, texte, empreinte: empreinteTexte(texte) };
}
