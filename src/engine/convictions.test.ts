import { describe, expect, it } from "vitest";
import { GROUPES_SOCIAUX } from "../convictions";
import { VALEURS_PAR_CHAMP, type Effet } from "../effets";
import type { Proposition } from "../types";
import { projeterConviction } from "./convictions";

const groupe = (id: string) => GROUPES_SOCIAUX.find((g) => g.id === id)!;
const effet = (cibles: Effet["cibles"], dimension: Effet["dimension"], sens: Effet["sens"]): Effet => ({
  cibles,
  dimension,
  sens,
  source_url: "https://exemple.fr/a",
  extrait: "extrait de test suffisamment long",
});
function prop(id: string, effets: Effet[], statut: Proposition["statut"] = "complet"): Proposition {
  return { id, candidat: "x", theme: "fiscalite", titre: id, resume_factuel: "", sources: [], chiffrage_disponible: false, hypotheses_calcul: "", statut, date_derniere_verification: "2026-09-29", effets };
}
const MODESTES = [{ champ: "tranche_revenus", valeurs: ["moins_1200"] }];

describe("catalogue des groupes sociaux", () => {
  it("chaque critère est valide pour le formulaire (champ et valeurs existants)", () => {
    for (const g of GROUPES_SOCIAUX) {
      const autorisees = VALEURS_PAR_CHAMP[g.critere.champ];
      expect(autorisees, g.id).toBeDefined();
      for (const v of g.critere.valeurs) expect(autorisees).toContain(v);
    }
  });
  it("les identifiants sont uniques", () => {
    expect(new Set(GROUPES_SOCIAUX.map((g) => g.id)).size).toBe(GROUPES_SOCIAUX.length);
  });
});

describe("projeterConviction", () => {
  const faibles = [groupe("faibles_revenus")];

  it("sans groupe choisi : pas d'indicateur", () => {
    expect(projeterConviction([], [prop("a", [effet(MODESTES, "revenu_disponible", "hausse")])]).niveau).toBeNull();
  });
  it("mesure qui augmente le revenu des plus modestes : améliorant", () => {
    const c = projeterConviction(faibles, [prop("a", [effet(MODESTES, "revenu_disponible", "hausse")])]);
    expect(c.niveau).toBe("ameliorant");
    expect(c.effetsRetenus).toHaveLength(1);
  });
  it("mesure pour tout le monde (cibles vides) : compte", () => {
    expect(projeterConviction(faibles, [prop("a", [effet([], "cout_de_la_vie", "baisse")])]).niveau).toBe("ameliorant");
  });
  it("mesure qui dégrade la situation du groupe : dégradant", () => {
    expect(projeterConviction(faibles, [prop("a", [effet(MODESTES, "protection_sociale", "baisse")])]).niveau).toBe("degradant");
  });
  it("favorable ET défavorable : mixte", () => {
    const c = projeterConviction(faibles, [
      prop("a", [effet(MODESTES, "revenu_disponible", "hausse")]),
      prop("b", [effet(MODESTES, "protection_sociale", "baisse")]),
    ]);
    expect(c.niveau).toBe("mixte");
  });
  it("critère sur un autre champ : n'est pas compté pour le groupe", () => {
    const retraites = [{ champ: "statut_professionnel", valeurs: ["retraite"] }];
    expect(projeterConviction(faibles, [prop("a", [effet(retraites, "revenu_disponible", "hausse")])]).niveau).toBe("non_concerne");
  });
  it("critère contradictoire sur le champ du groupe : n'est pas compté", () => {
    const riches = [{ champ: "tranche_revenus", valeurs: ["plus_5000"] }];
    expect(projeterConviction(faibles, [prop("a", [effet(riches, "revenu_disponible", "hausse")])]).niveau).toBe("non_concerne");
  });
  it("effet à sens indéterminé seulement : pas d'indicateur", () => {
    expect(projeterConviction(faibles, [prop("a", [effet(MODESTES, "revenu_disponible", "indetermine")])]).niveau).toBeNull();
  });
  it("candidat sans aucun effet structuré : pas d'indicateur, jamais « non concerné »", () => {
    expect(projeterConviction(faibles, [prop("a", [])]).niveau).toBeNull();
    expect(projeterConviction(faibles, [{ ...prop("b", []), effets: undefined }]).niveau).toBeNull();
  });
  it("fiche provisoire ignorée", () => {
    expect(projeterConviction(faibles, [prop("a", [effet(MODESTES, "revenu_disponible", "hausse")], "provisoire")]).niveau).toBeNull();
  });
  it("plusieurs groupes : l'union de leurs effets", () => {
    const groupes = [groupe("faibles_revenus"), groupe("retraites")];
    const retraites = [{ champ: "statut_professionnel", valeurs: ["retraite"] }];
    expect(projeterConviction(groupes, [prop("a", [effet(retraites, "revenu_disponible", "hausse")])]).niveau).toBe("ameliorant");
  });
});
