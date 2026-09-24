import { describe, expect, it } from "vitest";
import { DIMENSIONS_EFFET, type Effet } from "../effets";
import type { Profil, Proposition } from "../types";
import { polarite } from "./polarite";
import { projeterTheme } from "./projection";

const PROFIL: Profil = {
  statut_professionnel: "salarie",
  tranche_revenus: "3000_5000",
  situation_familiale: "en_couple",
  nombre_enfants: 1,
  logement: "locataire",
  secteur_activite: "commerce",
  region: "Bretagne",
  tranche_age: "moins_30",
  tranche_patrimoine: "moins_100k",
};

function effet(surcharge: Partial<Effet> = {}): Effet {
  return {
    cibles: [],
    dimension: "revenu_disponible",
    sens: "hausse",
    source_url: "https://exemple-officiel.fr/a",
    extrait: "Extrait de source.",
    ...surcharge,
  };
}

function proposition(effets: Effet[] | undefined, surcharge: Partial<Proposition> = {}): Proposition {
  return {
    id: "test-fisc-001",
    candidat: "test",
    theme: "fiscalite",
    titre: "Mesure",
    resume_factuel: "Résumé",
    sources: [],
    chiffrage_disponible: false,
    hypotheses_calcul: "",
    statut: "complet",
    date_derniere_verification: "2026-09-24",
    effets,
    ...surcharge,
  };
}

describe("polarite (table documentée : quel sens améliore la situation matérielle du citoyen)", () => {
  it("couvre chaque dimension, avec des polarités opposées pour hausse et baisse", () => {
    for (const dimension of DIMENSIONS_EFFET) {
      const hausse = polarite(dimension, "hausse");
      const baisse = polarite(dimension, "baisse");
      expect(hausse).not.toBeNull();
      expect(baisse).not.toBeNull();
      expect(hausse).not.toBe(baisse);
    }
  });

  it("une hausse du revenu disponible est favorable, une hausse du coût de la vie défavorable", () => {
    expect(polarite("revenu_disponible", "hausse")).toBe("favorable");
    expect(polarite("cout_de_la_vie", "hausse")).toBe("defavorable");
    expect(polarite("cout_de_la_vie", "baisse")).toBe("favorable");
  });

  it("un sens indéterminé n'a aucune polarité : on ne devine pas", () => {
    for (const dimension of DIMENSIONS_EFFET) {
      expect(polarite(dimension, "indetermine")).toBeNull();
    }
  });
});

describe("projeterTheme — les quatre niveaux", () => {
  it("améliorant : un effet favorable qui vise le profil", () => {
    const p = proposition([
      effet({ cibles: [{ champ: "tranche_revenus", valeurs: ["1200_2000", "3000_5000"] }] }),
    ]);
    expect(projeterTheme(PROFIL, [p]).niveau).toBe("ameliorant");
  });

  it("dégradant : plus de taxes pour la tranche de revenus visée (revenu disponible en baisse)", () => {
    const p = proposition([
      effet({ sens: "baisse", cibles: [{ champ: "tranche_revenus", valeurs: ["3000_5000", "plus_5000"] }] }),
    ]);
    expect(projeterTheme(PROFIL, [p]).niveau).toBe("degradant");
  });

  it("mixte : à la fois du favorable et du défavorable pour ce profil", () => {
    const p = proposition([
      effet({ sens: "hausse" }),
      effet({ dimension: "cout_de_la_vie", sens: "hausse" }),
    ]);
    expect(projeterTheme(PROFIL, [p]).niveau).toBe("mixte");
  });

  it("mixte se cumule entre plusieurs propositions du même thème", () => {
    const a = proposition([effet({ sens: "hausse" })], { id: "a" });
    const b = proposition([effet({ sens: "baisse" })], { id: "b" });
    expect(projeterTheme(PROFIL, [a, b]).niveau).toBe("mixte");
  });

  it("non concerné : thème retraite pour un citoyen de moins de 30 ans", () => {
    const p = proposition([
      effet({ dimension: "protection_sociale", cibles: [{ champ: "tranche_age", valeurs: ["50_64", "65_plus"] }] }),
    ]);
    const projection = projeterTheme(PROFIL, [p]);
    expect(projection.niveau).toBe("non_concerne");
    expect(projection.effetsRetenus).toEqual([]);
  });

  it("non concerné : traitement spécifique aux propriétaires pour un locataire", () => {
    const p = proposition([
      effet({ dimension: "patrimoine", sens: "baisse", cibles: [{ champ: "logement", valeurs: ["proprietaire"] }] }),
    ]);
    expect(projeterTheme(PROFIL, [p]).niveau).toBe("non_concerne");
  });
});

describe("projeterTheme — ciblage", () => {
  it("cibles vides = tout le monde", () => {
    expect(projeterTheme(PROFIL, [proposition([effet({ cibles: [] })])]).niveau).toBe("ameliorant");
  });

  it("tous les critères doivent correspondre (ET) : un seul qui ne colle pas exclut l'effet", () => {
    const p = proposition([
      effet({
        cibles: [
          { champ: "logement", valeurs: ["locataire"] },
          { champ: "tranche_age", valeurs: ["65_plus"] },
        ],
      }),
    ]);
    expect(projeterTheme(PROFIL, [p]).niveau).toBe("non_concerne");
  });

  it("déduit enfants_a_charge du nombre d'enfants", () => {
    const avecEnfant = proposition([effet({ cibles: [{ champ: "enfants_a_charge", valeurs: ["au_moins_un"] }] })]);
    expect(projeterTheme(PROFIL, [avecEnfant]).niveau).toBe("ameliorant");
    expect(projeterTheme({ ...PROFIL, nombre_enfants: 0 }, [avecEnfant]).niveau).toBe("non_concerne");
  });

  it("ignore les effets des propositions provisoires (fiche de recherche inachevée)", () => {
    const p = proposition([effet()], { statut: "provisoire" });
    const projection = projeterTheme(PROFIL, [p]);
    expect(projection.niveau).toBeNull();
    expect(projection.raisons).toEqual(["aucun_effet_determine"]);
  });
});

