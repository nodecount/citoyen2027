import type { Profil, Proposition, Impact } from "../types";
import { evaluerParDefaut } from "./evaluerParDefaut";
import { regles } from "./regles";

export function evaluerProposition(profil: Profil, proposition: Proposition): Impact {
  const regle = regles[proposition.id];
  return regle ? regle(profil, proposition) : evaluerParDefaut(profil, proposition);
}
