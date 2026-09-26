import { valeursDuProfil, type ProfilPartiel } from "../profil";
import type { Profil, Proposition, Impact } from "../types";
import { evaluerParDefaut } from "./evaluerParDefaut";
import { champsRequis, regles } from "./regles";

// Une règle propre à une mesure ne s'applique que si le visiteur a répondu aux questions dont elle dépend : sinon
// explication générale, sans conclure « concerné » ou « non concerné » à sa place.
export function evaluerProposition(profil: ProfilPartiel, proposition: Proposition): Impact {
  const regle = regles[proposition.id];
  const requis = champsRequis[proposition.id] ?? [];
  if (regle && requis.every((champ) => valeursDuProfil(profil, champ) !== null)) return regle(profil as Profil, proposition);
  return evaluerParDefaut(profil, proposition);
}