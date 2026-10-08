import { valeursParChamp } from "./schemaBase";

// Un « effet » décrit ce qu'une mesure fait DIRECTEMENT à un citoyen : qui est visé (cibles),
// quelle grandeur bouge (dimension), dans quel sens (hausse/baisse), avec l'extrait de source qui
// le fonde. Il ne dit jamais si c'est « bien » ou « mal » : la polarité (quel sens améliore la
// situation matérielle du citoyen) est une table du moteur, jamais une décision du modèle
// d'ingestion. Voir docs/superpowers/specs/2026-09-24-fil-rouge-themes-projection-design.md.

export const DIMENSIONS_EFFET = [
  "revenu_disponible",
  "cout_de_la_vie",
  "emploi",
  "protection_sociale",
  "acces_aux_services",
  "droits_et_libertes",
  "securite_personnelle",
  "patrimoine",
] as const;
export type DimensionEffet = (typeof DIMENSIONS_EFFET)[number];

export const SENS_EFFET = ["hausse", "baisse", "indetermine"] as const;
export type SensEffet = (typeof SENS_EFFET)[number];

// Critère qu'aucun champ du profil actuel ne capture (ex : nationalité étrangère). La description
// libre est conservée pour le jour où le profil l'exprimera, mais le moteur ne peut pas l'apparier :
// on n'élargit JAMAIS le périmètre d'une mesure à un champ voisin par approximation.
export const CHAMP_AUTRE = "autre";

export interface CritereCible {
  champ: string;
  valeurs: string[];
}

export interface Effet {
  // Tous les critères doivent correspondre au profil ; liste vide = tout le monde.
  cibles: CritereCible[];
  dimension: DimensionEffet;
  sens: SensEffet;
  // Une des URL de sources de la proposition, et le passage de cette source qui fonde l'effet.
  source_url: string;
  extrait: string;
}

const EXTRAIT_MIN_CARACTERES = 15; // en dessous, l'extrait ne prouve rien (il trouverait toujours une correspondance)
const EXTRAIT_MAX_CARACTERES = 600;

// Critères ciblables : les champs à choix du formulaire de LA base (data/bases/<id>/profils-schema.json, voir
// src/schemaBase.ts), plus `autre`. Une mesure d'une base ne peut viser que ce que cette base sait demander.
export { valeursParChamp } from "./schemaBase";
export function champsCibles(baseId: string): string[] {
  return [...Object.keys(valeursParChamp(baseId)), CHAMP_AUTRE];
}
function critereValide(critere: unknown, baseId: string): critere is CritereCible {
  if (typeof critere !== "object" || critere === null) return false;
  const c = critere as Record<string, unknown>;
  if (typeof c.champ !== "string" || !champsCibles(baseId).includes(c.champ)) return false;
  if (!Array.isArray(c.valeurs) || c.valeurs.length === 0) return false;
  if (!c.valeurs.every((v) => typeof v === "string" && v.length > 0)) return false;
  if (c.champ === CHAMP_AUTRE) return true;
  const autorisees = valeursParChamp(baseId)[c.champ];
  return (c.valeurs as string[]).every((v) => autorisees.includes(v));
}

export function validerEffet(valeur: unknown, urlsSources: string[], baseId: string): valeur is Effet {
  if (typeof valeur !== "object" || valeur === null) return false;
  const e = valeur as Record<string, unknown>;

  if (!Array.isArray(e.cibles) || !e.cibles.every((c) => critereValide(c, baseId))) return false;
  // Deux critères sur un même champ seraient ambigus (ET ? OU ?) : on regroupe les valeurs.
  const champs = (e.cibles as CritereCible[]).map((c) => c.champ);
  if (new Set(champs).size !== champs.length) return false;

  if (!DIMENSIONS_EFFET.includes(e.dimension as DimensionEffet)) return false;
  if (!SENS_EFFET.includes(e.sens as SensEffet)) return false;
  if (typeof e.source_url !== "string" || !urlsSources.includes(e.source_url)) return false;
  if (
    typeof e.extrait !== "string" ||
    e.extrait.trim().length < EXTRAIT_MIN_CARACTERES ||
    e.extrait.length > EXTRAIT_MAX_CARACTERES
  ) {
    return false;
  }
  return true;
}
