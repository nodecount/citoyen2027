import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Proposition, Theme } from "../types";
import { ecrireCandidats, mettreAJourStatutsThemes, retirerAbsents } from "./ecriture";
import type { CandidatConverti } from "./ifrap";

let racine: string;
beforeEach(() => {
  racine = mkdtempSync(join(tmpdir(), "base-test-"));
});
afterEach(() => {
  rmSync(racine, { recursive: true, force: true });
});

function proposition(theme: string): Proposition {
  return { id: `x-${theme}-001`, candidat: "x", theme, titre: "T", resume_factuel: "R", sources: [], chiffrage_disponible: false, hypotheses_calcul: "H", statut: "partiel", date_derniere_verification: "2026-09-26" };
}

const CANDIDAT: CandidatConverti = {
  meta: { slug: "x", nom: "X", parti: "P", sources_officielles: [], date_derniere_maj: "2026-09-26" },
  propositions: [proposition("a")],
};

describe("ecrireCandidats", () => {
  it("écrit meta.json et propositions.json dans programmes/<slug>/, comme la base officielle", () => {
    ecrireCandidats(racine, [CANDIDAT]);
    expect(JSON.parse(readFileSync(join(racine, "programmes/x/meta.json"), "utf-8")).nom).toBe("X");
    expect(JSON.parse(readFileSync(join(racine, "programmes/x/propositions.json"), "utf-8"))).toHaveLength(1);
  });

  it("remplace les propositions au lieu de les cumuler quand on relance, et ne touche pas aux autres fichiers", () => {
    ecrireCandidats(racine, [CANDIDAT]);
    writeFileSync(join(racine, "programmes/x/notes.txt"), "à garder");
    ecrireCandidats(racine, [{ ...CANDIDAT, propositions: [proposition("a"), proposition("b")] }]);
    ecrireCandidats(racine, [CANDIDAT]);
    expect(JSON.parse(readFileSync(join(racine, "programmes/x/propositions.json"), "utf-8"))).toHaveLength(1);
    expect(readFileSync(join(racine, "programmes/x/notes.txt"), "utf-8")).toBe("à garder");
  });
});

describe("retirerAbsents", () => {
  it("retire les candidats que la source ne liste plus (iso source) et garde les autres", () => {
    ecrireCandidats(racine, [CANDIDAT, { ...CANDIDAT, meta: { ...CANDIDAT.meta, slug: "y" } }]);
    expect(retirerAbsents(racine, ["x"])).toEqual(["y"]);
    expect(existsSync(join(racine, "programmes/y"))).toBe(false);
    expect(existsSync(join(racine, "programmes/x/meta.json"))).toBe(true);
  });
});

describe("mettreAJourStatutsThemes", () => {
  const themes: Theme[] = [
    { id: "a", libelle: "A", question_citoyen: "?", description: "d", statut: "provisoire" },
    { id: "b", libelle: "B", question_citoyen: "?", description: "d", statut: "populated" },
  ];

  it("passe en « populated » les thèmes couverts et en « provisoire » les autres", () => {
    writeFileSync(join(racine, "themes.json"), JSON.stringify(themes));
    mettreAJourStatutsThemes(racine, [CANDIDAT]);
    const apres = JSON.parse(readFileSync(join(racine, "themes.json"), "utf-8")) as Theme[];
    expect(apres.map((t) => [t.id, t.statut])).toEqual([["a", "populated"], ["b", "provisoire"]]);
  });

  it("refuse une proposition dont le thème n'est pas dans le référentiel de la base", () => {
    writeFileSync(join(racine, "themes.json"), JSON.stringify(themes));
    expect(() => mettreAJourStatutsThemes(racine, [{ ...CANDIDAT, propositions: [proposition("zzz")] }])).toThrow("absent");
  });

  it("échoue clairement sans référentiel", () => {
    expect(existsSync(join(racine, "themes.json"))).toBe(false);
    expect(() => mettreAJourStatutsThemes(racine, [CANDIDAT])).toThrow("introuvable");
  });
});
