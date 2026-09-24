import { describe, expect, it } from "vitest";
import { libelleCitation, sourcesCitees } from "./citations";
import type { Source } from "./types";

const OFFICIELLE: Source = {
  type: "primaire",
  label: "melenchon2027.fr — Page « partage des richesses » du site officiel de campagne (consultée le 18/09/2026)",
  url: "https://melenchon2027.fr/partage",
  nom: "melenchon2027.fr",
  annee: 2026,
};

const AMENDEMENT: Source = {
  type: "primaire",
  label: "Assemblée nationale — Amendement CF119 au PLF 2022",
  url: "https://www.assemblee-nationale.fr/dyn/15/amendements/4709/CION_FIN/CF119",
  nom: "Assemblée nationale",
  annee: 2021,
};

describe("libelleCitation", () => {
  it("formate « nom · année » avec un point du milieu", () => {
    expect(libelleCitation(OFFICIELLE)).toBe("melenchon2027.fr · 2026");
    expect(libelleCitation(AMENDEMENT)).toBe("Assemblée nationale · 2021");
  });

  it("retombe sur le label des anciennes sources sans nom ni année, plutôt que d'inventer", () => {
    const ancienne: Source = { type: "primaire", label: "Ancien libellé", url: "https://exemple-officiel.fr/x" };
    expect(libelleCitation(ancienne)).toBe("Ancien libellé");
  });

  it("n'invente pas l'année quand seul le nom est connu", () => {
    const partielle: Source = { type: "primaire", label: "Libellé", url: "https://exemple.fr", nom: "Exemple" };
    expect(libelleCitation(partielle)).toBe("Libellé");
  });
});

describe("sourcesCitees", () => {
  it("regroupe les sources de plusieurs propositions, sans doublon d'URL, avec lien cliquable", () => {
    const citees = sourcesCitees([
      { sources: [OFFICIELLE, AMENDEMENT] },
      { sources: [OFFICIELLE] },
    ]);
    expect(citees).toEqual([
      { texte: "melenchon2027.fr · 2026", url: OFFICIELLE.url },
      { texte: "Assemblée nationale · 2021", url: AMENDEMENT.url },
    ]);
  });

  it("conserve l'ordre de première apparition : aucun tri qui favoriserait une source", () => {
    const citees = sourcesCitees([{ sources: [AMENDEMENT, OFFICIELLE] }]);
    expect(citees.map((c) => c.texte)).toEqual(["Assemblée nationale · 2021", "melenchon2027.fr · 2026"]);
  });

  it("renvoie une liste vide sans proposition", () => {
    expect(sourcesCitees([])).toEqual([]);
  });
});
