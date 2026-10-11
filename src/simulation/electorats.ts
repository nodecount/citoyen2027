import { candidatsDeBase, chargerBase, listerBases } from "../data/bases";
import { combiner, meilleurs, selonPrisme, soldesConvictions, soldesSituation, type Prisme, type Solde } from "../engine/candidatIdeal";
import type { ChoixPositions } from "../positions";
import { aDesInformations, mettreAJourReponse, type ProfilPartiel } from "../profil";
import { construireCards } from "../ui/cards";

// Simulation d'électorats types : pour chacun, des réponses au formulaire (« ma situation ») et des positions (« mes convictions »),
// passées dans EXACTEMENT le calcul de la page de résultat (construireCards → soldesSituation / soldesConvictions → meilleurs).
// Sert à contrôler à la main le lien entre les réponses et les candidats désignés : ce n'est pas une fonction du produit
// (le produit ne classe jamais les candidats devant le visiteur, voir CLAUDE.md), seulement un outil de relecture.

export interface Electorat {
  id: string;
  nom: string;
  description: string;
  // Réponses brutes, comme saisies dans le formulaire. Une réponse qui n'existe pas dans le questionnaire d'une base y est ignorée.
  reponses: Record<string, string | string[]>;
  convictions: ChoixPositions;
}

