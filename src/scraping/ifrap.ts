import type { CandidatMeta, Proposition, Source } from "../types";
import { genererIdProposition } from "../ingestion/ids";

// Base « agregateurs », source 1 : le comparateur de la Fondation iFRAP. Sa page embarque un jeu de données complet,
// que son API publique sert en JSON (une seule requête). Aucun modèle : le texte de chaque proposition est repris tel
// quel (balises retirées), attribué à la source et lié à sa page. Rien n'est inventé, rien n'est jugé : les règles de
// conversion ci-dessous sont les seules transformations.

export const URL_API_IFRAP = "https://www.ifrap.org/api/comparators/presidentielles-2027";
export const URL_PAGE_IFRAP = "https://www.ifrap.org/comparateurs/presidentielles-2027";
export const NOM_SOURCE_IFRAP = "Fondation iFRAP";
const LONGUEUR_MAX_TITRE = 160;

// Thèmes du comparateur → identifiants de data/bases/agregateurs/themes.json. Un thème absent de cette table fait
// échouer la conversion (jamais de perte silencieuse) : il faut alors l'ajouter ici ET dans themes.json.
export const THEMES_IFRAP: Record<string, string> = {
  "Finances publiques": "finances-publiques",
  "Intérieur & Justice": "interieur-justice",
  "Social & Solidarité": "social-solidarite",
  "Retraites & Travail": "retraites-travail",
  Environnement: "environnement",
  "Europe & international": "europe-international",
  "Gouvernance & République": "gouvernance-republique",
  "Réformes de l'Etat": "reformes-etat",
  "Education & Jeunesse": "education-jeunesse",
  Défense: "defense",
};

export interface CandidatIfrap {
  id: string;
  first_name: string;
  last_name: string;
  political_party: string;
}

export interface DonneesIfrap {
  candidates: CandidatIfrap[];
  content: Array<{
    id: string;
    name: string;
    items: Array<{
      id: string;
      name: string;
      items: Array<{ id: string; content?: { proposals: Array<{ text: string; old_text?: string }> | null } }>;
    }>;
  }>;
}

export function slugifier(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const ENTITES: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", rsquo: "’", lsquo: "‘", laquo: "«", raquo: "»", hellip: "…", euro: "€" };

function decoderEntites(texte: string): string {
  return texte.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (tout, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : tout;
    }
    return ENTITES[code.toLowerCase()] ?? tout;
  });
}

// HTML de la source → lignes de texte. Un paragraphe = une ligne ; un élément de liste = une ligne « • … ».
export function lignesDeHtml(html: string): string[] {
  const texte = html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/(p|li|ul|ol|div)>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  return decoderEntites(texte)
    .split("\n")
    .map((ligne) => ligne.replace(/\s+/g, " ").trim())
    .filter((ligne) => ligne.length > 0);
}

// Titre = première ligne, coupée à un mot entier si elle dépasse la longueur d'un intitulé.
export function titreDe(premiereLigne: string): string {
  if (premiereLigne.length <= LONGUEUR_MAX_TITRE) return premiereLigne;
  const coupe = premiereLigne.slice(0, LONGUEUR_MAX_TITRE);
  return coupe.slice(0, Math.max(coupe.lastIndexOf(" "), 1)).trimEnd() + "…";
}

export function nomComplet(c: CandidatIfrap): string {
  return `${c.first_name} ${c.last_name}`.replace(/\s+/g, " ").trim();
}

export interface RapportIfrap {
  candidats: number;
  propositions: number;
  parCandidat: Array<{ slug: string; nom: string; propositions: number; themes: number }>;
  sansProposition: string[];
  avecAncienTexte: number;
}

export interface CandidatConverti {
  meta: CandidatMeta;
  propositions: Proposition[];
}

export function convertirIfrap(donnees: DonneesIfrap, date: string): { candidats: CandidatConverti[]; rapport: RapportIfrap } {
  const source: Source = {
    type: "secondaire",
    label: "Fondation iFRAP — Comparateur des programmes des candidats à la présidentielle 2027",
    url: URL_PAGE_IFRAP,
    nom: NOM_SOURCE_IFRAP,
    annee: Number(date.slice(0, 4)),
  };

  const parIdSource = new Map<string, CandidatConverti>();
  const slugsPris = new Set<string>();
  for (const c of donnees.candidates) {
    const nom = nomComplet(c);
    const slug = slugifier(c.last_name || nom);
    if (slugsPris.has(slug)) throw new Error(`Deux candidats de la source donnent le même identifiant « ${slug} » : ${nom}`);
    slugsPris.add(slug);
    parIdSource.set(c.id, {
      meta: {
        slug,
        nom,
        parti: c.political_party.trim() || "non renseigné par la source",
        sources_officielles: [{ ...source, label: `${source.label} — fiche de ${nom}` }],
        date_derniere_maj: date,
      },
      propositions: [],
    });
  }

  const compteurs = new Map<string, number>(); // slug|theme → numéro de la dernière proposition
  const themesVus = new Map<string, Set<string>>();
  let avecAncienTexte = 0;

  for (const theme of donnees.content) {
    const themeId = THEMES_IFRAP[theme.name];
    if (!themeId) throw new Error(`Thème inconnu dans la source : « ${theme.name} ». L'ajouter à THEMES_IFRAP et à data/bases/agregateurs/themes.json.`);
    for (const rubrique of theme.items) {
      for (const entree of rubrique.items) {
        const candidat = parIdSource.get(entree.id);
        if (!candidat) throw new Error(`Candidat inconnu (id ${entree.id}) dans la rubrique « ${rubrique.name} » : absent de la liste des candidats de la source.`);
        for (const brute of entree.content?.proposals ?? []) {
          const lignes = lignesDeHtml(brute.text);
          if (lignes.length === 0) continue;
          if (brute.old_text) avecAncienTexte += 1;
          const cle = `${candidat.meta.slug}|${themeId}`;
          const numero = (compteurs.get(cle) ?? 0) + 1;
          compteurs.set(cle, numero);
          const titre = titreDe(lignes[0]);
          candidat.propositions.push({
            id: genererIdProposition(candidat.meta.slug, themeId, numero),
            candidat: candidat.meta.slug,
            theme: themeId,
            titre,
            resume_factuel: lignes.join(" "),
            sources: [source],
            chiffrage_disponible: false,
            hypotheses_calcul: "Aucun calcul : proposition reprise telle que rédigée par la source, sans vérification auprès du programme officiel.",
            statut: "partiel",
            date_derniere_verification: date,
            sous_theme: rubrique.name,
          });
          const vus = themesVus.get(candidat.meta.slug) ?? new Set<string>();
          vus.add(themeId);
          themesVus.set(candidat.meta.slug, vus);
        }
      }
    }
  }

  const candidats = [...parIdSource.values()].sort((a, b) => a.meta.slug.localeCompare(b.meta.slug));
  return {
    candidats,
    rapport: {
      candidats: candidats.length,
      propositions: candidats.reduce((somme, c) => somme + c.propositions.length, 0),
      parCandidat: candidats.map((c) => ({ slug: c.meta.slug, nom: c.meta.nom, propositions: c.propositions.length, themes: themesVus.get(c.meta.slug)?.size ?? 0 })),
      sansProposition: candidats.filter((c) => c.propositions.length === 0).map((c) => c.meta.nom),
      avecAncienTexte,
    },
  };
}
