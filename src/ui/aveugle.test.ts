import { describe, expect, it } from "vitest";
import { candidatsDeBase, chargerBase } from "../data/bases";
import { anonymiserCards, fabriquerEpurateur } from "./aveugle";
import { construireCards } from "./cards";

const meta = { slug: "x", nom: "Marine Le Pen", parti: "Rassemblement National", sources_officielles: [], date_derniere_maj: "" };

describe("simulateur à l'aveugle", () => {
  it("remplace noms et partis dans les textes, à l'endroit et au début de phrase", () => {
    const epurer = fabriquerEpurateur([meta]);
    expect(epurer("Le programme de Le Pen baisse la TVA.")).toBe("Le programme du candidat baisse la TVA.");
    expect(epurer("MARINE LE PEN promet. Rassemblement National aussi.")).toBe("Le candidat promet. Son parti aussi.");
    expect(epurer("Pénalisation des pensions")).toBe("Pénalisation des pensions");
  });

  it.each(["officielle", "agregateurs"])("base « %s » : aucun nom, slug ni adresse de source dans les cartes", (id) => {
    const base = chargerBase(id);
    const candidats = candidatsDeBase(base).avecDonnees;
    const { cards, correspondance } = anonymiserCards(construireCards(base.themes, candidats, { tranche_age: "30_49" }), 42);
    const json = JSON.stringify(cards);
    for (const { meta: m } of candidats) {
      expect(json).not.toContain(m.nom);
      expect(json).not.toContain(`"${m.slug}"`);
    }
    expect(json).not.toContain("http");
    expect(new Set(correspondance.map((c) => c.lettre)).size).toBe(correspondance.length);
  });

  it("la même graine donne les mêmes lettres, une autre graine les mélange autrement", () => {
    const base = chargerBase("agregateurs");
    const cards = construireCards(base.themes, candidatsDeBase(base).avecDonnees, null);
    const noms = (graine: number) => anonymiserCards(cards, graine).correspondance.map((c) => c.nom).join();
    expect(noms(1)).toBe(noms(1));
    expect(noms(1)).not.toBe(noms(2));
  });
});