export const ELECTORATS: Electorat[] = [
  {
    id: "etudiant-urbain",
    nom: "Étudiant urbain progressiste",
    description: "Moins de 30 ans, étudiant, petit budget, locataire en grande ville, sans voiture.",
    reponses: { tranche_age: "moins_30", statut_professionnel: "etudiant", tranche_revenus: "moins_1200", situation_familiale: "celibataire", nombre_enfants: "0", logement: "locataire", territoire: "grande_ville", vehicule: "aucun", nationalite: "francaise" },
    convictions: { renouvelables: "plus_renouvelables", nucleaire: "sortir_nucleaire", immigration: "ouverture", fiscalite: "redistribution", ultra_riches: "taxer_ultra_riches", securite: "prevention", libertes: "libertes_indiv", sante_organisation: "hopital_public", logement: "encadrer_logement", cannabis: "legaliser_cannabis", europe: "plus_europe", police_armement: "police_desarmee", temps_travail: "reduire_temps_travail", salaires: "hausse_smic", droit_du_sol: "droit_sol_maintenu" },
  },
  {
    id: "cadre-liberal",
    nom: "Cadre libéral, propriétaire",
    description: "30-49 ans, salarié à plus de 5 000 €, marié, un enfant, propriétaire en grande ville.",
    reponses: { tranche_age: "30_49", statut_professionnel: "salarie", tranche_revenus: "plus_5000", situation_familiale: "marie_pacse", nombre_enfants: "1", logement: "proprietaire", territoire: "grande_ville", vehicule: "thermique", nationalite: "francaise", tranche_patrimoine: "500k_1_3m" },
    convictions: { nucleaire: "garder_nucleaire", fiscalite: "baisse_impots", travail: "travailler_plus", sante_organisation: "liberte_sante", logement: "liberer_offre_logement", commerce: "libre_echange", ia: "plus_ia", dette: "reduire_dette", fonction_publique: "moins_fonctionnaires", ultra_riches: "ne_pas_taxer_ultra_riches", aides_sociales: "conditionner_aides", europe: "plus_europe" },
  },
  {
    id: "retraite-rural",
    nom: "Retraité rural conservateur",
    description: "65 ans et plus, retraité (pension 1 300-2 000 €), propriétaire en zone rurale, voiture thermique.",
    reponses: { tranche_age: "65_plus", statut_professionnel: "retraite", montant_pension: "1300_2000", tranche_revenus: "1200_2000", situation_familiale: "marie_pacse", nombre_enfants: "0", logement: "proprietaire", territoire: "rural", vehicule: "thermique", usage_autoroute: "oui", nationalite: "francaise" },
    convictions: { immigration: "restriction", securite: "repression", nucleaire: "garder_nucleaire", renouvelables: "freiner_transition", libertes: "cadre_collectif", prison: "plus_de_prison", voiture: "defendre_voiture", laicite: "laicite_stricte", droit_du_sol: "droit_sol_restreint", europe: "souverainete", surveillance: "plus_surveillance", fin_de_vie: "soins_palliatifs", ecole_discipline: "ecole_exigence" },
  },
  {
    id: "famille-populaire",
    nom: "Famille salariée modeste, 3 enfants",
    description: "30-49 ans, salarié 1 200-2 000 €, en couple avec 3 enfants, locataire en ville moyenne, voiture thermique.",
    reponses: { tranche_age: "30_49", statut_professionnel: "salarie", tranche_revenus: "1200_2000", situation_familiale: "en_couple", nombre_enfants: "3", logement: "locataire", territoire: "ville_moyenne", vehicule: "thermique", usage_autoroute: "non", nationalite: "francaise", aides_percues: ["allocations_familiales"], enfants_scolarises: ["maternelle_primaire", "college"] },
    convictions: { salaires: "hausse_smic", fiscalite: "redistribution", commerce: "protectionnisme", travail: "age_actuel", fonction_publique: "plus_services_publics", sante_organisation: "hopital_public", logement: "encadrer_logement", immigration: "restriction" },
  },
  {
    id: "parent-isole",
    nom: "Parent isolé précaire",
    description: "30-49 ans, sans emploi, moins de 1 200 €, parent isolé de 2 enfants (dont un de moins de 3 ans), locataire HLM en quartier prioritaire, RSA et aide au logement.",
    reponses: { tranche_age: "30_49", statut_professionnel: "sans_emploi", tranche_revenus: "moins_1200", situation_familiale: "celibataire", nombre_enfants: "2", parent_isole: "oui", enfant_moins_3_ans: "oui", logement: "locataire", logement_social: "oui", territoire: "quartier_prioritaire", nationalite: "francaise", aides_percues: ["rsa", "aide_logement", "allocations_familiales"], enfants_scolarises: ["maternelle_primaire"] },
    convictions: { aides_sociales: "proteger_droits_sociaux", fiscalite: "redistribution", sante_organisation: "hopital_public", logement: "encadrer_logement", fonction_publique: "plus_services_publics", securite: "prevention", salaires: "hausse_smic" },
  },
  {
    id: "artisan-independant",
    nom: "Artisan indépendant",
    description: "50-64 ans, indépendant 3 000-5 000 €, marié avec 2 enfants, propriétaire en ville moyenne, voiture thermique.",
    reponses: { tranche_age: "50_64", statut_professionnel: "independant", tranche_revenus: "3000_5000", situation_familiale: "marie_pacse", nombre_enfants: "2", logement: "proprietaire", territoire: "ville_moyenne", vehicule: "thermique", usage_autoroute: "oui", nationalite: "francaise", metier_penible: "oui" },
    convictions: { fiscalite: "baisse_impots", salaires: "moderer_salaires", temps_travail: "travailler_davantage", fonction_publique: "moins_fonctionnaires", dette: "reduire_dette", agriculture_normes: "assouplir_normes_agri", voiture: "defendre_voiture", nucleaire: "garder_nucleaire", aides_sociales: "conditionner_aides" },
  },
  {
    id: "enseignant-ecolo",
    nom: "Enseignant écologiste",
    description: "30-49 ans, enseignant fonctionnaire 2 000-3 000 €, en couple avec 2 enfants scolarisés, locataire en grande ville, véhicule électrique ou hybride.",
    reponses: { tranche_age: "30_49", statut_professionnel: "fonctionnaire", metier: "enseignant", tranche_revenus: "2000_3000", situation_familiale: "en_couple", nombre_enfants: "2", logement: "locataire", territoire: "grande_ville", vehicule: "electrique_hybride", usage_autoroute: "non", nationalite: "francaise", enfants_scolarises: ["college", "lycee"] },
    convictions: { fonction_publique: "plus_services_publics", nucleaire: "sortir_nucleaire", renouvelables: "plus_renouvelables", fiscalite: "redistribution", securite: "prevention", manifestations: "droit_manifester", ecole_organisation: "reformer_ecole", ecole_discipline: "ecole_bienveillance", voiture: "restreindre_voiture", europe: "plus_europe" },
  },
  {
    id: "agriculteur",
    nom: "Agriculteur",
    description: "50-64 ans, agriculteur indépendant 1 200-2 000 €, marié avec 2 enfants, propriétaire en zone rurale, voiture thermique.",
    reponses: { tranche_age: "50_64", statut_professionnel: "independant", metier: "agriculteur", tranche_revenus: "1200_2000", situation_familiale: "marie_pacse", nombre_enfants: "2", logement: "proprietaire", territoire: "rural", vehicule: "thermique", usage_autoroute: "non", nationalite: "francaise", metier_penible: "oui", carriere_longue: "oui" },
    convictions: { agriculture_normes: "assouplir_normes_agri", renouvelables: "freiner_transition", europe: "souverainete", commerce: "protectionnisme", fiscalite: "baisse_impots", voiture: "defendre_voiture", immigration: "restriction", nucleaire: "garder_nucleaire" },
  },
  {
    id: "etranger-resident",
    nom: "Résident étranger hors UE",
    description: "30-49 ans, salarié 1 200-2 000 €, nationalité hors UE avec titre de séjour de longue durée depuis plus de 5 ans, locataire en grande ville.",
    reponses: { tranche_age: "30_49", statut_professionnel: "salarie", tranche_revenus: "1200_2000", situation_familiale: "en_couple", nombre_enfants: "1", logement: "locataire", territoire: "grande_ville", vehicule: "aucun", nationalite: "hors_ue", statut_sejour: "titre_long_sejour", anciennete_france: "5_ans_et_plus" },
    convictions: { immigration: "ouverture", droit_du_sol: "droit_sol_maintenu", laicite: "liberte_religieuse", libertes: "libertes_indiv", fiscalite: "redistribution" },
  },
  {
    id: "retraitee-aidante",
    nom: "Retraitée modeste aidante",
    description: "65 ans et plus, retraitée (pension moins de 1 000 €), locataire en zone rurale, aide un proche dépendant, difficulté à trouver un médecin.",
    reponses: { tranche_age: "65_plus", statut_professionnel: "retraite", montant_pension: "moins_1000", tranche_revenus: "moins_1200", situation_familiale: "celibataire", nombre_enfants: "0", logement: "locataire", territoire: "rural", vehicule: "thermique", usage_autoroute: "non", nationalite: "francaise", aidant_familial: "oui", desert_medical: "oui", handicap: "non" },
    convictions: { fin_de_vie: "soins_palliatifs", sante_organisation: "hopital_public", travail: "age_actuel", fonction_publique: "plus_services_publics", libertes: "cadre_collectif" },
  },
  {
    id: "chef-entreprise",
    nom: "Chef d'entreprise",
    description: "50-64 ans, chef d'entreprise à plus de 5 000 €, marié avec 2 enfants, propriétaire en ville moyenne, voiture thermique.",
    reponses: { tranche_age: "50_64", statut_professionnel: "chef_entreprise", tranche_revenus: "plus_5000", situation_familiale: "marie_pacse", nombre_enfants: "2", logement: "proprietaire", territoire: "ville_moyenne", vehicule: "thermique", usage_autoroute: "oui", nationalite: "francaise", tranche_patrimoine: "500k_1_3m" },
    convictions: { entreprises: "soutenir_entreprises", fiscalite: "baisse_impots", ultra_riches: "ne_pas_taxer_ultra_riches", salaires: "moderer_salaires", temps_travail: "travailler_davantage", aides_sociales: "conditionner_aides", dette: "reduire_dette", commerce: "libre_echange" },
  },
];

