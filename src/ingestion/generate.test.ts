import { describe, expect, it } from "vitest";
import { construireRequeteGeneration, genererPropositions } from "./generate";
import type { CandidatMeta } from "../types";

const META: CandidatMeta = {
  slug: "test",
  nom: "Candidat Test",
  parti: "Parti Test",
  date_derniere_maj: "2026-09-18",
  sources_officielles: [
    { type: "primaire", label: "Programme", url: "https://exemple-officiel.fr/programme" },
  ],
};

describe("construireRequeteGeneration", () => {
  it("restreint les outils web au domaine officiel du candidat", () => {
    const requete = construireRequeteGeneration(META, "fiscalite", "Fiscalité", []);
    for (const outil of requete.tools as Array<{ allowed_domains?: string[] }>) {
      expect(outil.allowed_domains).toEqual(["exemple-officiel.fr"]);
    }
  });

  it("inclut le nom du candidat dans le prompt système", () => {
    const requete = construireRequeteGeneration(META, "fiscalite", "Fiscalité", []);
    expect(requete.system).toContain("Candidat Test");
  });

  it("inclut les titres existants pour éviter les doublons", () => {
    const requete = construireRequeteGeneration(META, "fiscalite", "Fiscalité", ["Mesure déjà écrite"]);
    expect(requete.system).toContain("Mesure déjà écrite");
  });

  it("utilise le modèle claude-opus-5", () => {
    const requete = construireRequeteGeneration(META, "fiscalite", "Fiscalité", []);
    expect(requete.model).toBe("claude-opus-5");
  });
});

describe("genererPropositions", () => {
  it("filtre les propositions qui ne passent pas la validation de schéma", async () => {
    const propositionValide = {
      titre: "Titre",
      resume_factuel: "Résumé",
      sources: [
        { type: "primaire", label: "A", url: "https://exemple-officiel.fr/a" },
        { type: "primaire", label: "B", url: "https://exemple-officiel.fr/b" },
      ],
      chiffrage_disponible: false,
      hypotheses_calcul: "",
      statut: "complet",
      date_derniere_verification: "2026-09-18",
    };
    const propositionInvalide = { titre: "Incomplète" };
    const clientFactice = {
      messages: {
        create: async () => ({
          content: [{ type: "text", text: JSON.stringify([propositionValide, propositionInvalide]) }],
        }),
      },
    };
    const resultat = await genererPropositions(clientFactice, META, "fiscalite", "Fiscalité", []);
    expect(resultat).toEqual([propositionValide]);
  });

  it("retourne un tableau vide si la réponse ne contient pas de bloc texte", async () => {
    const clientFactice = { messages: { create: async () => ({ content: [] }) } };
    const resultat = await genererPropositions(clientFactice, META, "fiscalite", "Fiscalité", []);
    expect(resultat).toEqual([]);
  });

  it("retourne un tableau vide si le texte n'est pas un JSON valide", async () => {
    const clientFactice = {
      messages: { create: async () => ({ content: [{ type: "text", text: "pas du JSON valide {{{" }] }) },
    };
    const resultat = await genererPropositions(clientFactice, META, "fiscalite", "Fiscalité", []);
    expect(resultat).toEqual([]);
  });

  it("retourne un tableau vide si le JSON valide n'est pas un tableau", async () => {
    const clientFactice = {
      messages: { create: async () => ({ content: [{ type: "text", text: JSON.stringify({ pas: "un tableau" }) }] }) },
    };
    const resultat = await genererPropositions(clientFactice, META, "fiscalite", "Fiscalité", []);
    expect(resultat).toEqual([]);
  });
});
