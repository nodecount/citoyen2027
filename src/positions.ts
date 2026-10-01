// Convictions par sujet (décision du 2026-10-01) : pour chaque grand sujet, le visiteur choisit la position qui lui parle,
// ou ne dit rien (« pas d'avis » est l'état de départ, jamais une position). Le catalogue est FIXE et validé par le porteur
// du projet : mêmes sujets pour tous les candidats, chaque sujet offre des positions opposées (aucune n'est mise en avant),
// et la description de chaque position est celle que reçoit le modèle qui étiquette les mesures.

export interface PositionConviction {
  id: string;
  libelle: string;
  // Ce que défend une mesure pour relever de cette position (donnée au modèle qui étiquette : jamais d'interprétation libre).
  definition: string;
}

export interface SujetConviction {
  id: string;
  libelle: string;
  question: string;
  positions: PositionConviction[];
}

export const SUJETS_CONVICTION: SujetConviction[] = [
  {
    id: "ecologie",
    libelle: "Écologie et énergie",
    question: "Sur l'écologie et l'énergie, quelle position vous parle le plus ?",
    positions: [
      { id: "sortir_nucleaire", libelle: "Sortir du nucléaire", definition: "arrêter ou programmer l'arrêt de la production d'électricité nucléaire (fermeture de réacteurs, abandon de nouvelles centrales)" },
      { id: "garder_nucleaire", libelle: "Garder et développer le nucléaire", definition: "maintenir, prolonger ou développer le parc nucléaire (nouveaux réacteurs, prolongation de centrales)" },
      { id: "renouvelables", libelle: "Miser d'abord sur les renouvelables", definition: "faire des énergies renouvelables (éolien, solaire, hydraulique…) ou de la sobriété la priorité de la politique énergétique et écologique" },
    ],
  },
  {
    id: "ia",
    libelle: "Intelligence artificielle",
    question: "Sur l'intelligence artificielle, quelle position vous parle le plus ?",
    positions: [
      { id: "plus_ia", libelle: "Encourager davantage l'IA", definition: "soutenir, financer ou accélérer le développement et l'usage de l'intelligence artificielle" },
      { id: "encadrer_ia", libelle: "Encadrer et limiter l'IA", definition: "réguler, restreindre ou interdire certains développements ou usages de l'intelligence artificielle" },
    ],
  },
  {
    id: "europe",
    libelle: "Europe",
    question: "Sur l'Europe, quelle position vous parle le plus ?",
    positions: [
      { id: "plus_europe", libelle: "Plus d'intégration européenne", definition: "renforcer les compétences, le budget ou les politiques communes de l'Union européenne" },
      { id: "souverainete", libelle: "Moins d'Europe, plus de souveraineté nationale", definition: "reprendre des compétences à l'Union européenne, déroger à ses règles ou en réduire le rôle au profit de la souveraineté nationale" },
    ],
  },
  {
    id: "immigration",
    libelle: "Immigration",
    question: "Sur l'immigration, quelle position vous parle le plus ?",
    positions: [
      { id: "ouverture", libelle: "Plus d'ouverture", definition: "faciliter l'accueil, la régularisation ou l'accès aux droits des personnes étrangères" },
      { id: "restriction", libelle: "Plus de restriction", definition: "limiter l'immigration, durcir les conditions d'entrée, de séjour, d'accès aux droits ou à la nationalité" },
    ],
  },
  {
    id: "fiscalite",
    libelle: "Fiscalité et dépense publique",
    question: "Sur les impôts et la dépense publique, quelle position vous parle le plus ?",
    positions: [
      { id: "redistribution", libelle: "Plus de redistribution", definition: "augmenter des impôts ou des prélèvements sur les plus aisés ou le capital, ou étendre des dépenses et prestations de solidarité" },
      { id: "baisse_impots", libelle: "Moins d'impôts et moins de dépense publique", definition: "baisser des impôts ou des prélèvements, ou réduire la dépense publique ou le nombre de fonctionnaires" },
    ],
  },
  {
    id: "securite",
    libelle: "Sécurité et justice",
    question: "Sur la sécurité et la justice, quelle position vous parle le plus ?",
    positions: [
      { id: "repression", libelle: "Priorité à la répression", definition: "durcir les peines, renforcer les moyens de la police, de la prison ou les pouvoirs de sanction" },
      { id: "prevention", libelle: "Priorité à la prévention", definition: "privilégier la prévention, l'éducation, l'insertion, les peines alternatives ou la réinsertion plutôt que la sanction" },
    ],
  },
  {
    id: "travail",
    libelle: "Travail et retraites",
    question: "Sur le travail et les retraites, quelle position vous parle le plus ?",
    positions: [
      { id: "travailler_plus", libelle: "Travailler plus longtemps", definition: "reculer ou durcir l'âge ou la durée de cotisation pour la retraite, ou allonger le temps de travail" },
      { id: "age_actuel", libelle: "Conserver l'âge actuel de départ", definition: "maintenir ou ramener l'âge légal de départ à la retraite, sans l'allonger" },
    ],
  },
  {
    id: "libertes",
    libelle: "Libertés et société",
    question: "Sur les libertés et la société, quelle position vous parle le plus ?",
    positions: [
      { id: "libertes_indiv", libelle: "Plus de libertés individuelles", definition: "étendre des libertés ou des droits individuels (choix de vie, expression, vie privée, nouveaux droits) ou lever des interdits" },
      { id: "cadre_collectif", libelle: "Plus de cadre collectif", definition: "renforcer des règles communes, des interdits ou l'autorité de l'État sur les comportements, l'ordre moral ou l'identité collective" },
    ],
  },
];

// Choix du visiteur : identifiant de sujet → identifiant de position. Un sujet absent = « pas d'avis ».
export type ChoixPositions = Record<string, string>;

export function trouverSujet(id: string): SujetConviction | undefined {
  return SUJETS_CONVICTION.find((s) => s.id === id);
}

export function trouverPosition(sujetId: string, positionId: string): PositionConviction | undefined {
  return trouverSujet(sujetId)?.positions.find((p) => p.id === positionId);
}

// Position qu'une MESURE défend, établie par le modèle d'étiquetage puis vérifiée (extrait retrouvé mot pour mot).
export interface PositionMesure {
  sujet: string;
  position: string;
  source_url: string;
  extrait: string;
}

export function validerPositionMesure(brut: unknown): brut is PositionMesure {
  if (typeof brut !== "object" || brut === null) return false;
  const p = brut as Record<string, unknown>;
  return (
    typeof p.sujet === "string" &&
    typeof p.position === "string" &&
    trouverPosition(p.sujet, p.position) !== undefined &&
    typeof p.source_url === "string" &&
    p.source_url.length > 0 &&
    typeof p.extrait === "string" &&
    p.extrait.trim().length >= 10
  );
}
