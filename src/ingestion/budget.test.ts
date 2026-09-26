import { describe, expect, it } from "vitest";
import { Budget, BudgetDepasse, coutReelUsd, estimerAppelUsd, TARIFS_PAR_MODELE } from "./budget";

const T = { entree: 3, sortie: 15, ecritureCache: 3.75, lectureCache: 0.3 }; // USD par million de jetons

describe("estimerAppelUsd", () => {
  it("compte l'entrée normale, la sortie maximale, et l'écriture de cache au tarif majoré", () => {
    // 10 000 jetons de corpus mis en cache + 1 000 d'instructions + 8 000 de sortie max
    const usd = estimerAppelUsd(T, { jetonsCorpus: 10_000, jetonsAutres: 1_000, jetonsSortieMax: 8_000, cache: "ecriture" });
    expect(usd).toBeCloseTo((10_000 * 3.75 + 1_000 * 3 + 8_000 * 15) / 1e6, 6);
  });

  it("relit le corpus au tarif du cache quand il est chaud : environ dix fois moins cher", () => {
    const froid = estimerAppelUsd(T, { jetonsCorpus: 100_000, jetonsAutres: 0, jetonsSortieMax: 0, cache: "aucun" });
    const chaud = estimerAppelUsd(T, { jetonsCorpus: 100_000, jetonsAutres: 0, jetonsSortieMax: 0, cache: "lecture" });
    expect(chaud).toBeCloseTo(froid / 10, 6);
  });
});

describe("coutReelUsd", () => {
  it("valorise séparément entrée, sortie, écriture et lecture de cache", () => {
    const usd = coutReelUsd(T, { input_tokens: 1_000, output_tokens: 2_000, cache_creation_input_tokens: 10_000, cache_read_input_tokens: 20_000 });
    expect(usd).toBeCloseTo((1_000 * 3 + 2_000 * 15 + 10_000 * 3.75 + 20_000 * 0.3) / 1e6, 6);
  });

  it("traite un usage absent comme nul plutôt que de planter", () => {
    expect(coutReelUsd(T, undefined)).toBe(0);
    expect(coutReelUsd(T, {})).toBe(0);
  });
});

describe("Budget", () => {
  it("laisse passer un appel dont le coût estimé tient dans le plafond restant", () => {
    const budget = new Budget(1, T, 1); // 1 € plafond, 1 € par USD
    expect(() => budget.verifierAvant(0.4, "appel 1")).not.toThrow();
  });

  it("refuse AVANT l'appel s'il dépasserait le plafond, en donnant les chiffres", () => {
    const budget = new Budget(1, T, 1);
    budget.enregistrer({ input_tokens: 0, output_tokens: 40_000 }); // 0,60 $
    expect(() => budget.verifierAvant(0.5, "génération retailleau × fiscalite")).toThrow(BudgetDepasse);
    try {
      budget.verifierAvant(0.5, "génération retailleau × fiscalite");
    } catch (e) {
      expect((e as Error).message).toContain("retailleau × fiscalite");
      expect((e as Error).message).toMatch(/0[.,]6/); // déjà dépensé
      expect((e as Error).message).toMatch(/plafond/);
    }
  });

  it("cumule la dépense réelle de chaque appel", () => {
    const budget = new Budget(10, T, 0.9);
    budget.enregistrer({ input_tokens: 100_000, output_tokens: 0 }); // 0,30 $ = 0,27 €
    budget.enregistrer({ input_tokens: 100_000, output_tokens: 0 });
    expect(budget.depenseEur).toBeCloseTo(0.54, 6);
    expect(budget.restantEur).toBeCloseTo(9.46, 6);
  });

  it("convertit les dollars en euros avec le taux fourni", () => {
    const budget = new Budget(1, T, 0.5);
    expect(budget.enEuros(2)).toBe(1);
  });
});

describe("TARIFS_PAR_MODELE", () => {
  it("couvre le modèle d'ingestion et garde la lecture de cache moins chère que l'entrée", () => {
    const t = TARIFS_PAR_MODELE["claude-sonnet-5"];
    expect(t).toBeDefined();
    expect(t.lectureCache).toBeLessThan(t.entree);
    expect(t.ecritureCache).toBeGreaterThan(t.entree);
  });
});

describe("Budget.modeCache", () => {
  it("annonce une écriture de cache au départ, puis une lecture tant que le cache est chaud", () => {
    const budget = new Budget(10, T, 1);
    expect(budget.modeCache(1_000)).toBe("ecriture");
    budget.enregistrer({ input_tokens: 10, output_tokens: 1, cache_creation_input_tokens: 5_000 }, 1_000);
    expect(budget.modeCache(60_000)).toBe("lecture");
  });

  it("revient à une écriture quand le cache a expiré (5 minutes sans appel)", () => {
    const budget = new Budget(10, T, 1);
    budget.enregistrer({ cache_read_input_tokens: 5_000 }, 1_000);
    expect(budget.modeCache(1_000 + 6 * 60_000)).toBe("ecriture");
  });
});
