import { describe, it, expect } from "vitest";
import { evaluerProposition } from "./index";
import { champsRequis, regles } from "./regles";
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
    // Profil étudiant : la règle de philippe-pa-001 (mesure des actifs) conclut « non concerné ».
    const impact = evaluerProposition(profil, proposition("philippe-pa-001"));
    expect(impact.concerne).toBe(false);
  });

  it("retombe sur le comportement par défaut pour un id sans règle dédiée", () => {
    const impact = evaluerProposition(profil, proposition("id-inconnu-sans-regle"));
    expect(impact.concerne).toBe(true);
    expect(impact.niveau).toBe("qualitatif");
  });

  it("n'applique pas une règle dédiée quand le visiteur n'a pas répondu aux questions dont elle dépend", () => {
    // Sans le statut professionnel, « actif » ne peut pas être conclu : explication générale, jamais « non concerné ».
    const impact = evaluerProposition({ logement: "locataire" }, proposition("philippe-pa-001"));
    expect(impact.concerne).toBe(true);
    expect(impact.explication).not.toContain("concerne les actifs");
  });

  it("applique la règle dédiée dès que ses questions sont répondues", () => {
    expect(evaluerProposition({ statut_professionnel: "etudiant" }, proposition("philippe-pa-001")).concerne).toBe(false);
  });

  it("déclare les champs requis de chaque règle dédiée, et rien de plus", () => {
    expect(Object.keys(champsRequis).sort()).toEqual(Object.keys(regles).sort());
  });
});
