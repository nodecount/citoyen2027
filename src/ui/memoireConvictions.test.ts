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
    memoriserConvictions({ positions: { nucleaire: "garder_nucleaire" }, exemplarite: true });
    expect(lireConvictions()).toEqual({ positions: { nucleaire: "garder_nucleaire" }, exemplarite: true });
  });
  it("effacer (convictions vides) supprime la clé : plus rien n'est gardé", () => {
    const stockage = faussePage();
    memoriserConvictions({ positions: { ia: "plus_ia" }, exemplarite: false });
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
    expect(() => memoriserConvictions({ positions: {}, exemplarite: true })).not.toThrow();
    expect(lireConvictions()).toEqual(CONVICTIONS_VIDES);
  });
});

describe("assainirConvictions", () => {
  it("garde les positions connues et l'exemplarité", () => {
    expect(assainirConvictions({ positions: { nucleaire: "sortir_nucleaire", ia: "encadrer_ia" }, exemplarite: true })).toEqual({ positions: { nucleaire: "sortir_nucleaire", ia: "encadrer_ia" }, exemplarite: true });
  });
  it("écarte un sujet ou une position disparus du catalogue, sans erreur", () => {
    expect(assainirConvictions({ positions: { nucleaire: "sortir_nucleaire", inconnu: "x", ia: "inventee" }, exemplarite: false }).positions).toEqual({ nucleaire: "sortir_nucleaire" });
  });
  it("une position d'un autre sujet n'est pas acceptée", () => {
    expect(assainirConvictions({ positions: { nucleaire: "plus_ia" } }).positions).toEqual({});
  });
  it("ignore les anciens choix « par groupes » d'une version précédente", () => {
    expect(assainirConvictions({ groupes: ["tranche_age:moins_30"], exemplarite: true })).toEqual({ positions: {}, exemplarite: true });
  });
  it("écarte les types inattendus", () => {
    expect(assainirConvictions({ positions: { ia: 3, europe: null }, exemplarite: "oui" })).toEqual(CONVICTIONS_VIDES);
  });
  it.each([null, undefined, "x", 4, [], { positions: "ia" }, { positions: ["ia"] }])("valeur corrompue %j : convictions vides", (brut) => {
    expect(assainirConvictions(brut)).toEqual(CONVICTIONS_VIDES);
  });
});
describe("lireConvictions / aDesConvictions", () => {
  it("sans stockage disponible (rendu serveur) : convictions vides", () => {
    expect(lireConvictions()).toEqual(CONVICTIONS_VIDES);
  });
  it("aDesConvictions est faux pour le vide, vrai dès un choix", () => {
    expect(aDesConvictions(CONVICTIONS_VIDES)).toBe(false);
    expect(aDesConvictions({ positions: {}, exemplarite: true })).toBe(true);
    expect(aDesConvictions({ positions: { ia: "plus_ia" }, exemplarite: false })).toBe(true);
  });
});
