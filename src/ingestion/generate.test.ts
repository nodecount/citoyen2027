import { describe, expect, it } from "vitest";
import { construireRequeteGeneration, creerClient, genererPropositions } from "./generate";
import type { CandidatMeta } from "../types";
import Anthropic from "@anthropic-ai/sdk";

const META: CandidatMeta = {
  slug: "test",
  nom: "Candidat Test",
  parti: "Parti Test",
  date_derniere_maj: "2026-09-18",
  sources_officielles: [
    { type: "primaire", label: "Programme", url: "https://exemple-officiel.fr/programme" },
  ],
};

const META_AVEC_RESERVE: CandidatMeta = {
  slug: "test-reserve",
  nom: "Candidat Réserve",
  parti: "Parti Réserve",
  date_derniere_maj: "2026-09-18",
  sources_officielles: [
    {
      type: "primaire",
      label: "Site du parti — publié par le parti, pas attribué personnellement au candidat",
      url: "https://exemple-officiel.fr/programme",
    },
  ],
};

const META_DOMAINE_INVALIDE: CandidatMeta = {
  slug: "test-invalide",
  nom: "Candidat Invalide",
  parti: "Parti Test",
  date_derniere_maj: "2026-09-18",
  sources_officielles: [{ type: "primaire", label: "Programme", url: "pas-une-url" }],
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

  it("inclut les réserves d'attribution issues des labels de sources_officielles dans le prompt système", () => {
    const requete = construireRequeteGeneration(META_AVEC_RESERVE, "fiscalite", "Fiscalité", []);
    expect(requete.system).toContain("publié par le parti, pas attribué personnellement au candidat");
  });

  it("lève une exception si aucun domaine officiel exploitable n'est disponible", () => {
    expect(() => construireRequeteGeneration(META_DOMAINE_INVALIDE, "fiscalite", "Fiscalité", [])).toThrow();
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

  it("rejette si stop_reason vaut refusal, au lieu de retourner silencieusement un tableau vide", async () => {
    const clientFactice = {
      messages: {
        create: async () => ({ content: [{ type: "text", text: "[]" }], stop_reason: "refusal" }),
      },
    };
    await expect(genererPropositions(clientFactice, META, "fiscalite", "Fiscalité", [])).rejects.toThrow();
  });

  it("rejette si un bloc web_search_tool_result contient une erreur d'outil serveur", async () => {
    const clientFactice = {
      messages: {
        create: async () => ({
          content: [{ type: "web_search_tool_result", content: { error_code: "max_uses_exceeded" } }],
        }),
      },
    };
    await expect(genererPropositions(clientFactice, META, "fiscalite", "Fiscalité", [])).rejects.toThrow();
  });
});

describe("creerClient", () => {
  it("construit un client qui utilise réellement la clé fournie explicitement", () => {
    const client = creerClient("cle-de-test");
    expect(client).toBeInstanceOf(Anthropic);
    expect(client.apiKey).toBe("cle-de-test");
  });
});
