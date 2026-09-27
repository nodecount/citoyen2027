import { describe, expect, it } from "vitest";
import { cheminDeLEcran, ecranDepuisChemin, type Ecran } from "./router";

const ECRANS: Ecran[] = ["accueil", "themes", "questions-generales", "a-propos"];

describe("routeur", () => {
  it("donne à chaque écran sa propre adresse", () => {
    expect(cheminDeLEcran("accueil")).toBe("/");
    expect(cheminDeLEcran("themes")).toBe("/themes");
    expect(cheminDeLEcran("questions-generales")).toBe("/ma-situation");
    expect(cheminDeLEcran("a-propos")).toBe("/a-propos");
    expect(new Set(ECRANS.map(cheminDeLEcran)).size).toBe(ECRANS.length);
  });

  it("retrouve l'écran depuis l'adresse (aller-retour exact)", () => {
    for (const ecran of ECRANS) expect(ecranDepuisChemin(cheminDeLEcran(ecran))).toBe(ecran);
  });

  it("renvoie vers l'accueil pour une adresse inconnue, plutôt qu'une page blanche", () => {
    expect(ecranDepuisChemin("/nimporte-quoi")).toBe("accueil");
    expect(ecranDepuisChemin("")).toBe("accueil");
  });
});
