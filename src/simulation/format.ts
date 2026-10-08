import type { Gagnant } from "./electorats";

// Mise en texte des résultats de simulation, partagée par le rapport markdown (run-electorats.ts) et la page « Tests de situations ».

const signe = (n: number) => (n > 0 ? "+" : "") + n;

export function formaterGagnants(gagnants: Gagnant[], departageable: boolean): string {
  if (!departageable) return "égalité parfaite à 0 : aucun candidat ne se détache";
  return gagnants.map((g) => `${g.nom} (${signe(g.solde)} = ${g.ameliorants} pour − ${g.degradants} contre, sur ${g.analyses})`).join(" ; ");
}

export function formaterSuivants(suivants: Gagnant[]): string {
  return suivants.length === 0 ? "—" : suivants.map((g) => `${g.nom} (${signe(g.solde)})`).join(", ");
}
