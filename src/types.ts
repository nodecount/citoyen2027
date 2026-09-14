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
