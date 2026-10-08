import { describe, expect, it } from "vitest";
import type { Effet } from "../effets";
import type { ChampProfil, Proposition } from "../types";
import { compterMesuresImpactees, compterMesuresPosition } from "./mesuresImpactees";

const effet = (cibles: Effet["cibles"]): Effet => ({ cibles, dimension: "revenu_disponible", sens: "hausse", source_url: "u", extrait: "extrait de test suffisamment long" });
const mesure = (id: string, effets: Effet[], statut: Proposition["statut"] = "complet"): Proposition => ({
  id,
  candidat: "x",
  theme: "fiscalite",
  titre: id,
  resume_factuel: "",
  sources: [],
  chiffrage_disponible: false,
  hypotheses_calcul: "",
  statut,
  date_derniere_verification: "2026-10-05",
  effets,
});

const LOGEMENT: ChampProfil = { id: "logement", label: "Logement", type: "enum", options: ["locataire", "proprietaire", "heberge"] };
const ENFANTS: ChampProfil = { id: "nombre_enfants", label: "Enfants", type: "number" };
const AIDES: ChampProfil = { id: "aides_percues", label: "Aides", type: "multi", options: ["rsa", "aspa", "aucune"] };

const MESURES = [
  mesure("a", [effet([{ champ: "logement", valeurs: ["locataire"] }])]),
  mesure("b", [effet([{ champ: "logement", valeurs: ["locataire", "heberge"] }])]),
  mesure("c", [effet([{ champ: "logement", valeurs: ["proprietaire"] }])]),
  mesure("d", [effet([{ champ: "logement", valeurs: ["locataire"] }, { champ: "statut_professionnel", valeurs: ["retraite"] }])]),
  mesure("e", [effet([{ champ: "logement", valeurs: ["locataire"] }, { champ: "autre", valeurs: ["primo-accédants"] }])]),
  mesure("f", [effet([{ champ: "logement", valeurs: ["locataire"] }])], "provisoire"),
  mesure("g", []),
];

describe("compterMesuresImpactees", () => {
  it("rien tant que la question n'a pas de réponse", () => {
    expect(compterMesuresImpactees(LOGEMENT, {}, MESURES)).toBeNull();
  });

  it("compte les mesures dont un effet vise la réponse ; ni l'effet « autre », ni la fiche provisoire, ni la mesure sans effet", () => {
    // a et b (visent « locataire ») ; d reste possible (statut professionnel non répondu) ; e exclue (public hors formulaire).
    expect(compterMesuresImpactees(LOGEMENT, { logement: "locataire" }, MESURES)).toBe(3);
  });

  it("une autre réponse du profil qui écarte l'effet le retire du compte", () => {
    expect(compterMesuresImpactees(LOGEMENT, { logement: "locataire", statut_professionnel: "salarie" }, MESURES)).toBe(2);
    expect(compterMesuresImpactees(LOGEMENT, { logement: "locataire", statut_professionnel: "retraite" }, MESURES)).toBe(3);
  });

  it("zéro est une réponse : aucune mesure ne vise « hébergé » hors la mesure b", () => {
    expect(compterMesuresImpactees(LOGEMENT, { logement: "heberge" }, MESURES)).toBe(1);
    expect(compterMesuresImpactees(LOGEMENT, { logement: "proprietaire" }, MESURES)).toBe(1);
  });

  it("chaque mesure compte une fois, même avec plusieurs effets sur la même réponse", () => {
    const double = mesure("z", [effet([{ champ: "logement", valeurs: ["locataire"] }]), effet([{ champ: "logement", valeurs: ["locataire"] }])]);
    expect(compterMesuresImpactees(LOGEMENT, { logement: "locataire" }, [double])).toBe(1);
  });

  it("question à choix multiples : une mesure qui vise l'un des choix est comptée", () => {
    const m = [mesure("m1", [effet([{ champ: "aides_percues", valeurs: ["aspa"] }])]), mesure("m2", [effet([{ champ: "aides_percues", valeurs: ["rsa"] }])])];
    expect(compterMesuresImpactees(AIDES, { aides_percues: ["aspa"] }, m)).toBe(1);
    expect(compterMesuresImpactees(AIDES, { aides_percues: ["aspa", "rsa"] }, m)).toBe(2);
  });

  it("le nombre d'enfants se lit par « enfants à charge » (trois enfants ou plus compris)", () => {
    const m = [
      mesure("e1", [effet([{ champ: "enfants_a_charge", valeurs: ["au_moins_un"] }])]),
      mesure("e2", [effet([{ champ: "enfants_a_charge", valeurs: ["trois_ou_plus"] }])]),
    ];
    expect(compterMesuresImpactees(ENFANTS, { nombre_enfants: 1 }, m)).toBe(1);
    expect(compterMesuresImpactees(ENFANTS, { nombre_enfants: 3 }, m)).toBe(2);
    expect(compterMesuresImpactees(ENFANTS, { nombre_enfants: 0 }, m)).toBe(0);
  });
});

describe("compterMesuresPosition (convictions)", () => {
  const etiquette = (sujet: string, position: string) => ({ sujet, position, source_url: "u", extrait: "extrait de test suffisamment long" });
  const m = (id: string, positions: ReturnType<typeof etiquette>[], statut: Proposition["statut"] = "complet") => ({ ...mesure(id, [], statut), positions });
  const MESURES_POSITIONS = [
    m("p1", [etiquette("immigration", "restriction")]),
    m("p2", [etiquette("immigration", "restriction"), etiquette("securite", "repression")]),
    m("p3", [etiquette("immigration", "ouverture")]),
    m("p4", [etiquette("immigration", "restriction")], "provisoire"),
    mesure("p5", []),
  ];
  it("compte les mesures étiquetées avec cette position, une fois chacune", () => {
    expect(compterMesuresPosition("immigration", "restriction", MESURES_POSITIONS)).toBe(2);
    expect(compterMesuresPosition("immigration", "ouverture", MESURES_POSITIONS)).toBe(1);
    expect(compterMesuresPosition("securite", "repression", MESURES_POSITIONS)).toBe(1);
  });
  it("zéro quand aucune mesure n'est étiquetée ainsi, ou quand la position n'existe pas", () => {
    expect(compterMesuresPosition("securite", "prevention", MESURES_POSITIONS)).toBe(0);
    expect(compterMesuresPosition("immigration", "inventee", MESURES_POSITIONS)).toBe(0);
  });
});
