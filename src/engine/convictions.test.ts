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
const RETRAITES = [{ champ: "statut_professionnel", valeurs: ["retraite"] }];
const AUTRE = [{ champ: "autre", valeurs: ["mères isolées"] }];

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
  it("neutralité : chaque option des champs proposés a son groupe, aucun public n'est privilégié", () => {
    for (const champ of ["statut_professionnel", "tranche_age", "tranche_revenus", "logement", "territoire"]) {
      for (const valeur of VALEURS_PAR_CHAMP[champ]) {
        expect(GROUPES_SOCIAUX.some((g) => g.critere.champ === champ && g.critere.valeurs.includes(valeur)), `${champ}:${valeur}`).toBe(true);
      }
    }
    // Publics fragiles ET autres : indépendants, propriétaires, familles… figurent au même titre.
    for (const id of ["statut_professionnel:independant", "logement:proprietaire", "enfants_a_charge:au_moins_un", "tranche_revenus:plus_5000"]) {
      expect(GROUPES_SOCIAUX.some((g) => g.id === id), id).toBe(true);
    }
  });
  it("chaque groupe a un libellé et une rubrique lisibles", () => {
    for (const g of GROUPES_SOCIAUX) {
      expect(g.libelle.trim().length, g.id).toBeGreaterThan(0);
      expect(g.rubrique.trim().length, g.id).toBeGreaterThan(0);
    }
  });
});

describe("projeterConviction", () => {
  const faibles = [groupe("tranche_revenus:moins_1200")];

  it("sans groupe choisi : pas d'indicateur", () => {
    expect(projeterConviction([], [prop("a", [effet(MODESTES, "revenu_disponible", "hausse")])]).niveau).toBeNull();
  });
  it("mesure qui augmente le revenu des plus modestes : améliorant", () => {
    const c = projeterConviction(faibles, [prop("a", [effet(MODESTES, "revenu_disponible", "hausse")])]);
    expect(c.niveau).toBe("ameliorant");
    expect(c.effetsRetenus).toHaveLength(1);
    expect(c.effetsIncertains).toBe(0);
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
  it("critère contradictoire sur le champ du groupe : exclu, donc non concerné", () => {
    const riches = [{ champ: "tranche_revenus", valeurs: ["plus_5000"] }];
    expect(projeterConviction(faibles, [prop("a", [effet(riches, "revenu_disponible", "hausse")])]).niveau).toBe("non_concerne");
  });
  it("mesure ciblant un autre champ : on ne sait pas si elle atteint le groupe — pas d'indicateur, jamais « non concerné »", () => {
    const c = projeterConviction(faibles, [prop("a", [effet(RETRAITES, "revenu_disponible", "hausse")])]);
    expect(c.niveau).toBeNull();
    expect(c.effetsIncertains).toBe(1);
  });
  it("mesure à public hors formulaire (critère « autre ») : pas d'indicateur, jamais « non concerné »", () => {
    const c = projeterConviction(faibles, [prop("a", [effet(AUTRE, "revenu_disponible", "hausse")])]);
    expect(c.niveau).toBeNull();
    expect(c.effetsIncertains).toBe(1);
  });
  it("un effet certain décide, les effets incertains sont comptés à part", () => {
    const c = projeterConviction(faibles, [prop("a", [effet(MODESTES, "revenu_disponible", "hausse"), effet(AUTRE, "revenu_disponible", "baisse")])]);
    expect(c.niveau).toBe("ameliorant");
    expect(c.effetsIncertains).toBe(1);
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
  it("mêmes règles pour tous : deux candidats aux mesures identiques ont le même constat", () => {
    const mesures = (candidat: string) => [{ ...prop(`${candidat}-a`, [effet(MODESTES, "revenu_disponible", "hausse"), effet(RETRAITES, "protection_sociale", "baisse")]), candidat }];
    const a = projeterConviction(faibles, mesures("a"));
    const b = projeterConviction(faibles, mesures("b"));
    expect(a.niveau).toBe(b.niveau);
    expect(a.effetsIncertains).toBe(b.effetsIncertains);
    expect(a.effetsRetenus.map((r) => r.polarite)).toEqual(b.effetsRetenus.map((r) => r.polarite));
  });
  it("plusieurs groupes en une fois : l'union de leurs effets", () => {
    const groupes = [groupe("tranche_revenus:moins_1200"), groupe("statut_professionnel:retraite")];
    expect(projeterConviction(groupes, [prop("a", [effet(RETRAITES, "revenu_disponible", "hausse")])]).niveau).toBe("ameliorant");
  });
  it("groupe par groupe : une mesure pour les seuls retraités n'améliore pas la situation des faibles revenus", () => {
    const propositions = [prop("a", [effet(RETRAITES, "revenu_disponible", "hausse")])];
    expect(projeterConviction([groupe("statut_professionnel:retraite")], propositions).niveau).toBe("ameliorant");
    expect(projeterConviction([groupe("tranche_revenus:moins_1200")], propositions).niveau).toBeNull();
  });
});
