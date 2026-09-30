import { describe, expect, it } from "vitest";
import type { Meilleurs, Solde } from "../engine/candidatIdeal";
import type { Correspondance } from "./aveugle";
import { versResultatAffiche } from "./resultatIdeal";

const solde = (slug: string, ameliorants: number, degradants: number, analyses = 7): Solde => ({ slug, ameliorants, degradants, analyses, solde: ameliorants - degradants });
const CORRESPONDANCE: Correspondance[] = [
  { lettre: "C", nom: "Nom Réel Un", slug: "un", parti: "Parti Un" },
  { lettre: "F", nom: "Nom Réel Deux", slug: "deux", parti: "Parti Deux" },
];
const meilleur = (gagnants: Solde[], extra: Partial<Meilleurs> = {}): Meilleurs => ({ solde: 2, gagnants, departageable: true, ecartes: 0, tousEcartes: false, ...extra });

describe("versResultatAffiche : le pont entre les soldes (slugs réels) et la card (lettres)", () => {
  it("révélé : chaque gagnant porte SON nom, son parti et SA lettre, sans mélange", () => {
    const r = versResultatAffiche("Selon votre situation", "thèmes", meilleur([solde("deux", 3, 1), solde("un", 3, 1)]), CORRESPONDANCE, true)!;
    const parLettre = Object.fromEntries(r.gagnants.map((g) => [g.lettre, g.identite]));
    expect(parLettre.C).toEqual({ slug: "un", nom: "Nom Réel Un", parti: "Parti Un" });
    expect(parLettre.F).toEqual({ slug: "deux", nom: "Nom Réel Deux", parti: "Parti Deux" });
  });
  it("non révélé : aucune identité n'est transmise à la card, seulement les lettres", () => {
    const r = versResultatAffiche("Selon votre situation", "thèmes", meilleur([solde("un", 3, 1)]), CORRESPONDANCE, false)!;
    expect(r.gagnants[0]).toMatchObject({ lettre: "C", identite: null });
    expect(JSON.stringify(r)).not.toContain("Nom Réel");
    expect(JSON.stringify(r)).not.toContain('"un"'); // pas même le slug réel
  });
  it("reprend le solde, la couverture et les indicateurs de la règle", () => {
    const r = versResultatAffiche("T", "constats", meilleur([solde("un", 3, 1, 9)], { solde: 2, ecartes: 1, tousEcartes: false }), CORRESPONDANCE, true)!;
    expect(r).toMatchObject({ titre: "T", unite: "constats", solde: 2, departageable: true, ecartes: 1, tousEcartes: false });
    expect(r.gagnants[0]).toMatchObject({ ameliorants: 3, degradants: 1, analyses: 9 });
  });
  it("correspondance introuvable pour un slug : lettre « ? » et aucune identité (jamais un nom deviné)", () => {
    const r = versResultatAffiche("T", "thèmes", meilleur([solde("inconnu", 1, 0)]), CORRESPONDANCE, true)!;
    expect(r.gagnants[0]).toMatchObject({ lettre: "?", identite: null });
  });
  it("aucun résultat (null) : null", () => {
    expect(versResultatAffiche("T", "thèmes", null, CORRESPONDANCE, true)).toBeNull();
  });
});
