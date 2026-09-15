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

describe("regles.le-pen-fisc-002 (exonération IR <30 ans)", () => {
  it("concerne un profil de moins de 30 ans", () => {
    const impact = regles["le-pen-fisc-002"](profil({ tranche_age: "moins_30" }), proposition("le-pen-fisc-002"));
    expect(impact.concerne).toBe(true);
  });

  it("ne concerne pas un profil de 30 ans ou plus", () => {
    const impact = regles["le-pen-fisc-002"](profil({ tranche_age: "30_49" }), proposition("le-pen-fisc-002"));
    expect(impact.concerne).toBe(false);
  });
});

describe("regles.le-pen-pa-002 (pensions/ASPA)", () => {
  it("concerne un profil retraité", () => {
    const impact = regles["le-pen-pa-002"](
      profil({ statut_professionnel: "retraite" }),
      proposition("le-pen-pa-002")
    );
    expect(impact.concerne).toBe(true);
  });

  it("ne concerne pas un profil non retraité", () => {
    const impact = regles["le-pen-pa-002"](
      profil({ statut_professionnel: "salarie" }),
      proposition("le-pen-pa-002")
    );
    expect(impact.concerne).toBe(false);
  });
});

describe("regles.melenchon-fisc-002 (ISF)", () => {
  it("concerne un profil au patrimoine supérieur à 1,3M€", () => {
    const impact = regles["melenchon-fisc-002"](
      profil({ tranche_patrimoine: "plus_1_3m" }),
      proposition("melenchon-fisc-002")
    );
    expect(impact.concerne).toBe(true);
  });

  it("ne concerne pas un profil au patrimoine inférieur à 500k€", () => {
    const impact = regles["melenchon-fisc-002"](
      profil({ tranche_patrimoine: "moins_100k" }),
      proposition("melenchon-fisc-002")
    );
    expect(impact.concerne).toBe(false);
  });
});

describe("regles.melenchon-pa-001 (SMIC)", () => {
  it("concerne un salarié à revenu proche du SMIC", () => {
    const impact = regles["melenchon-pa-001"](
      profil({ statut_professionnel: "salarie", tranche_revenus: "moins_1200" }),
      proposition("melenchon-pa-001")
    );
    expect(impact.concerne).toBe(true);
  });

  it("ne concerne pas un salarié à revenu élevé", () => {
    const impact = regles["melenchon-pa-001"](
      profil({ statut_professionnel: "salarie", tranche_revenus: "plus_5000" }),
      proposition("melenchon-pa-001")
    );
    expect(impact.concerne).toBe(false);
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
  });

  it("ne concerne pas un étudiant", () => {
    const impact = regles["philippe-pa-001"](profil({ statut_professionnel: "etudiant" }), proposition("philippe-pa-001"));
    expect(impact.concerne).toBe(false);
  });
});
