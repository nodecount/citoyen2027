import { describe, expect, it } from "vitest";
import { aDesConvictions, assainirConvictions, CONVICTIONS_VIDES, lireConvictions } from "./memoireConvictions";

describe("assainirConvictions", () => {
  it("garde les groupes connus et l'exemplarité", () => {
    expect(assainirConvictions({ groupes: ["jeunes", "retraites"], exemplarite: true })).toEqual({ groupes: ["jeunes", "retraites"], exemplarite: true });
  });
  it("écarte un groupe disparu du catalogue, sans erreur", () => {
    expect(assainirConvictions({ groupes: ["jeunes", "inconnu"], exemplarite: false }).groupes).toEqual(["jeunes"]);
  });
  it("écarte les doublons et les types inattendus", () => {
    expect(assainirConvictions({ groupes: ["jeunes", "jeunes", 3, null], exemplarite: "oui" })).toEqual({ groupes: ["jeunes"], exemplarite: false });
  });
  it.each([null, undefined, "x", 4, [], { groupes: "jeunes" }])("valeur corrompue %j : convictions vides", (brut) => {
    expect(assainirConvictions(brut)).toEqual(CONVICTIONS_VIDES);
  });
});

describe("lireConvictions / aDesConvictions", () => {
  it("sans stockage disponible (rendu serveur) : convictions vides", () => {
    expect(lireConvictions()).toEqual(CONVICTIONS_VIDES);
  });
  it("aDesConvictions est faux pour le vide, vrai dès un choix", () => {
    expect(aDesConvictions(CONVICTIONS_VIDES)).toBe(false);
    expect(aDesConvictions({ groupes: [], exemplarite: true })).toBe(true);
    expect(aDesConvictions({ groupes: ["jeunes"], exemplarite: false })).toBe(true);
  });
});
