import { describe, it, expect } from "vitest";
import { regles } from "./regles";
import type { Profil, Proposition } from "../types";

function profil(overrides: Partial<Profil> = {}): Profil {
  return {
    statut_professionnel: "salarie",
    tranche_revenus: "2000_3000",
    situation_familiale: "celibataire",
    nombre_enfants: 0,
    logement: "locataire",
    secteur_activite: "commerce",
    region: "Île-de-France",
    tranche_age: "30_49",
    tranche_patrimoine: "moins_100k",
    ...overrides,
  };
}

function proposition(id: string, overrides: Partial<Proposition> = {}): Proposition {
  return {
    id,
    candidat: "test",
    theme: "fiscalite",
    titre: "Titre test",
    resume_factuel: "Résumé factuel test.",
    sources: [],
    chiffrage_disponible: false,
    hypotheses_calcul: "",
    statut: "complet",
    date_derniere_verification: "2026-09-15",
    ...overrides,
  };
}

describe("regles.melenchon-fisc-002 (ISF)", () => {
  it("concerne un profil au patrimoine supérieur à 1,3M€", () => {
    const impact = regles["melenchon-fisc-002"](
      profil({ tranche_patrimoine: "plus_1_3m" }),
      proposition("melenchon-fisc-002")
    );
    expect(impact.concerne).toBe(true);
    expect(impact.explication).toContain("Résumé factuel test.");
    expect(impact.explication).toContain("Institut Montaigne");
  });

  it("concerne un profil dans la tranche 500k-1,3M€ (hypothèse Institut Montaigne)", () => {
    const impact = regles["melenchon-fisc-002"](
      profil({ tranche_patrimoine: "500k_1_3m" }),
      proposition("melenchon-fisc-002")
    );
    expect(impact.concerne).toBe(true);
    expect(impact.explication).toContain("Institut Montaigne");
  });

  it("ne concerne pas un profil au patrimoine inférieur à 500k€, mais le volet flat tax reste non évalué", () => {
    const impact = regles["melenchon-fisc-002"](
      profil({ tranche_patrimoine: "moins_100k" }),
      proposition("melenchon-fisc-002")
    );
    expect(impact.concerne).toBe(false);
    expect(impact.explication).toContain("Résumé factuel test.");
    expect(impact.explication).toContain("Institut Montaigne");
    expect(impact.explication).toContain("flat tax");
  });
});

describe("regles.melenchon-pa-001 (SMIC)", () => {
  it("concerne un salarié à revenu proche du SMIC", () => {
    const impact = regles["melenchon-pa-001"](
      profil({ statut_professionnel: "salarie", tranche_revenus: "moins_1200" }),
      proposition("melenchon-pa-001")
    );
    expect(impact.concerne).toBe(true);
    expect(impact.explication).toContain("Résumé factuel test.");
  });

  it("concerne un salarié dans la tranche 1200-2000 (second bras du OR)", () => {
    const impact = regles["melenchon-pa-001"](
      profil({ statut_professionnel: "salarie", tranche_revenus: "1200_2000" }),
      proposition("melenchon-pa-001")
    );
    expect(impact.concerne).toBe(true);
  });

  it("ne concerne pas un salarié à revenu élevé, mais le volet indexation reste non évalué", () => {
    const impact = regles["melenchon-pa-001"](
      profil({ statut_professionnel: "salarie", tranche_revenus: "plus_5000" }),
      proposition("melenchon-pa-001")
    );
    expect(impact.concerne).toBe(false);
    expect(impact.explication).toContain("Résumé factuel test.");
    expect(impact.explication).toContain("indexation");
  });

  it("ne concerne pas un indépendant même à faible revenu", () => {
    const impact = regles["melenchon-pa-001"](
      profil({ statut_professionnel: "independant", tranche_revenus: "moins_1200" }),
      proposition("melenchon-pa-001")
    );
    expect(impact.concerne).toBe(false);
  });
});

describe("regles.philippe-pa-001 (salaire net des actifs)", () => {
  it("concerne un salarié", () => {
    const impact = regles["philippe-pa-001"](profil({ statut_professionnel: "salarie" }), proposition("philippe-pa-001"));
    expect(impact.concerne).toBe(true);
    expect(impact.explication).toContain("Résumé factuel test.");
  });

  it("ne concerne pas un étudiant", () => {
    const impact = regles["philippe-pa-001"](profil({ statut_professionnel: "etudiant" }), proposition("philippe-pa-001"));
    expect(impact.concerne).toBe(false);
    expect(impact.explication).toContain("Résumé factuel test.");
  });
});
