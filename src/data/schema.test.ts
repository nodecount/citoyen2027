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

// Les questions du formulaire (catalogue) : la validité fine de chaque question et de sa pertinence par base est
// vérifiée dans src/questionnaire.test.ts. Ici, les invariants du fichier lui-même.
describe("profils-schema.json", () => {
  const ids = profilSchema.map((f) => f.id);

  it("garde les questions historiques du profil, avec leurs identifiants (les effets déjà structurés les ciblent)", () => {
    for (const id of ["statut_professionnel", "tranche_revenus", "situation_familiale", "nombre_enfants", "logement", "tranche_age", "tranche_patrimoine"]) {
      expect(ids).toContain(id);
    }
  });

  it("ne pose plus les deux textes libres (région, secteur) : le moteur ne sait pas les apparier, donc les demander serait collecter pour rien", () => {
    expect(ids).not.toContain("region");
    expect(ids).not.toContain("secteur_activite");
  });

  it("chaque champ a un type valide, et des options ssi c'est une question à choix", () => {
    for (const champ of profilSchema) {
      expect(["enum", "multi", "number", "text"]).toContain(champ.type);
      if (champ.type === "enum" || champ.type === "multi") {
        expect(Array.isArray(champ.options)).toBe(true);
        expect((champ.options as string[]).length).toBeGreaterThan(0);
        expect(Object.keys(champ.libelles ?? {}).sort(), champ.id).toEqual([...(champ.options as string[])].sort());
      } else {
        expect(champ.options).toBeUndefined();
      }
    }
  });
});