import type { Profil, Proposition, Impact } from "../types";

export function evaluerParDefaut(_profil: Profil, proposition: Proposition): Impact {
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
