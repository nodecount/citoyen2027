import { describe, it, expect } from "vitest";
import themes from "../../data/themes.json";
import lePenMeta from "../../data/programmes/le-pen/meta.json";
import lePenProps from "../../data/programmes/le-pen/propositions.json";
import melenchonMeta from "../../data/programmes/melenchon/meta.json";
import melenchonProps from "../../data/programmes/melenchon/propositions.json";
import philippeMeta from "../../data/programmes/philippe/meta.json";
import philippeProps from "../../data/programmes/philippe/propositions.json";

const THEME_IDS = new Set((themes as any[]).map((t) => t.id));
const STATUTS = new Set(["complet", "partiel", "provisoire"]);
const THEMES_PEUPLES = ["fiscalite", "pouvoir-achat"];

const candidats = [
  { slug: "le-pen", meta: lePenMeta, propositions: lePenProps },
  { slug: "melenchon", meta: melenchonMeta, propositions: melenchonProps },
  { slug: "philippe", meta: philippeMeta, propositions: philippeProps },
];

describe.each(candidats)("candidat $slug", ({ slug, meta, propositions }) => {
  it("a un meta.json complet", () => {
    expect((meta as any).slug).toBe(slug);
    expect((meta as any).nom.length).toBeGreaterThan(0);
    expect((meta as any).parti.length).toBeGreaterThan(0);
    expect((meta as any).sources_officielles.length).toBeGreaterThan(0);
    expect((meta as any).date_derniere_maj.length).toBeGreaterThan(0);
  });

  it("chaque proposition référence un thème connu et un statut valide", () => {
    for (const p of propositions as any[]) {
      expect(THEME_IDS.has(p.theme)).toBe(true);
      expect(STATUTS.has(p.statut)).toBe(true);
      expect(p.candidat).toBe(slug);
    }
  });

  it("chaque proposition au statut complet a au moins 2 sources dont 1 primaire", () => {
    for (const p of (propositions as any[]).filter((p) => p.statut === "complet")) {
      expect(p.sources.length).toBeGreaterThanOrEqual(2);
      expect(p.sources.some((s: any) => s.type === "primaire")).toBe(true);
    }
  });

  it.each(THEMES_PEUPLES)("a au moins une proposition complete sur le thème %s", (themeId) => {
    const propsDuTheme = (propositions as any[]).filter(
      (p) => p.theme === themeId && p.statut === "complet"
    );
    expect(propsDuTheme.length).toBeGreaterThan(0);
  });
});
