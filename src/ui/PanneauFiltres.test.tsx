import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { construireQuestionnaire, CHAMPS_PROFIL } from "../questionnaire";
import type { ProfilPartiel } from "../profil";
import type { Theme } from "../types";
import { PanneauFiltres } from "./PanneauFiltres";

const THEMES: Theme[] = [
  { id: "fiscalite", libelle: "Mes impôts et taxes", question_citoyen: "Combien vais-je payer ?", description: "d", statut: "populated" },
  { id: "retraites", libelle: "Ma retraite", question_citoyen: "À quel âge partir ?", description: "d", statut: "populated" },
];

// « logement » sert aux deux thèmes (question générale, jamais reprise ici) ; « vehicule » n'en sert qu'un (question de
// thème, celle qu'on veut voir dans le panneau).
const QUESTIONNAIRE = construireQuestionnaire(CHAMPS_PROFIL, { logement: ["fiscalite", "retraites"], vehicule: ["fiscalite"] }, THEMES);

const rendre = (profil: ProfilPartiel) => renderToStaticMarkup(<PanneauFiltres questionnaire={QUESTIONNAIRE} profil={profil} onReponse={() => {}} />);

describe("PanneauFiltres", () => {
  it("n'affiche rien tant qu'aucune réponse à une question de thème n'a été donnée", () => {
    expect(rendre({})).toBe("");
  });

  it("n'affiche rien pour une réponse à une question générale seule (déjà récapitulée en haut de page)", () => {
    expect(rendre({ logement: "locataire" })).toBe("");
  });

  it("liste, sous le thème concerné, une question de thème déjà répondue, avec sa réponse déjà sélectionnée", () => {
    const rendu = rendre({ vehicule: "thermique" });
    expect(rendu).toContain("Vos réponses par thème");
    expect(rendu).toContain("<legend>Mes impôts et taxes</legend>");
    expect(rendu).toContain("Quel véhicule utilisez-vous le plus ?");
    expect(rendu).toMatch(/<option value="thermique" selected/);
    expect(rendu).not.toContain("Ma retraite"); // aucune réponse sur ce thème
  });

  it("regroupe par thème, sous un fieldset par thème répondu", () => {
    const seulementFiscalite = construireQuestionnaire(CHAMPS_PROFIL, { vehicule: ["fiscalite"], metier_penible: ["retraites"] }, THEMES);
    const rendu = renderToStaticMarkup(
      <PanneauFiltres questionnaire={seulementFiscalite} profil={{ vehicule: "thermique" }} onReponse={() => {}} />,
    );
    expect((rendu.match(/<fieldset/g) ?? []).length).toBe(1);
    expect(rendu).toContain("Mes impôts et taxes");
    expect(rendu).not.toContain("Ma retraite"); // aucune réponse sur ce thème : il n'a pas de fieldset
  });
});
