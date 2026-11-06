import { htmlEnTexte } from "../votes/texte";
import type { ScrutinSource, TexteLoi } from "./votes2027etmoi";

// Retrouver le texte d'une loi à partir de la page officielle de son scrutin : page du scrutin → dossier législatif → texte adopté.
// Les fonctions de lecture de page sont pures (HTML en entrée) ; seul `trouver…` touche au réseau, par le `telecharger` qu'on lui
// passe. Une page introuvable ou illisible donne `null` : la mesure garde alors son titre et reste sans effet.

export type Telecharger = (url: string) => Promise<string>;

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

// Première date en toutes lettres du texte (en tête d'un texte adopté : la date d'adoption), au format AAAA-MM-JJ.
export function dateDuTexte(html: string): string | null {
  // L'en-tête d'un texte adopté rappelle « CONSTITUTION DU 4 OCTOBRE 1958 » avant la date d'adoption : on l'ignore.
  const texte = htmlEnTexte(html).slice(0, 4000).replace(/CONSTITUTION\s+DU\s+\d+\s*(?:er)?\s+\S+\s+\d{4}/i, " ");
  const m = texte.match(new RegExp(`(\\d{1,2})\\s*(?:er)?\\s+(${MOIS.join("|")})\\s+(\\d{4})`, "i"));
  if (!m) return null;
  const mois = MOIS.indexOf(m[2].toLowerCase()) + 1;
  return `${m[3]}-${String(mois).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

// ─── Assemblée nationale ────────────────────────────────────────────────────────────────────────────────────────────────────
// La page d'un scrutin porte un lien /dyn/<législature>/dossiers/<nom> ; la page du dossier liste ses textes, chaque lien portant
// l'identifiant exact du document (data-document-id, ex. PRJLANR5L15BTA0061) lisible sur /dyn/opendata/<identifiant>.html.

export function lienDossierAN(pageScrutin: string, base: string): string | null {
  const m = pageScrutin.match(/href="(\/dyn\/\d+\/dossiers\/[^"]+)"/);
  return m ? `${base}${m[1]}` : null;
}

// Textes adoptés en séance du dossier, dans l'ordre de la page (chronologique), sans doublon. Ni le projet déposé ni les textes de
// commission : seul le texte adopté en séance correspond à un vote en séance.
export function documentsAdoptesAN(pageDossier: string): string[] {
  const ids: string[] = [];
  for (const m of pageDossier.matchAll(/<a\b[^>]*href="[^"]*_texte-adopte-seance"[^>]*>/g)) {
    const id = m[0].match(/data-document-id="([^"]+)"/)?.[1];
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

function adresseTexteAN(base: string, id: string): { url: string; libelle: string } | null {
  const m = id.match(/L(\d+)BTA(\d+)$/);
  if (!m) return null;
  return { url: `${base}/dyn/${m[1]}/textes/l${m[1]}t${m[2]}_texte-adopte-seance`, libelle: `T.A. n° ${Number(m[2])}` };
}

// Texte adopté à l'issue de la lecture où le scrutin a eu lieu : le premier texte adopté dont la date est celle du scrutin ou
// postérieure. Aucune requête n'est faite hors de la page du scrutin, de son dossier et des textes testés, dans l'ordre.
export async function trouverTexteAN(scrutin: ScrutinSource, telecharger: Telecharger): Promise<TexteLoi | null> {
  try {
    const base = new URL(scrutin.url).origin;
    const dossier = lienDossierAN(await telecharger(scrutin.url), base);
    if (!dossier) return null;
    const jourDuScrutin = scrutin.date.slice(0, 10);
    for (const id of documentsAdoptesAN(await telecharger(dossier))) {
      const adresse = adresseTexteAN(base, id);
      if (!adresse) continue;
      let html: string;
      try {
        html = await telecharger(`${base}/dyn/opendata/${id}.html`);
      } catch {
        continue;
      }
      const date = dateDuTexte(html);
      if (date === null || date < jourDuScrutin) continue;
      const texte = htmlEnTexte(html);
      if (texte.length < 20) continue;
      return { texte, url: adresse.url, libelle: adresse.libelle };
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Sénat ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// La page d'un scrutin porte un lien /dossier-legislatif/<nom>.html ; la page du dossier liste, pour chaque lecture, le texte
// adopté (/leg/tas<session>-<numéro>.html) avec, dans son libellé, la date de l'adoption.

export function lienDossierSenat(pageScrutin: string, base: string): string | null {
  const m = pageScrutin.match(/href=['"](\/dossier-legislatif\/[^'"]+\.html)['"]/);
  return m ? `${base}${m[1]}` : null;
}

export interface TexteAdopteSenat {
  chemin: string;
  numero: string;
  date: string | null;
}

export function textesAdoptesSenat(pageDossier: string): TexteAdopteSenat[] {
  const textes: TexteAdopteSenat[] = [];
  for (const m of pageDossier.matchAll(/<li><a href=['"](\/leg\/tas[^'"]+\.html)['"]>Texte<\/a>([^<]*)<\/li>/g)) {
    const numero = m[2].match(/n°\s*(\d+)/)?.[1];
    if (!numero || textes.some((t) => t.chemin === m[1])) continue;
    textes.push({ chemin: m[1], numero, date: dateDuTexte(m[2]) });
  }
  return textes;
}

// Une page /leg/tas… du Sénat commence par le menu du site et un volet « autres formats » : le texte analysé doit commencer au titre
// de la loi (juste avant « Le Sénat a adopté… le projet de loi dont la teneur suit »), à défaut au premier article.
export function corpsDuTexteSenat(texte: string): string {
  const lignes = texte.split("\n");
  const formule = lignes.findIndex((l) => /teneur suit/i.test(l));
  if (formule >= 0) {
    let debut = formule;
    for (let i = formule - 1; i >= Math.max(0, formule - 6); i--) if (/^(projet|proposition)\s+de\s+(loi|résolution)/i.test(lignes[i])) { debut = i; break; }
    return lignes.slice(debut).join("\n");
  }
  const article = lignes.findIndex((l) => /^article\s+(1er|premier|1)\b/i.test(l));
  return article >= 0 ? lignes.slice(article).join("\n") : texte;
}

export async function trouverTexteSenat(scrutin: ScrutinSource, telecharger: Telecharger): Promise<TexteLoi | null> {
  try {
    const base = new URL(scrutin.url).origin;
    const dossier = lienDossierSenat(await telecharger(scrutin.url), base);
    if (!dossier) return null;
    const jourDuScrutin = scrutin.date.slice(0, 10);
    for (const t of textesAdoptesSenat(await telecharger(dossier))) {
      if (t.date === null || t.date < jourDuScrutin) continue;
      let html: string;
      try {
        html = await telecharger(`${base}${t.chemin}`);
      } catch {
        continue;
      }
      const texte = corpsDuTexteSenat(htmlEnTexte(html));
      if (texte.length < 20) continue;
      return { texte, url: `${base}${t.chemin}`, libelle: `Texte n° ${t.numero}` };
    }
    return null;
  } catch {
    return null;
  }
}
