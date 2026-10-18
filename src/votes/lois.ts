// Lot test de la base « votes » (décision du 2026-10-18) : 15 lois de la XVIIe législature, choisies parmi les votes sur
// l'ensemble d'un texte à forte participation, de thèmes variés. L'unité retenue est « l'article clé » : un article du texte qui a
// fait l'objet d'un scrutin public (les articles adoptés à main levée n'ont ni vote par groupe ni, donc, de position de parti).
// Chaque loi appartient à UN thème de la base (thèmes propres à cette source).
export interface LoiRetenue {
  dossier: string;
  theme: string;
  intitule: string;
}

export const LOIS: LoiRetenue[] = [
  { dossier: "DLR5L17N50453", theme: "retraites", intitule: "proposition de loi visant à restaurer un système de retraite plus juste en annulant les dernières réformes" },
  { dossier: "DLR5L17N52922", theme: "budget-securite-sociale", intitule: "projet de loi de financement de la sécurité sociale pour 2026" },
  { dossier: "DLR5L17N52985", theme: "budget-securite-sociale", intitule: "projet de loi relatif à la lutte contre les fraudes sociales et fiscales" },
  { dossier: "DLR5L17N50169", theme: "securite-justice", intitule: "proposition de loi visant à sortir la France du piège du narcotrafic" },
  { dossier: "DLR5L17N50690", theme: "securite-justice", intitule: "proposition de loi visant à renforcer l'autorité de la justice à l'égard des mineurs délinquants et de leurs parents" },
  { dossier: "DLR5L17N53940", theme: "securite-justice", intitule: "projet de loi sur la justice criminelle et le respect des victimes" },
  { dossier: "DLR5L17N53980", theme: "securite-justice", intitule: "projet de loi visant à offrir des réponses immédiates aux phénomènes troublant l'ordre public, la sécurité et la tranquillité publique" },
  { dossier: "DLR5L17N51039", theme: "immigration-nationalite", intitule: "proposition de loi visant à renforcer les conditions d'accès à la nationalité française à Mayotte" },
  { dossier: "DLR5L16N49868", theme: "economie-entreprises", intitule: "projet de loi de simplification de la vie économique" },
  { dossier: "DLR5L17N51670", theme: "sante-fin-de-vie", intitule: "proposition de loi relative au droit à l'aide à mourir" },
  { dossier: "DLR5L17N54083", theme: "armee-defense", intitule: "projet de loi actualisant la programmation militaire pour les années 2024 à 2030" },
  { dossier: "DLR5L17N54085", theme: "agriculture", intitule: "projet de loi d'urgence pour la protection et la souveraineté agricoles" },
  { dossier: "DLR5L17N51968", theme: "logement", intitule: "proposition de loi visant à améliorer l'accès au logement des travailleurs des services publics" },
  { dossier: "DLR5L17N53187", theme: "numerique-jeunesse", intitule: "proposition de loi visant à protéger les mineurs des risques auxquels les expose l'utilisation des réseaux sociaux" },
  { dossier: "DLR5L16N49849", theme: "energie-climat", intitule: "proposition de loi portant programmation nationale pour l'énergie et le climat pour les années 2025 à 2035" },
];
