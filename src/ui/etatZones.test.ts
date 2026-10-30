import { describe, expect, it } from "vitest";
import { apresRevelation, choisirOnglet, etatSuggestion, ONGLETS_QUESTIONS } from "./etatZones";

describe("etatSuggestion", () => {
  it("est vide à 0 réponse, partielle dès 1, révélée une fois confirmée", () => {
    expect(etatSuggestion(0, false)).toBe("vide");
    expect(etatSuggestion(1, false)).toBe("partiel");
    expect(etatSuggestion(0, true)).toBe("revele");
    expect(etatSuggestion(5, true)).toBe("revele");
  });
});

describe("onglets", () => {
  it("la révélation ouvre les deux onglets Candidats", () => {
    expect(apresRevelation()).toEqual({ gauche: "candidats", droite: "candidats" });
  });
  it("refuse l'onglet Candidats tant que la suggestion n'est pas révélée", () => {
    expect(choisirOnglet(ONGLETS_QUESTIONS, "gauche", "candidats", false)).toBe(ONGLETS_QUESTIONS);
  });
  it("les deux onglets sont indépendants une fois révélé", () => {
    expect(choisirOnglet(apresRevelation(), "gauche", "questions", true)).toEqual({ gauche: "questions", droite: "candidats" });
  });
});