describe("projeterTheme — pas de badge plutôt qu'un mauvais badge", () => {
  it("aucune proposition, ou propositions sans effets : aucun effet déterminé", () => {
    expect(projeterTheme(PROFIL, []).raisons).toEqual(["aucun_effet_determine"]);
    expect(projeterTheme(PROFIL, [proposition(undefined)]).niveau).toBeNull();
    expect(projeterTheme(PROFIL, [proposition([])]).raisons).toEqual(["aucun_effet_determine"]);
  });

  it("champ non répondu : pas de badge, le champ manquant est indiqué", () => {
    const p = proposition([effet({ cibles: [{ champ: "logement", valeurs: ["proprietaire"] }] })]);
    const projection = projeterTheme({ ...PROFIL, logement: "" }, [p]);
    expect(projection.niveau).toBeNull();
    expect(projection.raisons).toContain("informations_manquantes");
    expect(projection.champsManquants).toEqual(["logement"]);
  });

  it("un champ non répondu n'équivaut pas à « non » : il ne rend jamais « non concerné »", () => {
    const p = proposition([effet({ cibles: [{ champ: "tranche_age", valeurs: ["65_plus"] }] })]);
    const { tranche_age: _t, ...sansAge } = PROFIL;
    expect(projeterTheme(sansAge, [p]).niveau).toBeNull();
  });

  it("un critère déjà exclu l'emporte sur un critère non répondu (faux ET inconnu = faux)", () => {
    const p = proposition([
      effet({
        cibles: [
          { champ: "tranche_age", valeurs: ["65_plus"] },
          { champ: "logement", valeurs: ["proprietaire"] },
        ],
      }),
    ]);
    const projection = projeterTheme({ ...PROFIL, logement: "" }, [p]);
    expect(projection.niveau).toBe("non_concerne");
    expect(projection.champsManquants).toEqual([]);
  });

  it("critère « autre » : jamais apparié, pas de badge, raison distincte", () => {
    const p = proposition([
      effet({ sens: "baisse", cibles: [{ champ: "autre", valeurs: ["personnes de nationalité étrangère"] }] }),
    ]);
    const projection = projeterTheme(PROFIL, [p]);
    expect(projection.niveau).toBeNull();
    expect(projection.raisons).toEqual(["critere_hors_formulaire"]);
    expect(projection.champsManquants).toEqual([]);
  });

  it("effet de sens indéterminé qui vise le profil : pas de badge", () => {
    const p = proposition([effet({ sens: "indetermine" })]);
    const projection = projeterTheme(PROFIL, [p]);
    expect(projection.niveau).toBeNull();
    expect(projection.raisons).toEqual(["effet_non_determinable"]);
  });

  it("un effet de sens indéterminé qui ne vise pas le profil ne bloque rien", () => {
    const p = proposition([
      effet({ sens: "indetermine", cibles: [{ champ: "tranche_age", valeurs: ["65_plus"] }] }),
      effet({ sens: "hausse" }),
    ]);
    expect(projeterTheme(PROFIL, [p]).niveau).toBe("ameliorant");
  });

  it("améliorant + effet à confirmer : pas de badge, car l'effet à confirmer pourrait le contredire", () => {
    const p = proposition([
      effet({ sens: "hausse" }),
      effet({ sens: "baisse", cibles: [{ champ: "logement", valeurs: ["proprietaire"] }] }),
    ]);
    const projection = projeterTheme({ ...PROFIL, logement: "" }, [p]);
    expect(projection.niveau).toBeNull();
    expect(projection.champsManquants).toEqual(["logement"]);
  });

  it("mixte reste mixte malgré un effet à confirmer : plus d'effets ne peuvent pas le défaire", () => {
    const p = proposition([
      effet({ sens: "hausse" }),
      effet({ sens: "baisse" }),
      effet({ sens: "baisse", cibles: [{ champ: "logement", valeurs: ["proprietaire"] }] }),
    ]);
    expect(projeterTheme({ ...PROFIL, logement: "" }, [p]).niveau).toBe("mixte");
  });
});

describe("projeterTheme — traçabilité", () => {
  it("renvoie les effets retenus avec la proposition d'origine et leur polarité", () => {
    const p = proposition([effet({ sens: "baisse" })], { id: "fisc-042" });
    const { effetsRetenus } = projeterTheme(PROFIL, [p]);
    expect(effetsRetenus).toHaveLength(1);
    expect(effetsRetenus[0].propositionId).toBe("fisc-042");
    expect(effetsRetenus[0].polarite).toBe("defavorable");
    expect(effetsRetenus[0].effet.extrait).toBe("Extrait de source.");
  });

  it("ne dépend ni de l'ordre des propositions ni de celui des effets", () => {
    const a = proposition([effet({ sens: "hausse" })], { id: "a" });
    const b = proposition([effet({ sens: "baisse" })], { id: "b" });
    expect(projeterTheme(PROFIL, [a, b]).niveau).toBe(projeterTheme(PROFIL, [b, a]).niveau);
  });
});
