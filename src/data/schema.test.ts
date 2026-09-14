import { describe, it, expect } from "vitest";
import themes from "../../data/themes.json";
import profilSchema from "../../data/profils-schema.json";

const THEME_IDS = [
  "fiscalite",
  "travail",
  "liberte",
  "aides-etat",
  "pouvoir-achat",
  "liberte-expression",
  "liberte-politique",
  "succession",
];

describe("themes.json", () => {
  it("déclare exactement les 8 thèmes prévus, chacun avec id/libelle/description", () => {
    expect(themes).toHaveLength(8);
    const ids = themes.map((t: any) => t.id).sort();
    expect(ids).toEqual([...THEME_IDS].sort());
    for (const theme of themes as any[]) {
      expect(typeof theme.libelle).toBe("string");
      expect(theme.libelle.length).toBeGreaterThan(0);
      expect(typeof theme.description).toBe("string");
      expect(theme.description.length).toBeGreaterThan(0);
    }
  });
});

describe("profils-schema.json", () => {
  it("liste au moins les champs de profil minimaux prévus", () => {
    const ids = (profilSchema as any[]).map((f) => f.id);
    for (const champAttendu of [
      "statut_professionnel",
      "tranche_revenus",
      "situation_familiale",
      "nombre_enfants",
      "logement",
      "secteur_activite",
      "region",
    ]) {
      expect(ids).toContain(champAttendu);
    }
  });
});
