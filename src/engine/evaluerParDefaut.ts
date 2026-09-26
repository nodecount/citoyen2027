import type { Profil, Proposition, Impact } from "../types";

// Le profil n'est pas utilisé : l'évaluation par défaut est générale. Un profil partiel est donc accepté.
export function evaluerParDefaut(_profil: Partial<Profil>, proposition: Proposition): Impact {
  let explication = proposition.resume_factuel;
  if (proposition.chiffrage_disponible) {
    explication +=
      " Chiffrage macro (coût ou gain estimé au niveau national, pas un montant par ménage) : " +
      proposition.hypotheses_calcul;
  }
  return {
    concerne: true,
    niveau: "qualitatif",
    explication,
  };
}
