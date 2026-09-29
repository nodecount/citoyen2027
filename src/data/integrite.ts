// Faits d'intégrité, par candidat : condamnations DÉFINITIVES seulement, attribuées, datées et sourcées (deux sources dont
// une primaire). Règle centrale : l'absence de donnée n'est JAMAIS une absence de condamnation — sans fichier valide,
// l'état est « non vérifié ». Voir docs/superpowers/specs/2026-09-29-convictions-design.md.

export interface SourceIntegrite {
  type: "primaire" | "secondaire";
  nom: string;
  annee: number;
  url: string;
}

export interface Condamnation {
  nature: string;
  juridiction: string;
  date_decision: string;
  peine: string;
  sources: SourceIntegrite[];
}

export interface Integrite {
  slug: string;
  verifie_le: string;
  sources_consultees: SourceIntegrite[];
  condamnations_definitives: Condamnation[];
}

export type ConstatIntegrite =
  | { etat: "non_verifie" }
  | { etat: "aucune_recensee"; verifieLe: string; sources: SourceIntegrite[] }
  | { etat: "recensee"; verifieLe: string; condamnations: Condamnation[] };

export const NON_VERIFIE: ConstatIntegrite = { etat: "non_verifie" };

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;
const texte = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const objet = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function erreursSource(source: unknown, chemin: string): string[] {
  if (!objet(source)) return [`${chemin} : source manquante`];
  const erreurs: string[] = [];
  if (source.type !== "primaire" && source.type !== "secondaire") erreurs.push(`${chemin}.type doit valoir primaire ou secondaire`);
  if (!texte(source.nom)) erreurs.push(`${chemin}.nom manquant`);
  if (!Number.isInteger(source.annee)) erreurs.push(`${chemin}.annee doit etre un entier`);
  if (!texte(source.url) || !/^https?:\/\//.test(source.url)) erreurs.push(`${chemin}.url doit commencer par http(s)://`);
  return erreurs;
}

function erreursCondamnation(c: unknown, chemin: string): string[] {
  if (!objet(c)) return [`${chemin} : condamnation manquante`];
  const erreurs: string[] = [];
  for (const champ of ["nature", "juridiction", "peine"] as const) if (!texte(c[champ])) erreurs.push(`${chemin}.${champ} manquant`);
  if (!texte(c.date_decision) || !DATE_ISO.test(c.date_decision)) erreurs.push(`${chemin}.date_decision doit etre AAAA-MM-JJ`);
  if (!Array.isArray(c.sources) || c.sources.length < 2) {
    erreurs.push(`${chemin}.sources : au moins deux sources sont requises`);
  } else {
    c.sources.forEach((s, i) => erreurs.push(...erreursSource(s, `${chemin}.sources[${i}]`)));
    if (!c.sources.some((s) => objet(s) && s.type === "primaire")) erreurs.push(`${chemin}.sources : au moins une source primaire est requise`);
  }
  return erreurs;
}

// Liste d'erreurs lisibles ; vide si le fichier est valide.
export function validerIntegrite(brut: unknown): string[] {
  if (!objet(brut)) return ["le fichier doit etre un objet"];
  const erreurs: string[] = [];
  if (!texte(brut.slug)) erreurs.push("slug manquant");
  if (!texte(brut.verifie_le) || !DATE_ISO.test(brut.verifie_le)) erreurs.push("verifie_le doit etre AAAA-MM-JJ");
  if (!Array.isArray(brut.sources_consultees) || brut.sources_consultees.length === 0) {
    erreurs.push("sources_consultees : au moins une source est requise");
  } else {
    brut.sources_consultees.forEach((s, i) => erreurs.push(...erreursSource(s, `sources_consultees[${i}]`)));
  }
  if (!Array.isArray(brut.condamnations_definitives)) {
    erreurs.push("condamnations_definitives doit etre une liste");
  } else {
    brut.condamnations_definitives.forEach((c, i) => erreurs.push(...erreursCondamnation(c, `condamnations_definitives[${i}]`)));
  }
  return erreurs;
}

export function constatIntegrite(integrite: Integrite | undefined): ConstatIntegrite {
  if (!integrite || validerIntegrite(integrite).length > 0) return NON_VERIFIE;
  if (integrite.condamnations_definitives.length > 0) {
    return { etat: "recensee", verifieLe: integrite.verifie_le, condamnations: integrite.condamnations_definitives };
  }
  return { etat: "aucune_recensee", verifieLe: integrite.verifie_le, sources: integrite.sources_consultees };
}

// Un fichier n'est retenu que s'il est valide ET si son slug est celui de son nom de fichier (jamais deviné).
export function chargerIntegrites(modules: Record<string, { default: unknown }>): Record<string, Integrite> {
  const charges: Record<string, Integrite> = {};
  for (const [chemin, module] of Object.entries(modules)) {
    const slug = chemin.split("/").pop()?.replace(/\.json$/, "");
    const brut = module.default;
    if (!slug || validerIntegrite(brut).length > 0) continue;
    if ((brut as Integrite).slug !== slug) continue;
    charges[slug] = brut as Integrite;
  }
  return charges;
}

const modulesIntegrite = import.meta.glob("../../data/integrite/*.json", { eager: true }) as Record<string, { default: unknown }>;
export const INTEGRITES: Record<string, Integrite> = chargerIntegrites(modulesIntegrite);
