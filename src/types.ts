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
  // Rubrique de la source quand elle range ses propositions plus finement que nos thèmes (bases issues de comparateurs).
  sous_theme?: string;
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

// Résumé d'un candidat sur un thème : 50 mots au plus, en segments. Un segment « mot clé » porte les identifiants des
// mesures qu'il couvre ; chaque mesure du thème est couverte par exactement un mot clé (aucune n'est choisie ni oubliée).
export interface SegmentResume {
  texte: string;
  mesures: string[];
}

export interface ResumeTheme {
  theme: string;
  segments: SegmentResume[];
  // Toutes les mesures résumées (triées) : si elles changent, le résumé est périmé et n'est plus affiché.
  propositions: string[];
  empreinte: string;
  date: string;
  modele: string;
}

export interface Theme {
  id: string;
  // Formulé comme le citoyen le vit (« Ma retraite »), pas comme l'administration le classe.
  libelle: string;
  question_citoyen: string;
  description: string;
  // Sujets abordés, en quelques mots chacun : affichés sous le nom du thème (« Sujets abordés : … »).
  sujets?: string[];
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

// Une question du formulaire = un champ du profil. `enum` : un choix ; `multi` : plusieurs choix (la réponse est une
// liste) ; `number` : un nombre ; `text` : texte libre (jamais apparié par le moteur).
export interface ChampProfil {
  id: string;
  label: string;
  type: "enum" | "multi" | "number" | "text";
  options?: string[];
  // Libellé lisible de chaque option (le formulaire n'affiche jamais un identifiant technique).
  libelles?: Record<string, string>;
  // Donnée sensible : demandée seulement avec l'accord explicite du visiteur, toujours facultative.
  sensible?: boolean;
  // Pourquoi la question est posée (affiché au visiteur).
  finalite?: string;
  // Question conditionnelle : affichée seulement si la réponse à un autre champ est l'une de ces valeurs.
  afficher_si?: { champ: string; valeurs: string[] };
}

// Une réponse du visiteur : un choix, un nombre, ou une liste de choix. Une question non répondue est ABSENTE du
// profil (inconnu), jamais « non ».
export type Reponse = string | number | string[];
export type Profil = Record<string, Reponse>;

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
