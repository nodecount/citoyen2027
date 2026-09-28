import { describe, expect, it } from "vitest";
import { CHAMPS_PROFIL } from "../questionnaire";
import { assainirProfil } from "./memoireReponses";

describe("assainirProfil", () => {
  const enums = CHAMPS_PROFIL.find((c) => c.type === "enum" && (c.options?.length ?? 0) > 0)!;

  it("garde une réponse valide", () => {
    const valeur = enums.options![0];
    expect(assainirProfil({ [enums.id]: valeur })[enums.id]).toBe(valeur);
  });

  it("écarte un champ inconnu ou une option devenue inconnue, sans rien deviner", () => {
    const profil = assainirProfil({ [enums.id]: "option_qui_n_existe_plus", champ_retire: "x" });
    expect(profil).toEqual({});
  });

  it("rend un profil vide pour un contenu qui n'est pas un objet", () => {
    for (const brut of [null, undefined, "texte", 12, ["a"]]) expect(assainirProfil(brut)).toEqual({});
  });
});
