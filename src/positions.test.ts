import { describe, expect, it } from "vitest";
import { SUJETS_CONVICTION, trouverPosition, validerPositionMesure } from "./positions";

describe("catalogue des sujets de convictions", () => {
  it("huit sujets, chacun avec au moins deux positions opposées (aucune n'est seule)", () => {
    expect(SUJETS_CONVICTION).toHaveLength(8);
    for (const s of SUJETS_CONVICTION) expect(s.positions.length, s.id).toBeGreaterThanOrEqual(2);
  });
  it("identifiants uniques, libellés et définitions renseignés", () => {
    const sujets = SUJETS_CONVICTION.map((s) => s.id);
    expect(new Set(sujets).size).toBe(sujets.length);
    for (const s of SUJETS_CONVICTION) {
      expect(new Set(s.positions.map((p) => p.id)).size).toBe(s.positions.length);
      for (const p of s.positions) {
        expect(p.libelle.length, p.id).toBeGreaterThan(3);
        expect(p.definition.length, p.id).toBeGreaterThan(20);
      }
    }
  });
  it("« pas d'avis » n'est jamais une position (c'est l'absence de choix)", () => {
    for (const s of SUJETS_CONVICTION) for (const p of s.positions) expect(p.libelle.toLowerCase()).not.toContain("pas d'avis");
  });
  it("valide une étiquette de mesure : sujet et position connus, source et extrait présents", () => {
    const bonne = { sujet: "ia", position: "plus_ia", source_url: "https://exemple.fr", extrait: "un extrait assez long" };
    expect(trouverPosition("ia", "plus_ia")).toBeDefined();
    expect(validerPositionMesure(bonne)).toBe(true);
    expect(validerPositionMesure({ ...bonne, position: "inventee" })).toBe(false);
    expect(validerPositionMesure({ ...bonne, sujet: "inconnu" })).toBe(false);
    expect(validerPositionMesure({ ...bonne, extrait: "court" })).toBe(false);
    expect(validerPositionMesure({ ...bonne, source_url: "" })).toBe(false);
    expect(validerPositionMesure(null)).toBe(false);
  });
});
