// Le champ `statut` qualifie l'état de la FICHE elle-même (la qualité et la complétude
// de la recherche et du sourçage menés pour cette proposition) — pas l'état du programme
// ou de la mesure du candidat. Une fiche peut être "complet" même si le programme sous-jacent
// reste flou ou non chiffré, dès lors que cette imprécision est honnêtement documentée et
// correctement sourcée (ex : « le site officiel ne précise pas de mécanisme », avec source à l'appui).
// "partiel" / "provisoire" signalent au contraire un travail de recherche lui-même inachevé
// (sources manquantes, vérification à compléter), indépendamment de la précision du programme.
export type StatutProposition = "complet" | "partiel" | "provisoire";

export interface Source {
  type: "primaire" | "secondaire";
  label: string;
  url: string;
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
}

export interface Theme {
  id: string;
  libelle: string;
  description: string;
  statut: "populated" | "provisoire";
}

export interface CandidatMeta {
  slug: string;
  nom: string;
  parti: string;
  sources_officielles: Source[];
  date_derniere_maj: string;
}

export interface ChampProfil {
  id: string;
  label: string;
  type: "enum" | "number" | "text";
  options?: string[];
}
