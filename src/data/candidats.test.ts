import { describe, it, expect } from "vitest";
import { regles } from "../engine/regles";
import themesRaw from "../../data/themes.json";
import lePenMetaRaw from "../../data/programmes/le-pen/meta.json";
import lePenPropsRaw from "../../data/programmes/le-pen/propositions.json";
import melenchonMetaRaw from "../../data/programmes/melenchon/meta.json";
import melenchonPropsRaw from "../../data/programmes/melenchon/propositions.json";
import philippeMetaRaw from "../../data/programmes/philippe/meta.json";
import philippePropsRaw from "../../data/programmes/philippe/propositions.json";
import type { Theme, CandidatMeta, Proposition } from "../types";

const themes: Theme[] = themesRaw as Theme[];
const lePenMeta: CandidatMeta = lePenMetaRaw as CandidatMeta;
const lePenProps: Proposition[] = lePenPropsRaw as Proposition[];
const melenchonMeta: CandidatMeta = melenchonMetaRaw as CandidatMeta;
const melenchonProps: Proposition[] = melenchonPropsRaw as Proposition[];
const philippeMeta: CandidatMeta = philippeMetaRaw as CandidatMeta;
const philippeProps: Proposition[] = philippePropsRaw as Proposition[];

const THEME_IDS = new Set(themes.map((t) => t.id));
const STATUTS = new Set(["complet", "partiel", "provisoire"]);
const THEMES_PEUPLES = [
  "fiscalite",
  "pouvoir-achat",
  "sante",
  "securite",
  "immigration",
  "education",
  "environnement",
  "logement",
];

const candidats = [
  { slug: "le-pen", meta: lePenMeta, propositions: lePenProps },
  { slug: "melenchon", meta: melenchonMeta, propositions: melenchonProps },
  { slug: "philippe", meta: philippeMeta, propositions: philippeProps },
];

describe.each(candidats)("candidat $slug", ({ slug, meta, propositions }) => {
  it("a un meta.json complet", () => {
    expect(meta.slug).toBe(slug);
    expect(meta.nom.length).toBeGreaterThan(0);
    expect(meta.parti.length).toBeGreaterThan(0);
    expect(meta.sources_officielles.length).toBeGreaterThan(0);
    expect(meta.date_derniere_maj.length).toBeGreaterThan(0);
  });

  it("chaque proposition référence un thème connu et un statut valide", () => {
    for (const p of propositions) {
      expect(THEME_IDS.has(p.theme)).toBe(true);
      expect(STATUTS.has(p.statut)).toBe(true);
      expect(p.candidat).toBe(slug);
    }
  });

  it("chaque proposition a un titre, un résumé factuel et des hypothèses de calcul non vides", () => {
    for (const p of propositions) {
      expect(typeof p.titre).toBe("string");
      expect(p.titre.length).toBeGreaterThan(0);
      expect(typeof p.resume_factuel).toBe("string");
      expect(p.resume_factuel.length).toBeGreaterThan(0);
      expect(typeof p.hypotheses_calcul).toBe("string");
      expect(p.hypotheses_calcul.length).toBeGreaterThan(0);
    }
  });

  it("chaque proposition au statut complet a au moins 2 sources dont 1 primaire", () => {
    for (const p of propositions.filter((p) => p.statut === "complet")) {
      expect(p.sources.length).toBeGreaterThanOrEqual(2);
      expect(p.sources.some((s) => s.type === "primaire")).toBe(true);
    }
  });

  it("chaque source a un type primaire ou secondaire", () => {
    for (const p of propositions) {
      for (const s of p.sources) {
        expect(["primaire", "secondaire"]).toContain(s.type);
      }
    }
  });

  it("aucune proposition complète en dehors des thèmes peuplés du plan", () => {
    for (const p of propositions) {
      if (p.statut === "complet") {
        expect(THEMES_PEUPLES).toContain(p.theme);
      }
    }
  });

  it.each(THEMES_PEUPLES)("a au moins une proposition complete sur le thème %s", (themeId) => {
    const propsDuTheme = propositions.filter(
      (p) => p.theme === themeId && p.statut === "complet"
    );
    expect(propsDuTheme.length).toBeGreaterThan(0);
  });
});

describe("ids des propositions", () => {
  it("les ids de propositions, tous candidats confondus, sont uniques", () => {
    const allProps = [...lePenProps, ...melenchonProps, ...philippeProps];
    const ids = allProps.map((p) => p.id);
    expect(ids.length).toBe(50);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("regles (src/engine/regles.ts)", () => {
  it("chaque clé de `regles` correspond à un id de proposition réel existant", () => {
    const allProps = [...lePenProps, ...melenchonProps, ...philippeProps];
    const idsConnus = new Set(allProps.map((p) => p.id));
    for (const cle of Object.keys(regles)) {
      expect(idsConnus.has(cle)).toBe(true);
    }
  });
});
