import { describe, expect, it, vi } from "vitest";
import { construireRequeteGeneration, creerClient, genererPropositions, genererPropositionsDetaillee } from "./generate";
import { DOMAINES_INSTITUTIONNELS } from "./domaines";
import { VALEURS_PAR_CHAMP } from "../effets";
import themesData from "../../data/bases/officielle/themes.json";
import type { CandidatMeta } from "../types";
import Anthropic from "@anthropic-ai/sdk";

const META: CandidatMeta = {
  slug: "test",
  nom: "Candidat Test",
  parti: "Parti Test",
  date_derniere_maj: "2026-09-18",
  sources_officielles: [
    { type: "primaire", label: "Programme", url: "https://exemple-officiel.fr/programme", nom: "Source", annee: 2026 },
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
  it("restreint les outils web au domaine officiel du candidat et aux domaines institutionnels de la liste blanche", () => {
    const requete = construireRequeteGeneration(META, "fiscalite", "Fiscalité", []);
    for (const outil of requete.tools as Array<{ allowed_domains?: string[] }>) {
      expect(outil.allowed_domains).toEqual(["exemple-officiel.fr", ...DOMAINES_INSTITUTIONNELS]);
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

  it("utilise le modèle claude-sonnet-5", () => {
    const requete = construireRequeteGeneration(META, "fiscalite", "Fiscalité", []);
    expect(requete.model).toBe("claude-sonnet-5");
  });

  it("transmet le libellé et le périmètre du thème issus de themes.json", () => {
    const requete = construireRequeteGeneration(META, "fiscalite", "Fiscalité", []);
    const fiscalite = themesData.find((t) => t.id === "fiscalite")!;
    expect(requete.system).toContain("« Fiscalité »");
    expect(requete.system).toContain(fiscalite.description);
  });

  it("injecte la date du jour au lieu de laisser le modèle l'inventer", () => {
    const requete = construireRequeteGeneration(META, "fiscalite", "Fiscalité", []);
    expect(requete.system).toContain(new Date().toISOString().slice(0, 10));
  });

  it("ne laisse aucun marqueur de gabarit non remplacé", () => {
    const requete = construireRequeteGeneration(META, "fiscalite", "Fiscalité", []);
    expect(requete.system).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it("liste au modèle les champs de profil ciblables avec leurs valeurs exactes, issus du formulaire citoyen", () => {
    const { system } = construireRequeteGeneration(META, "fiscalite", "Fiscalité", []);
    for (const [champ, valeurs] of Object.entries(VALEURS_PAR_CHAMP)) {
      expect(system).toContain(`\`${champ}\``);
      for (const valeur of valeurs) expect(system).toContain(`\`${valeur}\``);
    }
    expect(system).toContain("`autre`");
  });

  it("nomme les domaines institutionnels et impose au moins une source officielle du candidat", () => {
    const { system } = construireRequeteGeneration(META, "fiscalite", "Fiscalité", []);
    const texte = system.replace(/\s+/g, " "); // le gabarit est renvoyé à la ligne : sans importance pour le modèle
    for (const domaine of DOMAINES_INSTITUTIONNELS) expect(texte).toContain(domaine);
    expect(texte).toContain("toujours défendue");
  });

  it("interdit d'élargir le périmètre d'une mesure et les effets de second ordre, exige un extrait mot pour mot", () => {
    const texte = construireRequeteGeneration(META, "fiscalite", "Fiscalité", []).system.replace(/\s+/g, " ");
    expect(texte).toContain("N'élargis jamais le périmètre");
    expect(texte).toContain("premier ordre");
    expect(texte).toContain("mot pour mot");
  });

  it("pose la règle « précision ou rien » et l'exhaustivité identique entre candidats", () => {
    const { system } = construireRequeteGeneration(META, "fiscalite", "Fiscalité", []);
    expect(system).toContain("Précision ou rien");
    expect(system).toContain("Exhaustivité identique");
  });

  it("demande le nom court et l'année de chaque source (citation « nom · année »)", () => {
    const { system } = construireRequeteGeneration(META, "fiscalite", "Fiscalité", []);
    expect(system).toContain("nom · année");
  });

  it("insère les titres existants tels quels, même s'ils contiennent des séquences spéciales de remplacement", () => {
    const { system } = construireRequeteGeneration(META, "fiscalite", "Fiscalité", ["Mesure « $& » à 5 $1"]);
    expect(system).toContain("Mesure « $& » à 5 $1");
  });

  it("demande un tableau vide plutôt qu'une invention quand rien n'est trouvé", () => {
    const requete = construireRequeteGeneration(META, "fiscalite", "Fiscalité", []);
    expect(requete.system).toContain("`[]`");
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
        { type: "primaire", label: "A", url: "https://exemple-officiel.fr/a", nom: "Source", annee: 2026 },
        { type: "primaire", label: "B", url: "https://exemple-officiel.fr/b", nom: "Source", annee: 2026 },
      ],
      chiffrage_disponible: false,
      hypotheses_calcul: "",
      statut: "complet",
      date_derniere_verification: "2026-09-18",
      effets: [],
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

  it("retourne un tableau vide UNIQUEMENT quand le modèle répond explicitement []", async () => {
    const clientFactice = {
      messages: { create: async () => ({ content: [{ type: "text", text: "[]" }], stop_reason: "end_turn" }) },
    };
    const resultat = await genererPropositions(clientFactice, META, "fiscalite", "Fiscalité", []);
    expect(resultat).toEqual([]);
  });

  it("lève au lieu de retourner [] si la réponse ne contient aucun bloc texte : un arrêt anormal n'est pas « aucune mesure »", async () => {
    const clientFactice = { messages: { create: async () => ({ content: [] }) } };
    await expect(genererPropositions(clientFactice, META, "fiscalite", "Fiscalité", [])).rejects.toThrow("aucune réponse textuelle");
  });

  it("lève, en citant le début de la réponse, si le texte n'est pas un JSON valide", async () => {
    const clientFactice = {
      messages: { create: async () => ({ content: [{ type: "text", text: "pas du JSON valide {{{" }] }) },
    };
    await expect(genererPropositions(clientFactice, META, "fiscalite", "Fiscalité", [])).rejects.toThrow("pas du JSON valide");
  });

  it("lève si le JSON valide n'est pas un tableau", async () => {
    const clientFactice = {
      messages: { create: async () => ({ content: [{ type: "text", text: JSON.stringify({ pas: "un tableau" }) }] }) },
    };
    await expect(genererPropositions(clientFactice, META, "fiscalite", "Fiscalité", [])).rejects.toThrow("pas un tableau");
  });

  it("lève si la sortie est tronquée (max_tokens), même si le texte reçu est un JSON valide", async () => {
    const clientFactice = {
      messages: { create: async () => ({ content: [{ type: "text", text: "[]" }], stop_reason: "max_tokens" }) },
    };
    await expect(genererPropositions(clientFactice, META, "fiscalite", "Fiscalité", [])).rejects.toThrow("TRONQUÉE");
  });

  it("lit le JSON dans le DERNIER bloc texte quand des textes intermédiaires précèdent", async () => {
    const clientFactice = {
      messages: {
        create: async () => ({
          content: [
            { type: "text", text: "Je consulte le site officiel…" },
            { type: "text", text: "[]" },
          ],
          stop_reason: "end_turn",
        }),
      },
    };
    expect(await genererPropositions(clientFactice, META, "fiscalite", "Fiscalité", [])).toEqual([]);
  });

  it("fournit un diagnostic : arrêt, durée, pages lues et échecs, pour ne jamais avoir un vide inexplicable", async () => {
    const clientFactice = {
      messages: {
        create: async () => ({
          content: [
            { type: "server_tool_use", id: "f1", name: "web_fetch", input: { url: "https://exemple-officiel.fr/programme" } },
            { type: "web_fetch_tool_result", tool_use_id: "f1", content: { type: "web_fetch_result" } },
            { type: "server_tool_use", id: "f2", name: "web_fetch", input: { url: "https://exemple-officiel.fr/absent" } },
            { type: "web_fetch_tool_result", tool_use_id: "f2", content: { error_code: "url_not_accessible" } },
            { type: "text", text: "[]" },
          ],
          stop_reason: "end_turn",
          usage: { input_tokens: 500, output_tokens: 20 },
        }),
      },
    };
    const { diagnostic, propositions } = await genererPropositionsDetaillee(clientFactice, META, "fiscalite", "Fiscalité", []);
    expect(propositions).toEqual([]);
    expect(diagnostic.stop_reason).toBe("end_turn");
    expect(diagnostic.usage).toMatchObject({ input_tokens: 500, output_tokens: 20 });
    expect(diagnostic.activite.urlsLues).toEqual(["https://exemple-officiel.fr/programme"]);
    expect(diagnostic.activite.echecs).toEqual([{ cible: "https://exemple-officiel.fr/absent", code: "url_not_accessible" }]);
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

  it("rejette une panne de l'outil (indisponible, quota) : un « thème vide » pourrait sinon la masquer", async () => {
    for (const error_code of ["unavailable", "too_many_requests", "max_uses_exceeded"]) {
      const clientFactice = {
        messages: {
          create: async () => ({ content: [{ type: "web_fetch_tool_result", content: { error_code } }] }),
        },
      };
      await expect(genererPropositions(clientFactice, META, "fiscalite", "Fiscalité", [])).rejects.toThrow(error_code);
    }
  });

  it("tolère une erreur propre à une URL (page introuvable, hors domaine) : le modèle explore, puis répond", async () => {
    const proposition = {
      titre: "T",
      resume_factuel: "R",
      sources: [
        { type: "primaire", label: "A", url: "https://exemple-officiel.fr/a", nom: "Source", annee: 2026 },
        { type: "primaire", label: "B", url: "https://exemple-officiel.fr/b", nom: "Source", annee: 2026 },
      ],
      chiffrage_disponible: false,
      hypotheses_calcul: "",
      statut: "complet",
      date_derniere_verification: "2026-09-25",
      effets: [],
    };
    const avertissements = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const error_code of [
      "url_not_accessible",
      "url_not_allowed",
      "url_not_in_prior_context",
      "url_too_long",
      "unsupported_content_type",
      "code_inconnu",
    ]) {
      const clientFactice = {
        messages: {
          create: async () => ({
            content: [
              { type: "web_fetch_tool_result", content: { error_code } },
              { type: "text", text: JSON.stringify([proposition]) },
            ],
          }),
        },
      };
      const resultat = await genererPropositions(clientFactice, META, "fiscalite", "Fiscalité", []);
      expect(resultat).toHaveLength(1);
    }
    // Tolérée ne veut pas dire silencieuse : chaque erreur est journalisée.
    expect(avertissements).toHaveBeenCalledTimes(6);
    avertissements.mockRestore();
  });
});

describe("creerClient", () => {
  it("construit un client qui utilise réellement la clé fournie explicitement", () => {
    const client = creerClient("cle-de-test");
    expect(client).toBeInstanceOf(Anthropic);
    expect(client.apiKey).toBe("cle-de-test");
  });
});
