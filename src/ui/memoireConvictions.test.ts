import { afterEach, describe, expect, it, vi } from "vitest";
import { aDesConvictions, assainirConvictions, CONVICTIONS_VIDES, lireConvictions, memoriserConvictions } from "./memoireConvictions";

// Faux localStorage : l'environnement de test n'a pas de `window`.
function faussePage(stockage: Record<string, string> = {}, refuse = false) {
  const acces = () => {
    if (refuse) throw new Error("stockage refusé");
  };
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => (acces(), stockage[k] ?? null),
      setItem: (k: string, v: string) => (acces(), void (stockage[k] = v)),
      removeItem: (k: string) => (acces(), void delete stockage[k]),
    },
  });
  return stockage;
}
afterEach(() => vi.unstubAllGlobals());

describe("aller-retour dans le navigateur", () => {
  it("mémorise puis relit les convictions", () => {
    faussePage();
    memoriserConvictions({ groupes: ["tranche_age:moins_30"], exemplarite: true });
    expect(lireConvictions()).toEqual({ groupes: ["tranche_age:moins_30"], exemplarite: true });
  });
  it("effacer (convictions vides) supprime la clé : plus rien n'est gardé", () => {
    const stockage = faussePage();
    memoriserConvictions({ groupes: ["tranche_age:moins_30"], exemplarite: false });
    expect(Object.keys(stockage)).toEqual(["convictions-visiteur"]);
    memoriserConvictions(CONVICTIONS_VIDES);
    expect(stockage).toEqual({});
    expect(lireConvictions()).toEqual(CONVICTIONS_VIDES);
  });
  it("JSON corrompu en stockage : convictions vides, sans erreur", () => {
    faussePage({ "convictions-visiteur": "{pas du json" });
    expect(lireConvictions()).toEqual(CONVICTIONS_VIDES);
  });
  it("stockage refusé (navigation privée) : ni lecture ni écriture ne lèvent d'erreur", () => {
    faussePage({}, true);
    expect(() => memoriserConvictions({ groupes: [], exemplarite: true })).not.toThrow();
    expect(lireConvictions()).toEqual(CONVICTIONS_VIDES);
  });
});

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
