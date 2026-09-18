import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  chargerAVerifier,
  chargerPropositions,
  combinaisonDejaCouverte,
  enregistrerAVerifier,
  enregistrerPropositions,
} from "./depot";
import type { Proposition } from "../types";

let racine: string;

function proposition(theme: string): Proposition {
  return {
    id: `test-${theme}-001`,
    candidat: "test",
    theme,
    titre: "Titre",
    resume_factuel: "Résumé",
    sources: [
      { type: "primaire", label: "A", url: "https://exemple-officiel.fr/a" },
      { type: "primaire", label: "B", url: "https://exemple-officiel.fr/b" },
    ],
    chiffrage_disponible: false,
    hypotheses_calcul: "",
    statut: "complet",
    date_derniere_verification: "2026-09-18",
  };
}

describe("depot", () => {
  afterEach(() => {
    rmSync(racine, { recursive: true, force: true });
  });

  it("chargerPropositions retourne un tableau vide si le fichier n'existe pas", () => {
    racine = mkdtempSync(resolve(tmpdir(), "ingestion-test-"));
    expect(chargerPropositions("candidat-x", racine)).toEqual([]);
  });

  it("enregistrerPropositions puis chargerPropositions retrouve les mêmes données", () => {
    racine = mkdtempSync(resolve(tmpdir(), "ingestion-test-"));
    const props = [proposition("fiscalite")];
    enregistrerPropositions("candidat-x", props, racine);
    expect(chargerPropositions("candidat-x", racine)).toEqual(props);
  });

  it("combinaisonDejaCouverte détecte un thème déjà présent", () => {
    const props = [proposition("fiscalite")];
    expect(combinaisonDejaCouverte(props, "fiscalite")).toBe(true);
    expect(combinaisonDejaCouverte(props, "sante")).toBe(false);
  });

  it("enregistrerAVerifier puis chargerAVerifier retrouve les mêmes entrées", () => {
    racine = mkdtempSync(resolve(tmpdir(), "ingestion-test-"));
    const entrees = [{ theme: "fiscalite", proposition: proposition("fiscalite"), raison: "test" }];
    enregistrerAVerifier("candidat-x", entrees, racine);
    expect(chargerAVerifier("candidat-x", racine)).toEqual(entrees);
  });

  it("chargerAVerifier retourne un tableau vide si le fichier n'existe pas", () => {
    racine = mkdtempSync(resolve(tmpdir(), "ingestion-test-"));
    expect(chargerAVerifier("candidat-x", racine)).toEqual([]);
  });
});
