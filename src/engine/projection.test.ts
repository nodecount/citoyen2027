import { describe, expect, it } from "vitest";
import { DIMENSIONS_EFFET, type Effet } from "../effets";
import type { ProfilPartiel } from "../profil";
import type { Proposition } from "../types";
import { polarite } from "./polarite";
import { projeterTheme } from "./projection";

const PROFIL: ProfilPartiel = {
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

  it("champ non répondu : on ne sait pas si le visiteur est concerné → « mixte » par prudence, avec le champ à préciser", () => {
    const p = proposition([effet({ cibles: [{ champ: "logement", valeurs: ["proprietaire"] }] })]);
    const { logement: _l, ...sansLogement } = PROFIL;
    const projection = projeterTheme(sansLogement, [p]);
    expect(projection.niveau).toBe("mixte");
    expect(projection.incertain).toBe(true);
    expect(projection.raisons).toContain("informations_manquantes");
    expect(projection.champsManquants).toEqual(["logement"]);
  });

  it("un champ non répondu n'équivaut pas à « non » : il ne rend jamais « non concerné »", () => {
    const p = proposition([effet({ cibles: [{ champ: "tranche_age", valeurs: ["65_plus"] }] })]);
    const { tranche_age: _t, ...sansAge } = PROFIL;
    const projection = projeterTheme(sansAge, [p]);
    expect(projection.niveau).not.toBe("non_concerne");
    expect(projection.niveau).toBe("mixte");
  });

  it("répondre lève l'incertitude : le même effet devient améliorant ou non concerné selon la réponse", () => {
    const p = proposition([effet({ cibles: [{ champ: "logement", valeurs: ["proprietaire"] }] })]);
    expect(projeterTheme({ ...PROFIL, logement: "proprietaire" }, [p]).niveau).toBe("ameliorant");
    const locataire = projeterTheme({ ...PROFIL, logement: "locataire" }, [p]);
    expect(locataire.niveau).toBe("non_concerne");
    expect(locataire.incertain).toBe(false);
  });

  it("un « mixte » réel (favorable ET défavorable) n'est pas marqué incertain", () => {
    const reel = projeterTheme(PROFIL, [proposition([effet({ sens: "hausse" }), effet({ sens: "baisse" })])]);
    expect(reel.niveau).toBe("mixte");
    expect(reel.incertain).toBe(false);
    expect(reel.raisons).toEqual([]);
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

  it("critère « autre » seul : aucune réponse ne le confirmera jamais → pas de badge, compté à part", () => {
    const p = proposition([
      effet({ sens: "baisse", cibles: [{ champ: "autre", valeurs: ["personnes de nationalité étrangère"] }] }),
    ]);
    const projection = projeterTheme(PROFIL, [p]);
    expect(projection.niveau).toBeNull();
    expect(projection.incertain).toBe(false);
    expect(projection.raisons).toEqual(["critere_hors_formulaire"]);
    expect(projection.champsManquants).toEqual([]);
    expect(projection.effetsNonPrisEnCompte).toBe(1);
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

  it("améliorant + effet à confirmer : « mixte », car l'effet à confirmer pourrait contredire le favorable", () => {
    const p = proposition([
      effet({ sens: "hausse" }),
      effet({ sens: "baisse", cibles: [{ champ: "logement", valeurs: ["proprietaire"] }] }),
    ]);
    const { logement: _l, ...sansLogement } = PROFIL;
    const projection = projeterTheme(sansLogement, [p]);
    expect(projection.niveau).toBe("mixte");
    expect(projection.incertain).toBe(true);
    expect(projection.champsManquants).toEqual(["logement"]);
  });

  it("incertitude ET effet de sens indéterminé : « mixte » (l'incertitude prime)", () => {
    const p = proposition([
      effet({ sens: "indetermine" }),
      effet({ cibles: [{ champ: "logement", valeurs: ["proprietaire"] }] }),
    ]);
    const { logement: _l, ...sansLogement } = PROFIL;
    expect(projeterTheme(sansLogement, [p]).niveau).toBe("mixte");
  });

  it("mixte reste mixte malgré un effet à confirmer : plus d'effets ne peuvent pas le défaire", () => {
    const p = proposition([
      effet({ sens: "hausse" }),
      effet({ sens: "baisse" }),
      effet({ sens: "baisse", cibles: [{ champ: "logement", valeurs: ["proprietaire"] }] }),
    ]);
    const { logement: _l, ...sansLogement } = PROFIL;
    const projection = projeterTheme(sansLogement, [p]);
    expect(projection.niveau).toBe("mixte");
    expect(projection.incertain).toBe(false);
  });
});

describe("projeterTheme — effets qu'aucune réponse ne peut jamais confirmer (critère « autre »)", () => {
  it("n'empêchent plus un badge par ailleurs déterminé, et sont comptés à part", () => {
    const p = proposition([
      effet({ sens: "hausse" }),
      effet({ sens: "baisse", cibles: [{ champ: "autre", valeurs: ["personnes en situation irrégulière"] }] }),
    ]);
    const projection = projeterTheme(PROFIL, [p]);
    expect(projection.niveau).toBe("ameliorant");
    expect(projection.effetsNonPrisEnCompte).toBe(1);
    // Ce n'est pas un « pas de badge » : les raisons ne s'affichent pas comme telles à côté d'un badge.
    expect(projection.raisons).toEqual([]);
  });

  it("un critère répondable qui exclut déjà le profil prime sur un critère « autre » qu'on ne pourra jamais lever", () => {
    const p = proposition([
      effet({
        cibles: [
          { champ: "tranche_age", valeurs: ["65_plus"] },
          { champ: "autre", valeurs: ["personnes en situation irrégulière"] },
        ],
      }),
    ]);
    const projection = projeterTheme(PROFIL, [p]);
    expect(projection.niveau).toBe("non_concerne");
    expect(projection.effetsNonPrisEnCompte).toBe(0);
  });

  it("un critère « autre » combiné à un champ non répondu reste exclu (pas « incertain », jamais confirmable)", () => {
    const p = proposition([
      effet({ cibles: [{ champ: "logement", valeurs: ["proprietaire"] }, { champ: "autre", valeurs: ["x"] }] }),
    ]);
    const { logement: _l, ...sansLogement } = PROFIL;
    const projection = projeterTheme(sansLogement, [p]);
    expect(projection.niveau).toBeNull();
    expect(projection.incertain).toBe(false);
    expect(projection.champsManquants).toEqual([]);
    expect(projection.effetsNonPrisEnCompte).toBe(1);
  });

  it("vaut 0 quand aucun effet n'a de critère « autre »", () => {
    expect(projeterTheme(PROFIL, [proposition([effet()])]).effetsNonPrisEnCompte).toBe(0);
  });
});

describe("projeterTheme — réponses à plusieurs choix", () => {
  const rsa = proposition([effet({ cibles: [{ champ: "aides_percues", valeurs: ["rsa"] }] })]);

  it("s'applique si l'un des choix du visiteur est visé", () => {
    expect(projeterTheme({ aides_percues: ["aide_logement", "rsa"] }, [rsa]).niveau).toBe("ameliorant");
  });

  it("ne s'applique pas si aucun choix n'est visé, y compris « aucune de ces aides » : non concerné, pas incertain", () => {
    const projection = projeterTheme({ aides_percues: ["aucune"] }, [rsa]);
    expect(projection.niveau).toBe("non_concerne");
    expect(projection.incertain).toBe(false);
  });

  it("reste incertain tant que la question n'est pas répondue", () => {
    expect(projeterTheme({ tranche_age: "30_49" }, [rsa]).niveau).toBe("mixte");
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
