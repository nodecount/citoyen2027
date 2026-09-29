import { describe, expect, it } from "vitest";
import { aDesConvictions, assainirConvictions, CONVICTIONS_VIDES, lireConvictions } from "./memoireConvictions";

describe("assainirConvictions", () => {
  it("garde les groupes connus et l'exemplarité", () => {
    expect(assainirConvictions({ groupes: ["tranche_age:moins_30", "statut_professionnel:retraite"], exemplarite: true })).toEqual({ groupes: ["tranche_age:moins_30", "statut_professionnel:retraite"], exemplarite: true });
  });
  it("écarte un groupe disparu du catalogue, sans erreur", () => {
    expect(assainirConvictions({ groupes: ["tranche_age:moins_30", "inconnu"], exemplarite: false }).groupes).toEqual(["tranche_age:moins_30"]);
  });
  it("écarte les doublons et les types inattendus", () => {
    expect(assainirConvictions({ groupes: ["tranche_age:moins_30", "tranche_age:moins_30", 3, null], exemplarite: "oui" })).toEqual({ groupes: ["tranche_age:moins_30"], exemplarite: false });
  });
  it.each([null, undefined, "x", 4, [], { groupes: "tranche_age:moins_30" }])("valeur corrompue %j : convictions vides", (brut) => {
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
    expect(aDesConvictions({ groupes: ["tranche_age:moins_30"], exemplarite: false })).toBe(true);
  });
});