export interface Gagnant {
  nom: string;
  solde: number;
  ameliorants: number;
  degradants: number;
  analyses: number;
}

export type Classement = { gagnants: Gagnant[]; departageable: boolean; suivants: Gagnant[] };

// Le même résultat compté de trois façons (mesures, groupes de mesures, thèmes), pour la situation, les convictions et les deux
// additionnés (le candidat idéal du centre de la card).
export type SelonPrismes = Record<Prisme, Classement | null>;

export interface ResultatBase {
  base: string;
  reponsesRetenues: number;
  prismes: { situation: SelonPrismes | null; convictions: SelonPrismes | null; combine: SelonPrismes | null };
  situation: { gagnants: Gagnant[]; departageable: boolean; suivants: Gagnant[] } | null;
  convictions: { gagnants: Gagnant[]; departageable: boolean; suivants: Gagnant[]; sujetsPris: number } | null;
}

function profilDe(electorat: Electorat, champs: ReturnType<typeof chargerBase>["champs"]): ProfilPartiel {
  let profil: ProfilPartiel = {};
  // Deux passes : une question conditionnelle dépend d'une autre réponse, qui peut venir après elle.
  for (let passe = 0; passe < 2; passe++) {
    for (const champ of champs) {
      const brut = electorat.reponses[champ.id];
      if (brut === undefined) continue;
      profil = mettreAJourReponse(profil, champ, brut, champs);
    }
  }
  return profil;
}

