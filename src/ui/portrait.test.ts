import { describe, expect, it } from "vitest";
import { initiales } from "./portrait";

describe("initiales", () => {
  it("prend la première lettre de chaque mot du nom, en majuscule", () => {
    expect(initiales("Gabriel Attal")).toBe("GA");
    expect(initiales("Marine Le Pen")).toBe("MLP");
    expect(initiales("PARTI SOCIALISTE")).toBe("PS");
  });

  it("traite un prénom ou un nom composé comme un seul mot", () => {
    expect(initiales("Jean-Luc Mélenchon")).toBe("JM");
    expect(initiales("Nicolas Dupont-Aignan")).toBe("ND");
  });

  it("garde l'accent d'une initiale et se limite à trois lettres", () => {
    expect(initiales("Éric Zemmour")).toBe("ÉZ");
    expect(initiales("Anne de la Fontaine du Bois")).toBe("ADL");
  });

  it("ne plante pas sur un nom vide ou avec des espaces en trop", () => {
    expect(initiales("")).toBe("");
    expect(initiales("  Marine   Tondelier ")).toBe("MT");
  });
});
