import { describe, expect, it } from "vitest";
import { champsDeBase } from "./schemaBase";
import { champsCibles, DIMENSIONS_EFFET, SENS_EFFET, valeursParChamp, validerEffet, type Effet } from "./effets";

const VALEURS_PAR_CHAMP = valeursParChamp("officielle");
const CHAMPS_CIBLES = champsCibles("officielle");
const profilSchema = champsDeBase("officielle");

const URL_SOURCE = "https://exemple-officiel.fr/programme";

function effet(surcharge: Partial<Effet> = {}): Effet {
  return {
    cibles: [{ champ: "tranche_revenus", valeurs: ["plus_5000"] }],
    dimension: "revenu_disponible",
    sens: "baisse",
    source_url: URL_SOURCE,
    extrait: "Création d'une contribution exceptionnelle sur les hauts revenus.",
    ...surcharge,
  };
}

describe("VALEURS_PAR_CHAMP", () => {
  it("reprend les options du profil citoyen : une seule source de vérité", () => {
    for (const champ of profilSchema) {
      if (champ.type === "enum") {
        expect(VALEURS_PAR_CHAMP[champ.id]).toEqual(champ.options);
      }
    }
  });

  it("n'inclut pas les champs libres ou numériques, non appariables (région, secteur)", () => {
    expect(VALEURS_PAR_CHAMP).not.toHaveProperty("region");
    expect(VALEURS_PAR_CHAMP).not.toHaveProperty("secteur_activite");
  });

  it("traduit le nombre d'enfants en enfants_a_charge (aucun / au_moins_un)", () => {
    expect(VALEURS_PAR_CHAMP.enfants_a_charge).toEqual(["aucun", "au_moins_un", "trois_ou_plus"]);
    expect(VALEURS_PAR_CHAMP).not.toHaveProperty("nombre_enfants");
  });

  it("expose les champs ciblables, plus « autre » pour les critères que le profil ne capture pas", () => {
    expect(CHAMPS_CIBLES).toContain("autre");
    expect(CHAMPS_CIBLES).toContain("tranche_age");
  });
});

describe("validerEffet", () => {
  it("accepte un effet complet et cohérent", () => {
    expect(validerEffet(effet(), [URL_SOURCE], "officielle")).toBe(true);
  });

  it("accepte cibles vides = tout le monde", () => {
    expect(validerEffet(effet({ cibles: [] }), [URL_SOURCE], "officielle")).toBe(true);
  });

  it("accepte plusieurs critères sur des champs différents (tous doivent correspondre)", () => {
    const cibles = [
      { champ: "logement", valeurs: ["proprietaire"] },
      { champ: "tranche_age", valeurs: ["50_64", "65_plus"] },
    ];
    expect(validerEffet(effet({ cibles }), [URL_SOURCE], "officielle")).toBe(true);
  });

  it("refuse une valeur absente des options du profil", () => {
    const cibles = [{ champ: "tranche_revenus", valeurs: ["tres_riche"] }];
    expect(validerEffet(effet({ cibles }), [URL_SOURCE], "officielle")).toBe(false);
  });

  it("refuse un champ inconnu", () => {
    const cibles = [{ champ: "couleur_preferee", valeurs: ["bleu"] }];
    expect(validerEffet(effet({ cibles }), [URL_SOURCE], "officielle")).toBe(false);
  });

  it("refuse deux critères sur le même champ (ambigu : ET ou OU ?)", () => {
    const cibles = [
      { champ: "tranche_age", valeurs: ["moins_30"] },
      { champ: "tranche_age", valeurs: ["65_plus"] },
    ];
    expect(validerEffet(effet({ cibles }), [URL_SOURCE], "officielle")).toBe(false);
  });

  it("refuse un critère sans valeur", () => {
    expect(validerEffet(effet({ cibles: [{ champ: "logement", valeurs: [] }] }), [URL_SOURCE], "officielle")).toBe(false);
  });

  it("accepte « autre » avec une description libre, sans la valider contre le profil", () => {
    const cibles = [{ champ: "autre", valeurs: ["personnes de nationalité étrangère"] }];
    expect(validerEffet(effet({ cibles }), [URL_SOURCE], "officielle")).toBe(true);
  });

  it("refuse « autre » sans description", () => {
    expect(validerEffet(effet({ cibles: [{ champ: "autre", valeurs: [] }] }), [URL_SOURCE], "officielle")).toBe(false);
  });

  it("refuse une dimension ou un sens hors référentiel", () => {
    expect(validerEffet(effet({ dimension: "bonheur" as never }), [URL_SOURCE], "officielle")).toBe(false);
    expect(validerEffet(effet({ sens: "meilleur" as never }), [URL_SOURCE], "officielle")).toBe(false);
  });

  it("accepte le sens « indetermine »", () => {
    expect(validerEffet(effet({ sens: "indetermine" }), [URL_SOURCE], "officielle")).toBe(true);
  });

  it("refuse une source_url qui ne fait pas partie des sources de la proposition", () => {
    expect(validerEffet(effet({ source_url: "https://autre-site.fr/page" }), [URL_SOURCE], "officielle")).toBe(false);
  });

  it("refuse un extrait vide ou démesuré (l'extrait doit être un passage, pas la page entière)", () => {
    expect(validerEffet(effet({ extrait: "" }), [URL_SOURCE], "officielle")).toBe(false);
    expect(validerEffet(effet({ extrait: "x".repeat(601) }), [URL_SOURCE], "officielle")).toBe(false);
  });

  it("refuse une valeur qui n'est pas un objet", () => {
    expect(validerEffet(null, [URL_SOURCE], "officielle")).toBe(false);
    expect(validerEffet("effet", [URL_SOURCE], "officielle")).toBe(false);
  });
});

describe("référentiels", () => {
  it("ne contient que des dimensions et des sens sans jugement de valeur", () => {
    expect([...SENS_EFFET]).toEqual(["hausse", "baisse", "indetermine"]);
    expect(DIMENSIONS_EFFET).toHaveLength(8);
  });
});
