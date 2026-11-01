import { describe, expect, it } from "vitest";
import { aDesInformations, mettreAJourReponse, questionVisible, retirerReponsesMasquees, valeursDuProfil, type ProfilPartiel } from "./profil";
import { chargerBase } from "./data/bases";
import type { ChampProfil } from "./types";

const CHAMPS: ChampProfil[] = [
  { id: "logement", label: "Logement", type: "enum", options: ["locataire", "proprietaire", "heberge"] },
  { id: "logement_social", label: "HLM", type: "enum", options: ["oui", "non"], afficher_si: { champ: "logement", valeurs: ["locataire"] } },
  { id: "aides", label: "Aides", type: "multi", options: ["rsa", "apl", "aucune"] },
  { id: "nombre_enfants", label: "Enfants", type: "number" },
  { id: "enfants_scolarises", label: "Scolarisés", type: "multi", options: ["college", "lycee"], afficher_si: { champ: "enfants_a_charge", valeurs: ["au_moins_un"] } },
  { id: "commentaire", label: "Texte", type: "text" },
];
const champ = (id: string): ChampProfil => CHAMPS.find((c) => c.id === id)!;
const maj = (profil: ProfilPartiel, id: string, brut: string | string[]) => mettreAJourReponse(profil, champ(id), brut, CHAMPS);

describe("aDesInformations", () => {
  it("est faux sans aucune réponse : absent, vide, ou réponses vides", () => {
    expect(aDesInformations(null)).toBe(false);
    expect(aDesInformations(undefined)).toBe(false);
    expect(aDesInformations({})).toBe(false);
    expect(aDesInformations({ commentaire: "", aides: [] })).toBe(false);
  });

  it("est vrai dès qu'un champ est répondu, y compris une liste et « 0 enfant »", () => {
    expect(aDesInformations({ logement: "locataire" })).toBe(true);
    expect(aDesInformations({ aides: ["rsa"] })).toBe(true);
    expect(aDesInformations({ nombre_enfants: 0 })).toBe(true);
  });

  it("ignore un nombre invalide", () => {
    expect(aDesInformations({ nombre_enfants: Number.NaN })).toBe(false);
  });
});

describe("valeursDuProfil", () => {
  it("donne toujours une liste : un choix = une liste d'un élément ; non répondu = null", () => {
    expect(valeursDuProfil({ logement: "locataire" }, "logement")).toEqual(["locataire"]);
    expect(valeursDuProfil({ aides: ["rsa", "apl"] }, "aides")).toEqual(["rsa", "apl"]);
    expect(valeursDuProfil({}, "logement")).toBeNull();
    expect(valeursDuProfil({ aides: [] }, "aides")).toBeNull();
    expect(valeursDuProfil({ logement: "  " }, "logement")).toBeNull();
  });

  it("déduit enfants_a_charge du nombre d'enfants, et reste inconnu tant qu'il n'est pas répondu", () => {
    expect(valeursDuProfil({ nombre_enfants: 2 }, "enfants_a_charge")).toEqual(["au_moins_un"]);
    expect(valeursDuProfil({ nombre_enfants: 0 }, "enfants_a_charge")).toEqual(["aucun"]);
    expect(valeursDuProfil({}, "enfants_a_charge")).toBeNull();
  });
});

describe("questionVisible", () => {
  it("affiche toujours une question sans condition", () => {
    expect(questionVisible(champ("logement"), {})).toBe(true);
  });

  it("masque une question conditionnelle tant que la condition n'est pas remplie, ou pas répondue", () => {
    expect(questionVisible(champ("logement_social"), {})).toBe(false);
    expect(questionVisible(champ("logement_social"), { logement: "proprietaire" })).toBe(false);
    expect(questionVisible(champ("logement_social"), { logement: "locataire" })).toBe(true);
  });

  it("sait conditionner sur une valeur déduite (enfants à charge)", () => {
    expect(questionVisible(champ("enfants_scolarises"), { nombre_enfants: 0 })).toBe(false);
    expect(questionVisible(champ("enfants_scolarises"), { nombre_enfants: 2 })).toBe(true);
  });
});

