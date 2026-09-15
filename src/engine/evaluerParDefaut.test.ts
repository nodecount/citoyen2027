import { describe, it, expect } from "vitest";
import { evaluerParDefaut } from "./evaluerParDefaut";
import type { Profil, Proposition } from "../types";

const profil: Profil = {
  statut_professionnel: "salarie",
  tranche_revenus: "2000_3000",
  situation_familiale: "celibataire",
  nombre_enfants: 0,
  logement: "locataire",
  secteur_activite: "commerce",
  region: "Île-de-France",
  tranche_age: "30_49",
  tranche_patrimoine: "moins_100k",
};

function proposition(overrides: Partial<Proposition> = {}): Proposition {
  return {
    id: "test-001",
    candidat: "le-pen",
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

describe("evaluerParDefaut", () => {
  it("concerne toujours le profil et reste qualitatif", () => {
    const impact = evaluerParDefaut(profil, proposition());
    expect(impact.concerne).toBe(true);
    expect(impact.niveau).toBe("qualitatif");
    expect(impact.montant_estime).toBeUndefined();
    expect(impact.explication).toContain("Résumé factuel test.");
  });

  it("mentionne le chiffrage macro sans l'attribuer au foyer, quand il est disponible", () => {
    const impact = evaluerParDefaut(
      profil,
      proposition({
        chiffrage_disponible: true,
        hypotheses_calcul: "Coût estimé à 5 milliards d'euros par an pour l'État.",
      })
    );
    expect(impact.explication).toContain("Chiffrage macro");
    expect(impact.explication).toContain("5 milliards d'euros par an pour l'État");
  });

  it("ne mentionne pas de chiffrage macro quand aucun n'est disponible", () => {
    const impact = evaluerParDefaut(profil, proposition({ chiffrage_disponible: false }));
    expect(impact.explication).not.toContain("Chiffrage macro");
  });
});
