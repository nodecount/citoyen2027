import type { CritereCible } from "./effets";

// Valeurs sociales : « je veux un candidat dont les mesures améliorent la situation de… ». Chaque groupe s'appuie sur un
// critère réel du formulaire (mêmes champs et options que les cibles des mesures, voir data/profils-schema.json) : c'est
// ce qui permet d'apparier les groupes aux effets déjà structurés, sans nouveau modèle.
export interface GroupeSocial {
  id: string;
  libelle: string;
  critere: CritereCible;
}

export const GROUPES_SOCIAUX: GroupeSocial[] = [
  { id: "faibles_revenus", libelle: "Les personnes à faibles revenus", critere: { champ: "tranche_revenus", valeurs: ["moins_1200", "1200_2000"] } },
  { id: "sans_emploi", libelle: "Les personnes sans emploi", critere: { champ: "statut_professionnel", valeurs: ["sans_emploi"] } },
  { id: "jeunes", libelle: "Les jeunes de moins de 30 ans", critere: { champ: "tranche_age", valeurs: ["moins_30"] } },
  { id: "retraites", libelle: "Les retraités", critere: { champ: "statut_professionnel", valeurs: ["retraite"] } },
  { id: "handicap", libelle: "Les personnes en situation de handicap", critere: { champ: "handicap", valeurs: ["oui"] } },
  { id: "territoires_fragiles", libelle: "Les habitants des quartiers prioritaires, des zones rurales et de l'outre-mer", critere: { champ: "territoire", valeurs: ["quartier_prioritaire", "rural", "outre_mer"] } },
];
