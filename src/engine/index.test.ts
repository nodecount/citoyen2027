import { describe, it, expect } from "vitest";
import { evaluerProposition } from "./index";
import type { Profil, Proposition } from "../types";

const profil: Profil = {
  statut_professionnel: "etudiant",
  tranche_revenus: "moins_1200",
  situation_familiale: "celibataire",
  nombre_enfants: 0,
  logement: "locataire",
  secteur_activite: "",
  region: "Île-de-France",
  tranche_age: "moins_30",
  tranche_patrimoine: "moins_100k",
};

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

describe("evaluerProposition", () => {
  it("utilise la règle dédiée quand elle existe", () => {
    const impact = evaluerProposition(profil, proposition("le-pen-fisc-002"));
    expect(impact.concerne).toBe(true);
  });

  it("retombe sur le comportement par défaut pour un id sans règle dédiée", () => {
    const impact = evaluerProposition(profil, proposition("id-inconnu-sans-regle"));
    expect(impact.concerne).toBe(true);
    expect(impact.niveau).toBe("qualitatif");
  });
});
