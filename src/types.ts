// Le champ `statut` qualifie l'état de la FICHE elle-même (la qualité et la complétude
// de la recherche et du sourçage menés pour cette proposition) — pas l'état du programme
// ou de la mesure du candidat. Une fiche peut être "complet" même si le programme sous-jacent
// reste flou ou non chiffré, dès lors que cette imprécision est honnêtement documentée et
// correctement sourcée (ex : « le site officiel ne précise pas de mécanisme », avec source à l'appui).
// "partiel" / "provisoire" signalent au contraire un travail de recherche lui-même inachevé
// (sources manquantes, vérification à compléter), indépendamment de la précision du programme.
export type StatutProposition = "complet" | "partiel" | "provisoire";

import type { Effet } from "./effets";

export interface Source {
  type: "primaire" | "secondaire";
  label: string;
  url: string;
  // Citation courte « nom · année » (voir src/citations.ts). Optionnels tant que les sources
  // collectées avant ce format n'ont pas été enrichies ; obligatoires à la génération.
  nom?: string;
  annee?: number;
}

export interface Proposition {
  id: string;
  candidat: string;
  theme: string;
  titre: string;
  resume_factuel: string;
  sources: Source[];
  chiffrage_disponible: boolean;
  hypotheses_calcul: string;
  statut: StatutProposition;
  date_derniere_verification: string;
  // Optionnel tant que les propositions collectées avant le fil rouge n'ont pas été enrichies.
  // Sans effets, le moteur ne peut pas projeter : il ne devine pas.
  effets?: Effet[];
}

// Texte « pourquoi et en quoi le programme de ce candidat touche ce thème », un par candidat × thème.
// Dérivé des seules propositions vérifiées listées dans `propositions` (toutes celles du thème) ;
// les sources affichées à la fin sont construites par l'interface à partir de ces propositions
// (src/citations.ts), jamais rédigées dans le texte.
export interface SyntheseTheme {
  theme: string;
  texte: string;
  propositions: string[];
  date_derniere_verification: string;
}

export interface Theme {
  id: string;
  // Formulé comme le citoyen le vit (« Ma retraite »), pas comme l'administration le classe.
  libelle: string;
  question_citoyen: string;
  description: string;
  statut: "populated" | "provisoire";
}

// Document officiel lu par le pipeline (mode corpus). `nom` et `annee` alimentent la citation « nom · année » :
// ils viennent de nos données, jamais du modèle. `annee` = année du document (pas celle de la consultation).
export interface DocumentOfficiel {
  id: string;
  url: string;
  nom: string;
  annee: number;
}

export interface CandidatMeta {
  slug: string;
  nom: string;
  parti: string;
  sources_officielles: Source[];
  // Documents à lire pour l'extraction par corpus (voir docs/superpowers/specs/2026-09-26-ingestion-lecture-unique-design.md).
  documents?: DocumentOfficiel[];
  date_derniere_maj: string;
}

export interface ChampProfil {
  id: string;
  label: string;
  type: "enum" | "number" | "text";
  options?: string[];
}

export interface Profil {
  statut_professionnel: string;
  tranche_revenus: string;
  situation_familiale: string;
  nombre_enfants: number;
  logement: string;
  secteur_activite: string;
  region: string;
  tranche_age: string;
  tranche_patrimoine: string;
}

// "chiffre_macro_seulement" est une valeur réservée / prospective : aucune règle actuelle
// ne la produit (le moteur ne produit aujourd'hui que "qualitatif"). Elle est conservée pour
// le jour où une règle relaiera un chiffre macro sans personnalisation complète par profil.
export type NiveauCertitude = "chiffre_personnalise" | "chiffre_macro_seulement" | "qualitatif";

export interface Impact {
  concerne: boolean;
  niveau: NiveauCertitude;
  montant_estime?: number;
  explication: string;
}
