import { describe, expect, it } from "vitest";
import { cheminDeLEcran, ecranDepuisChemin, lireOuverture, type Ecran } from "./router";

const ECRANS: Ecran[] = ["accueil", "exploration", "simulateur", "questions-generales", "a-propos", "monitoring", "tests-situations"];

describe("routeur", () => {
  it("donne à chaque écran sa propre adresse", () => {
    expect(cheminDeLEcran("accueil")).toBe("/");
    expect(cheminDeLEcran("exploration")).toBe("/exploration");
    expect(cheminDeLEcran("simulateur")).toBe("/simulateur");
    expect(cheminDeLEcran("monitoring")).toBe("/monitoring");
    expect(cheminDeLEcran("tests-situations")).toBe("/tests-situations");
    expect(cheminDeLEcran("questions-generales")).toBe("/ma-situation");
    expect(cheminDeLEcran("a-propos")).toBe("/a-propos");
    expect(new Set(ECRANS.map((e) => cheminDeLEcran(e))).size).toBe(ECRANS.length);
  });

  it("retrouve l'écran depuis l'adresse (aller-retour exact)", () => {
    for (const ecran of ECRANS) expect(ecranDepuisChemin(cheminDeLEcran(ecran))).toBe(ecran);
  });

  it("fonctionne sous un sous-dossier (hébergement dans /citoyen2027/)", () => {
    const base = "/citoyen2027";
    expect(cheminDeLEcran("accueil", base)).toBe("/citoyen2027/");
    expect(cheminDeLEcran("simulateur", base)).toBe("/citoyen2027/simulateur");
    for (const ecran of ECRANS) expect(ecranDepuisChemin(cheminDeLEcran(ecran, base), base)).toBe(ecran);
    expect(ecranDepuisChemin("/citoyen2027", base)).toBe("accueil");
    expect(ecranDepuisChemin("/simulateur", base)).toBe("accueil"); // hors du sous-dossier : inconnu
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
