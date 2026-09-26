import { describe, expect, it } from "vitest";
import { aDesInformations, profilComplet } from "./profil";

describe("aDesInformations", () => {
  it("est faux sans aucune réponse : absent, vide, ou réponses vides", () => {
    expect(aDesInformations(null)).toBe(false);
    expect(aDesInformations(undefined)).toBe(false);
    expect(aDesInformations({})).toBe(false);
    expect(aDesInformations({ region: "", secteur_activite: "   " })).toBe(false);
  });

  it("est vrai dès qu'un champ est répondu", () => {
    expect(aDesInformations({ tranche_age: "30_49" })).toBe(true);
    expect(aDesInformations({ region: "Bretagne" })).toBe(true);
  });

  it("compte « 0 enfant » comme une réponse : ce n'est pas « non répondu »", () => {
    expect(aDesInformations({ nombre_enfants: 0 })).toBe(true);
  });

  it("ignore un nombre invalide", () => {
    expect(aDesInformations({ nombre_enfants: Number.NaN })).toBe(false);
  });
});

describe("profilComplet", () => {
  const COMPLET = {
    statut_professionnel: "salarie", tranche_revenus: "2000_3000", situation_familiale: "en_couple", nombre_enfants: 0,
    logement: "locataire", secteur_activite: "commerce", region: "Bretagne", tranche_age: "30_49", tranche_patrimoine: "moins_100k",
  };

  it("n'est vrai que si les neuf champs sont répondus", () => {
    expect(profilComplet(COMPLET)).toBe(true);
    expect(profilComplet({ ...COMPLET, region: "" })).toBe(false);
    expect(profilComplet({ ...COMPLET, nombre_enfants: undefined })).toBe(false);
    expect(profilComplet({})).toBe(false);
  });
});