describe("mettreAJourReponse", () => {
  it("enregistre un choix valide, et le retire quand le visiteur revient à « pas de réponse »", () => {
    const avec = maj({}, "logement", "locataire");
    expect(avec).toEqual({ logement: "locataire" });
    expect(maj(avec, "logement", "")).toEqual({});
  });

  it("refuse une valeur hors options plutôt que de la deviner", () => {
    expect(maj({}, "logement", "astronaute")).toEqual({});
    expect(maj({}, "aides", ["astronaute"])).toEqual({});
  });

  it("enregistre plusieurs choix, et retire la réponse quand plus aucun n'est coché", () => {
    expect(maj({}, "aides", ["rsa", "apl"])).toEqual({ aides: ["rsa", "apl"] });
    expect(maj({ aides: ["rsa"] }, "aides", [])).toEqual({});
  });

  it("garde « 0 enfant » comme une réponse, convertit les nombres, et refuse les valeurs invalides", () => {
    expect(maj({}, "nombre_enfants", "0")).toEqual({ nombre_enfants: 0 });
    expect(maj({}, "nombre_enfants", "2")).toEqual({ nombre_enfants: 2 });
    expect(maj({}, "nombre_enfants", "abc")).toEqual({});
    expect(maj({}, "nombre_enfants", "-1")).toEqual({});
    expect(maj({}, "nombre_enfants", "1.5")).toEqual({});
  });

  it("nettoie le texte libre", () => {
    expect(maj({}, "commentaire", "  bonjour ")).toEqual({ commentaire: "bonjour" });
  });

  it("ne modifie pas le profil d'origine", () => {
    const origine = { logement: "locataire" };
    maj(origine, "aides", ["rsa"]);
    expect(origine).toEqual({ logement: "locataire" });
  });

  it("retire la réponse d'une question conditionnelle devenue sans objet (jamais une réponse périmée)", () => {
    const profil = maj(maj({}, "logement", "locataire"), "logement_social", "oui");
    expect(profil).toEqual({ logement: "locataire", logement_social: "oui" });
    expect(maj(profil, "logement", "proprietaire")).toEqual({ logement: "proprietaire" });
  });

  it("retire aussi en cascade : plus d'enfants, plus de niveaux scolaires", () => {
    const profil = maj(maj({}, "nombre_enfants", "2"), "enfants_scolarises", ["college"]);
    expect(maj(profil, "nombre_enfants", "0")).toEqual({ nombre_enfants: 0 });
  });
});

describe("retirerReponsesMasquees", () => {
  it("laisse intact un profil dont toutes les réponses sont visibles", () => {
    const profil = { logement: "locataire", logement_social: "non" };
    expect(retirerReponsesMasquees(profil, CHAMPS)).toEqual(profil);
  });

  it("changement de statut (base réelle) : les réponses liées à l'ancien statut sont retirées", () => {
    const champs = chargerBase("agregateurs").champs;
    const statut = champs.find((c) => c.id === "statut_professionnel")!;
    // Retraité → salarié : le montant de la pension n'a plus d'objet.
    const retraite = { statut_professionnel: "retraite", montant_pension: "moins_1000" };
    expect(mettreAJourReponse(retraite, statut, "salarie", champs)).toEqual({ statut_professionnel: "salarie" });
    // Salarié → retraité : « métier pénible » n'a plus d'objet, même si la réponse a été donnée plus tôt.
    const salarie = { statut_professionnel: "salarie", metier_penible: "oui" };
    expect(mettreAJourReponse(salarie, statut, "retraite", champs)).toEqual({ statut_professionnel: "retraite" });
    // Le cas de la page : la réponse de thème est reprise du profil courant, puis le nettoyage final la retire.
    expect(retirerReponsesMasquees({ statut_professionnel: "retraite", metier_penible: "oui" }, champs)).toEqual({ statut_professionnel: "retraite" });
  });
});

describe("heritage : « Les deux »", () => {
  it("une réponse « Les deux » convient à une mesure ciblant « déjà reçu » comme à une mesure ciblant « à venir »", () => {
    expect(valeursDuProfil({ heritage: "les_deux" }, "heritage")).toEqual(expect.arrayContaining(["recu", "a_venir"]));
    expect(valeursDuProfil({ heritage: "recu" }, "heritage")).toEqual(["recu"]);
    expect(valeursDuProfil({ heritage: "non" }, "heritage")).toEqual(["non"]);
  });
});
