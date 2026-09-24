import type { DimensionEffet, SensEffet } from "../effets";

export type Polarite = "favorable" | "defavorable";

// Table de polarité : pour chaque grandeur mesurée sur la situation MATÉRIELLE du citoyen visé,
// quel sens de variation l'améliore. C'est ici — et nulle part ailleurs — que se décide « favorable »
// ou « défavorable » : le modèle d'ingestion ne fait que dire si la grandeur monte ou baisse.
// La même table s'applique à tous les candidats.
//
//   revenu_disponible     ↑ favorable    (plus d'argent disponible après impôts et prélèvements)
//   cout_de_la_vie        ↑ défavorable  (la seule grandeur où une hausse dégrade)
//   emploi                ↑ favorable    (accès à l'emploi, sécurité de l'emploi)
//   protection_sociale    ↑ favorable    (étendue ou niveau de couverture, de prestations)
//   acces_aux_services    ↑ favorable    (soins, école, transports, justice… plus accessibles)
//   droits_et_libertes    ↑ favorable    (droits ou libertés étendus pour le citoyen visé)
//   securite_personnelle  ↑ favorable    (moindre exposition aux atteintes aux personnes et aux biens)
//   patrimoine            ↑ favorable    (valeur ou détention du patrimoine du citoyen visé)
const HAUSSE_FAVORABLE: Record<DimensionEffet, boolean> = {
  revenu_disponible: true,
  cout_de_la_vie: false,
  emploi: true,
  protection_sociale: true,
  acces_aux_services: true,
  droits_et_libertes: true,
  securite_personnelle: true,
  patrimoine: true,
};

// Renvoie null pour un sens indéterminé : sans sens, aucune polarité — on ne devine pas.
export function polarite(dimension: DimensionEffet, sens: SensEffet): Polarite | null {
  if (sens === "indetermine") return null;
  const hausseFavorable = HAUSSE_FAVORABLE[dimension];
  const favorable = sens === "hausse" ? hausseFavorable : !hausseFavorable;
  return favorable ? "favorable" : "defavorable";
}