function versGagnant(s: Solde, noms: Map<string, string>): Gagnant {
  return { nom: noms.get(s.slug) ?? s.slug, solde: s.solde, ameliorants: s.ameliorants, degradants: s.degradants, analyses: s.analyses };
}

// Les trois meilleurs scores distincts après le(s) gagnant(s), pour juger si l'écart est net.
function suivants(soldes: Solde[], noms: Map<string, string>, gagnantsSlugs: Set<string>): Gagnant[] {
  return soldes
    .filter((s) => s.analyses > 0 && !gagnantsSlugs.has(s.slug))
    .sort((a, b) => b.solde - a.solde)
    .slice(0, 3)
    .map((s) => versGagnant(s, noms));
}

export function simuler(electorat: Electorat, baseId: string): ResultatBase {
  const base = chargerBase(baseId);
  const { avecDonnees } = candidatsDeBase(base);
  const noms = new Map(avecDonnees.map((c) => [c.meta.slug, c.meta.nom]));
  const profil = profilDe(electorat, base.champs);
  const personnalise = aDesInformations(profil);
  const cards = construireCards(base.themes, avecDonnees, personnalise ? profil : null);
  // Positions valides seulement (un sujet ou une position inconnus sont écartés, comme au rechargement de la page).
  const positions: ChoixPositions = Object.fromEntries(Object.entries(electorat.convictions).filter(([, p]) => p !== ""));

  const selonPrismes = (soldes: Solde[]): SelonPrismes => {
    const un = (prisme: Prisme): Classement | null => {
      const comptes = soldes.map((s) => selonPrisme(s, prisme));
      const m = meilleurs(comptes);
      if (!m || m.gagnants.length === 0) return null;
      return { gagnants: m.gagnants.map((g) => versGagnant(g, noms)), departageable: m.departageable, suivants: suivants(comptes, noms, new Set(m.gagnants.map((g) => g.slug))) };
    };
    return { mesures: un("mesures"), groupes: un("groupes"), themes: un("themes") };
  };
  const soldesSit = personnalise ? soldesSituation(cards) : null;
  const soldesConv = Object.keys(positions).length > 0 ? soldesConvictions(cards, positions) : null;
  const prismes = {
    situation: soldesSit ? selonPrismes(soldesSit) : null,
    convictions: soldesConv ? selonPrismes(soldesConv) : null,
    combine: soldesSit ? selonPrismes(soldesConv ? combiner(soldesSit, soldesConv) : soldesSit) : null,
  };

  let situation: ResultatBase["situation"] = null;
  if (personnalise) {
    const soldes = soldesSituation(cards);
    const m = meilleurs(soldes);
    if (m && m.gagnants.length > 0) {
      situation = { gagnants: m.gagnants.map((g) => versGagnant(g, noms)), departageable: m.departageable, suivants: suivants(soldes, noms, new Set(m.gagnants.map((g) => g.slug))) };
    }
  }
  let convictions: ResultatBase["convictions"] = null;
  if (Object.keys(positions).length > 0) {
    const soldes = soldesConvictions(cards, positions);
    const m = meilleurs(soldes);
    if (m && m.gagnants.length > 0) {
      convictions = { gagnants: m.gagnants.map((g) => versGagnant(g, noms)), departageable: m.departageable, suivants: suivants(soldes, noms, new Set(m.gagnants.map((g) => g.slug))), sujetsPris: Object.keys(positions).length };
    }
  }
  return { base: baseId, reponsesRetenues: Object.keys(profil).length, prismes, situation, convictions };
}

export function basesASimuler(): string[] {
  return listerBases().map((b) => b.id);
}
