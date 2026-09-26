import { describe, expect, it } from "vitest";
import { CHAMPS_CIBLES, DIMENSIONS_EFFET, SENS_EFFET } from "../effets";
import { SCHEMA_PROPOSITION_GENEREE, SOURCES_MINIMUM, validerPropositionGeneree } from "./schema";

describe("SCHEMA_PROPOSITION_GENEREE (contrainte de l'API structured outputs)", () => {
  it("n'utilise pas minItems/maxItems : l'API n'accepte que 0 ou 1, le minimum de 2 sources est vérifié par validerPropositionGeneree", () => {
    expect(JSON.stringify(SCHEMA_PROPOSITION_GENEREE)).not.toMatch(/minItems|maxItems/);
  });
});

const PROPOSITION_VALIDE = {
  titre: "Titre neutre de la mesure",
  resume_factuel: "Le candidat propose de...",
  sources: [
    { type: "primaire", label: "Programme officiel", url: "https://exemple-officiel.fr/programme", nom: "Source", annee: 2026 },
    { type: "primaire", label: "Page mesure dédiée", url: "https://exemple-officiel.fr/mesure", nom: "Source", annee: 2026 },
  ],
  chiffrage_disponible: true,
  hypotheses_calcul: "Chiffrage basé sur...",
  statut: "complet",
  date_derniere_verification: "2026-09-18",
  effets: [
    {
      cibles: [{ champ: "tranche_revenus", valeurs: ["plus_5000"] }],
      dimension: "revenu_disponible",
      sens: "baisse",
      source_url: "https://exemple-officiel.fr/mesure",
      extrait: "Création d'une contribution exceptionnelle sur les hauts revenus.",
    },
  ],
};

describe("effets dans la proposition générée", () => {
  it("expose effets dans le schéma envoyé à l'API et le déclare obligatoire", () => {
    expect(SCHEMA_PROPOSITION_GENEREE.properties).toHaveProperty("effets");
    expect(SCHEMA_PROPOSITION_GENEREE.required).toContain("effets");
  });

  it("le schéma d'API limite champ, dimension et sens aux référentiels du code", () => {
    const item = SCHEMA_PROPOSITION_GENEREE.properties.effets.items;
    expect(item.properties.dimension.enum).toEqual([...DIMENSIONS_EFFET]);
    expect(item.properties.sens.enum).toEqual([...SENS_EFFET]);
    expect(item.properties.cibles.items.properties.champ.enum).toEqual([...CHAMPS_CIBLES]);
  });

  it("accepte effets vide : mesure sans effet direct déterminable sur un citoyen", () => {
    expect(validerPropositionGeneree({ ...PROPOSITION_VALIDE, effets: [] })).toBe(true);
  });

  it("rejette une proposition sans effets (le champ est obligatoire, même vide)", () => {
    const { effets: _effets, ...sansEffets } = PROPOSITION_VALIDE;
    expect(validerPropositionGeneree(sansEffets)).toBe(false);
  });

  it("rejette un effet dont la source_url n'est pas une source de la proposition", () => {
    const effetHorsSource = { ...PROPOSITION_VALIDE.effets[0], source_url: "https://inconnu.fr/x", nom: "Source", annee: 2026 };
    expect(validerPropositionGeneree({ ...PROPOSITION_VALIDE, effets: [effetHorsSource] })).toBe(false);
  });

  it("rejette un effet invalide (valeur hors profil)", () => {
    const effetInvalide = {
      ...PROPOSITION_VALIDE.effets[0],
      cibles: [{ champ: "tranche_revenus", valeurs: ["tres_riche"] }],
    };
    expect(validerPropositionGeneree({ ...PROPOSITION_VALIDE, effets: [effetInvalide] })).toBe(false);
  });
});

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

  it("accepte une seule source primaire : son extrait est vérifié mot pour mot par le code (SOURCES_MINIMUM = 1)", () => {
    expect(
      validerPropositionGeneree({ ...PROPOSITION_VALIDE, sources: [PROPOSITION_VALIDE.sources[0]], effets: [] }),
    ).toBe(true);
    expect(SOURCES_MINIMUM).toBe(1);
  });

  it("rejette une proposition sans aucune source", () => {
    expect(validerPropositionGeneree({ ...PROPOSITION_VALIDE, sources: [], effets: [] })).toBe(false);
  });

  it("rejette un type de source invalide", () => {
    expect(
      validerPropositionGeneree({
        ...PROPOSITION_VALIDE,
        sources: [{ type: "tertiaire", label: "x", url: "https://exemple.fr", nom: "Source", annee: 2026 }, PROPOSITION_VALIDE.sources[1]],
      }),
    ).toBe(false);
  });

  it("rejette une valeur qui n'est pas un objet", () => {
    expect(validerPropositionGeneree("pas un objet")).toBe(false);
    expect(validerPropositionGeneree(null)).toBe(false);
  });
});

describe("sources citables (nom · année)", () => {
  it("le schéma d'API exige nom (chaîne) et annee (entier) pour chaque source", () => {
    const source = SCHEMA_PROPOSITION_GENEREE.properties.sources.items;
    expect(source.properties.nom.type).toBe("string");
    expect(source.properties.annee.type).toBe("integer");
    expect(source.required).toContain("nom");
    expect(source.required).toContain("annee");
  });

  it("rejette une source sans nom court", () => {
    const { nom: _nom, ...sansNom } = PROPOSITION_VALIDE.sources[0];
    expect(
      validerPropositionGeneree({ ...PROPOSITION_VALIDE, sources: [sansNom, PROPOSITION_VALIDE.sources[1]] }),
    ).toBe(false);
  });

  it("rejette une année non entière ou hors plage plausible", () => {
    for (const annee of [2021.5, "2021", 1850, 2200]) {
      const source = { ...PROPOSITION_VALIDE.sources[0], annee };
      expect(
        validerPropositionGeneree({ ...PROPOSITION_VALIDE, sources: [source, PROPOSITION_VALIDE.sources[1]] }),
      ).toBe(false);
    }
  });

  it("accepte une position ancienne datée (ex : amendement de 2021)", () => {
    const source = { ...PROPOSITION_VALIDE.sources[0], annee: 2021, nom: "Assemblée nationale" };
    expect(
      validerPropositionGeneree({ ...PROPOSITION_VALIDE, sources: [source, PROPOSITION_VALIDE.sources[1]] }),
    ).toBe(true);
  });
});
