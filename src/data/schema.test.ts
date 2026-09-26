import { describe, it, expect } from "vitest";
import themesRaw from "../../data/bases/officielle/themes.json";
import profilSchemaRaw from "../../data/profils-schema.json";
import type { Theme, ChampProfil } from "../types";

const themes: Theme[] = themesRaw as Theme[];
const profilSchema: ChampProfil[] = profilSchemaRaw as ChampProfil[];

const THEME_IDS = [
  "fiscalite",
  "pouvoir-achat",
  "travail",
  "aides-etat",
  "libertes-fondamentales",
  "sante",
  "securite",
  "immigration",
  "education",
  "environnement",
  "logement",
  "retraites",
];

const THEMES_POPULATED = new Set([
  "fiscalite",
  "pouvoir-achat",
  "sante",
  "securite",
  "immigration",
  "education",
  "environnement",
  "logement",
  "travail",
  "aides-etat",
  "libertes-fondamentales",
]);

describe("themes.json", () => {
  it("déclare exactement les 12 thèmes prévus, chacun avec id/libelle/question_citoyen/description", () => {
    expect(themes).toHaveLength(12);
    const ids = themes.map((t) => t.id).sort();
    expect(ids).toEqual([...THEME_IDS].sort());
    for (const theme of themes) {
      expect(typeof theme.libelle).toBe("string");
      expect(theme.libelle.length).toBeGreaterThan(0);
      expect(typeof theme.description).toBe("string");
      expect(theme.description.length).toBeGreaterThan(0);
    }
  });

  it("a le statut attendu (11 thèmes populated ; retraites provisoire tant que non collecté)", () => {
    for (const theme of themes) {
      const expected = THEMES_POPULATED.has(theme.id) ? "populated" : "provisoire";
      expect(theme.statut).toBe(expected);
    }
  });
});

const EXPECTED_CHAMP_IDS = [
  "statut_professionnel",
  "tranche_revenus",
  "situation_familiale",
  "nombre_enfants",
  "logement",
  "secteur_activite",
  "region",
  "tranche_age",
  "tranche_patrimoine",
];

describe("profils-schema.json", () => {
  it("liste exactement les 9 champs de profil attendus (ni plus, ni moins)", () => {
    const ids = profilSchema.map((f) => f.id);
    expect(ids.sort()).toEqual([...EXPECTED_CHAMP_IDS].sort());
  });

  it("chaque option d'un champ à choix a un libellé lisible, et seulement celles-là", () => {
    for (const champ of profilSchema.filter((c) => c.type === "enum")) {
      expect(Object.keys(champ.libelles ?? {}).sort(), champ.id).toEqual([...(champ.options ?? [])].sort());
      for (const libelle of Object.values(champ.libelles ?? {})) expect(libelle.trim().length).toBeGreaterThan(0);
    }
  });

  it("chaque champ a un type valide et des options ssi type === enum", () => {
    for (const champ of profilSchema) {
      expect(["enum", "number", "text"]).toContain(champ.type);
      if (champ.type === "enum") {
        expect(Array.isArray(champ.options)).toBe(true);
        expect((champ.options as string[]).length).toBeGreaterThan(0);
      } else {
        expect(champ.options).toBeUndefined();
      }
    }
  });
});
