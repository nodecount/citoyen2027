import { describe, expect, it } from "vitest";
import { cheminDeLEcran, ecranDepuisChemin, lireOuverture, type Ecran } from "./router";

const ECRANS: Ecran[] = ["accueil", "simulateur", "questions-generales", "a-propos"];

describe("routeur", () => {
  it("donne à chaque écran sa propre adresse", () => {
    expect(cheminDeLEcran("accueil")).toBe("/");
    expect(cheminDeLEcran("simulateur")).toBe("/simulateur");
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

  it("lit le candidat à ouvrir et la carte du thème dans l'adresse", () => {
    expect(lireOuverture("http://x/simulateur?base=agregateurs&candidat=attal#theme-finances-publiques")).toEqual({ theme: "finances-publiques", candidat: "attal" });
    expect(lireOuverture("http://x/simulateur#theme-finances-publiques")).toBeNull();
    expect(lireOuverture("http://x/simulateur?candidat=attal")).toBeNull();
  });
});
