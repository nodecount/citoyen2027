import { describe, expect, it } from "vitest";
import { SCHEMA_PROPOSITION_GENEREE, validerPropositionGeneree } from "./schema";

describe("SCHEMA_PROPOSITION_GENEREE (contrainte de l'API structured outputs)", () => {
  it("n'utilise pas minItems/maxItems : l'API n'accepte que 0 ou 1, le minimum de 2 sources est vérifié par validerPropositionGeneree", () => {
    expect(JSON.stringify(SCHEMA_PROPOSITION_GENEREE)).not.toMatch(/minItems|maxItems/);
  });
});

const PROPOSITION_VALIDE = {
  titre: "Titre neutre de la mesure",
  resume_factuel: "Le candidat propose de...",
  sources: [
    { type: "primaire", label: "Programme officiel", url: "https://exemple-officiel.fr/programme" },
    { type: "primaire", label: "Page mesure dédiée", url: "https://exemple-officiel.fr/mesure" },
  ],
  chiffrage_disponible: true,
  hypotheses_calcul: "Chiffrage basé sur...",
  statut: "complet",
  date_derniere_verification: "2026-09-18",
};

describe("validerPropositionGeneree", () => {
  it("accepte une proposition conforme", () => {
    expect(validerPropositionGeneree(PROPOSITION_VALIDE)).toBe(true);
  });

  it("rejette une proposition avec un champ manquant", () => {
    const { titre: _titre, ...sansTitre } = PROPOSITION_VALIDE;
    expect(validerPropositionGeneree(sansTitre)).toBe(false);
  });

  it("rejette un statut invalide", () => {
    expect(validerPropositionGeneree({ ...PROPOSITION_VALIDE, statut: "en-cours" })).toBe(false);
  });

  it("rejette moins de deux sources", () => {
    expect(
      validerPropositionGeneree({ ...PROPOSITION_VALIDE, sources: [PROPOSITION_VALIDE.sources[0]] }),
    ).toBe(false);
  });

  it("rejette un type de source invalide", () => {
    expect(
      validerPropositionGeneree({
        ...PROPOSITION_VALIDE,
        sources: [{ type: "tertiaire", label: "x", url: "https://exemple.fr" }, PROPOSITION_VALIDE.sources[1]],
      }),
    ).toBe(false);
  });

  it("rejette une valeur qui n'est pas un objet", () => {
    expect(validerPropositionGeneree("pas un objet")).toBe(false);
    expect(validerPropositionGeneree(null)).toBe(false);
  });
});
