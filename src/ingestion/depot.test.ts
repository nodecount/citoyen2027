import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  chargerAVerifier,
  chargerJournal,
  chargerPropositions,
  chargerSyntheses,
  chargerSynthesesAVerifier,
  combinaisonDejaCherchee,
  combinaisonDejaCouverte,
  enregistrerAVerifier,
  enregistrerJournal,
  enregistrerPropositions,
  enregistrerSynthese,
  enregistrerSyntheseAVerifier,
} from "./depot";
import type { Proposition, SyntheseTheme } from "../types";

let racine: string;

function proposition(theme: string): Proposition & Required<Pick<Proposition, "effets">> {
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
    effets: [],
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

describe("syntheses", () => {
  afterEach(() => {
    rmSync(racine, { recursive: true, force: true });
  });

  function synthese(theme: string, texte = "Texte."): SyntheseTheme {
    return { theme, texte, propositions: [`test-${theme}-001`], date_derniere_verification: "2026-09-24" };
  }

  it("chargerSyntheses retourne un tableau vide si le fichier n'existe pas", () => {
    racine = mkdtempSync(resolve(tmpdir(), "ingestion-test-"));
    expect(chargerSyntheses("candidat-x", racine)).toEqual([]);
  });

  it("enregistrerSynthese puis chargerSyntheses retrouve la synthèse", () => {
    racine = mkdtempSync(resolve(tmpdir(), "ingestion-test-"));
    enregistrerSynthese("candidat-x", synthese("sante"), racine);
    expect(chargerSyntheses("candidat-x", racine)).toEqual([synthese("sante")]);
  });

  it("remplace la synthèse d'un même thème sans toucher aux autres, en ordre stable par thème", () => {
    racine = mkdtempSync(resolve(tmpdir(), "ingestion-test-"));
    enregistrerSynthese("candidat-x", synthese("sante"), racine);
    enregistrerSynthese("candidat-x", synthese("fiscalite"), racine);
    enregistrerSynthese("candidat-x", synthese("sante", "Nouveau texte."), racine);
    const syntheses = chargerSyntheses("candidat-x", racine);
    expect(syntheses.map((s) => s.theme)).toEqual(["fiscalite", "sante"]);
    expect(syntheses.find((s) => s.theme === "sante")?.texte).toBe("Nouveau texte.");
  });

  it("les synthèses en échec vont dans un fichier séparé, jamais dans synthese.json", () => {
    racine = mkdtempSync(resolve(tmpdir(), "ingestion-test-"));
    const entree = { theme: "sante", texte: "Texte refusé.", propositions: ["test-sante-001"], raison: "affirmation non étayée" };
    enregistrerSyntheseAVerifier("candidat-x", entree, racine);
    expect(chargerSynthesesAVerifier("candidat-x", racine)).toEqual([entree]);
    expect(chargerSyntheses("candidat-x", racine)).toEqual([]);
  });

  it("remplace l'entrée à vérifier d'un même thème plutôt que d'en empiler", () => {
    racine = mkdtempSync(resolve(tmpdir(), "ingestion-test-"));
    const a = { theme: "sante", texte: "A", propositions: [], raison: "r1" };
    enregistrerSyntheseAVerifier("candidat-x", a, racine);
    enregistrerSyntheseAVerifier("candidat-x", { ...a, raison: "r2" }, racine);
    expect(chargerSynthesesAVerifier("candidat-x", racine)).toHaveLength(1);
    expect(chargerSynthesesAVerifier("candidat-x", racine)[0].raison).toBe("r2");
  });
});

describe("journal de recherche (dépôt)", () => {
  afterEach(() => {
    rmSync(racine, { recursive: true, force: true });
  });

  const entree = (theme: string, resultat: "aucune_mesure" | "propositions_generees" = "aucune_mesure") => ({
    theme, date: "2026-09-25", resultat, nombre_propositions: 0, arret: "end_turn", duree_ms: 1, jetons_entree: 1,
    jetons_sortie: 1, urls_lues: [], urls_echouees: [], requetes: [],
  });

  it("retourne une liste vide sans fichier, puis retrouve l'entrée enregistrée", () => {
    racine = mkdtempSync(resolve(tmpdir(), "ingestion-test-"));
    expect(chargerJournal("candidat-x", racine)).toEqual([]);
    enregistrerJournal("candidat-x", entree("sante"), racine);
    expect(chargerJournal("candidat-x", racine)).toEqual([entree("sante")]);
  });

  it("remplace l'entrée d'un même thème et garde un ordre stable", () => {
    racine = mkdtempSync(resolve(tmpdir(), "ingestion-test-"));
    enregistrerJournal("candidat-x", entree("sante"), racine);
    enregistrerJournal("candidat-x", entree("fiscalite"), racine);
    enregistrerJournal("candidat-x", entree("sante", "propositions_generees"), racine);
    const journal = chargerJournal("candidat-x", racine);
    expect(journal.map((e) => e.theme)).toEqual(["fiscalite", "sante"]);
    expect(journal[1].resultat).toBe("propositions_generees");
  });

  it("combinaisonDejaCherchee : vrai seulement pour une recherche sans résultat", () => {
    expect(combinaisonDejaCherchee([entree("sante")], "sante")).toBe(true);
    expect(combinaisonDejaCherchee([entree("sante", "propositions_generees")], "sante")).toBe(false);
    expect(combinaisonDejaCherchee([entree("sante")], "fiscalite")).toBe(false);
  });
});
