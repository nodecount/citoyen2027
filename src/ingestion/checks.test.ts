import { describe, expect, it } from "vitest";
import {
  verifierChiffresPresents,
  verifierDomaineAutorise,
  verifierUrlDisponible,
} from "./checks";

describe("verifierUrlDisponible", () => {
  it("retourne true si la réponse est ok", async () => {
    const fetchFactice = async () => new Response("", { status: 200 });
    expect(await verifierUrlDisponible("https://exemple.fr", fetchFactice)).toBe(true);
  });

  it("retourne false si la réponse n'est pas ok", async () => {
    const fetchFactice = async () => new Response("", { status: 404 });
    expect(await verifierUrlDisponible("https://exemple.fr", fetchFactice)).toBe(false);
  });

  it("retourne false si fetch lève une exception", async () => {
    const fetchFactice = async () => {
      throw new Error("réseau indisponible");
    };
    expect(await verifierUrlDisponible("https://exemple.fr", fetchFactice)).toBe(false);
  });
});

describe("verifierDomaineAutorise", () => {
  it("accepte un domaine dans la liste", () => {
    expect(verifierDomaineAutorise("https://exemple-officiel.fr/x", ["exemple-officiel.fr"])).toBe(true);
  });

  it("rejette un domaine hors liste", () => {
    expect(verifierDomaineAutorise("https://autre-site.fr/x", ["exemple-officiel.fr"])).toBe(false);
  });

  it("rejette une URL malformée", () => {
    expect(verifierDomaineAutorise("pas-une-url", ["exemple-officiel.fr"])).toBe(false);
  });

  it("accepte un sous-domaine d'un domaine autorisé", () => {
    expect(verifierDomaineAutorise("https://www.exemple-officiel.fr/x", ["exemple-officiel.fr"])).toBe(true);
  });

  it("rejette un domaine qui contient le domaine autorisé comme suffixe de sous-chaîne (attaque par suffixe)", () => {
    expect(verifierDomaineAutorise("https://exemple-officiel.fr.attaquant.com/x", ["exemple-officiel.fr"])).toBe(false);
  });
});

describe("verifierChiffresPresents", () => {
  it("accepte un chiffre présent tel quel", () => {
    expect(verifierChiffresPresents("Coût estimé à 1200 euros", "Le dispositif coûte 1200 euros par an.")).toBe(true);
  });

  it("accepte un chiffre présent avec une séparation différente", () => {
    expect(verifierChiffresPresents("Coût estimé à 1 200 euros", "Le dispositif coûte 1200 euros par an.")).toBe(true);
  });

  it("rejette un chiffre absent du texte", () => {
    expect(verifierChiffresPresents("Coût estimé à 4500 euros", "Le dispositif coûte 1200 euros par an.")).toBe(false);
  });

  it("accepte trivialement s'il n'y a aucun chiffre cité", () => {
    expect(verifierChiffresPresents("Aucun chiffrage précisé par le candidat.", "Texte sans rapport.")).toBe(true);
  });
});
