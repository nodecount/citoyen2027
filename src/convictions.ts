import profilSchemaRaw from "../data/profils-schema.json";
import type { CritereCible } from "./effets";

// Valeurs sociales : « je veux un candidat dont les mesures améliorent la situation de… ». Chaque groupe s'appuie sur un
// critère réel du formulaire (mêmes champs et options que les cibles des mesures, voir data/profils-schema.json) : c'est
// ce qui permet d'apparier les groupes aux effets déjà structurés, sans nouveau modèle.
//
// Neutralité : le catalogue est GÉNÉRÉ depuis le schéma, une entrée par option de chaque champ retenu (statut, âge,
// revenus, logement, territoire, métier) — jamais une liste choisie à la main, qui ne mettrait en avant que certains
// publics. Indépendants, propriétaires, familles, hauts revenus… figurent au même titre que les publics fragiles.
export interface GroupeSocial {
  id: string;
  libelle: string;
  // Regroupement d'affichage (« Situation professionnelle », « Âge »…).
  rubrique: string;
  critere: CritereCible;
}

interface ChampSchema {
  id: string;
  options?: string[];
  libelles?: Record<string, string>;
}

const CHAMPS_PROPOSES: Array<{ champ: string; rubrique: string; exclure?: string[] }> = [
  { champ: "statut_professionnel", rubrique: "Situation professionnelle" },
  { champ: "tranche_age", rubrique: "Âge" },
  { champ: "tranche_revenus", rubrique: "Revenus mensuels" },
  { champ: "logement", rubrique: "Logement" },
  { champ: "territoire", rubrique: "Territoire" },
  { champ: "metier", rubrique: "Métier", exclure: ["aucun"] },
];

function genererGroupes(): GroupeSocial[] {
  const schema = profilSchemaRaw as ChampSchema[];
  const groupes: GroupeSocial[] = [];
  for (const { champ, rubrique, exclure = [] } of CHAMPS_PROPOSES) {
    const def = schema.find((c) => c.id === champ);
    for (const valeur of def?.options ?? []) {
      if (exclure.includes(valeur)) continue;
      groupes.push({ id: `${champ}:${valeur}`, libelle: def?.libelles?.[valeur] ?? valeur, rubrique, critere: { champ, valeurs: [valeur] } });
    }
  }
  groupes.push(
    { id: "enfants_a_charge:au_moins_un", libelle: "Familles avec enfants à charge", rubrique: "Famille", critere: { champ: "enfants_a_charge", valeurs: ["au_moins_un"] } },
    { id: "handicap:oui", libelle: "Personnes en situation de handicap", rubrique: "Handicap", critere: { champ: "handicap", valeurs: ["oui"] } },
  );
  return groupes;
}

export const GROUPES_SOCIAUX: GroupeSocial[] = genererGroupes();
