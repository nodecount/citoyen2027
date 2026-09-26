import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_CONTINUATIONS, TIMEOUT_APPEL_MS, appeler, definirBudget, resumerAppel } from "./appel";
import { Budget, TARIFS_PAR_MODELE } from "./budget";
import type { ReponseAnthropicMinimale, RequeteGeneration } from "./generate";

const REQUETE: RequeteGeneration = {
  model: "claude-sonnet-5",
  max_tokens: 16000,
  system: "S",
  tools: [],
  output_config: { format: {}, effort: "medium" },
  messages: [{ role: "user", content: "Q" }],
};
const CONTEXTE = { phase: "génération", slug: "attal", themeId: "fiscalite" };

function reponse(surcharge: Partial<ReponseAnthropicMinimale> = {}): ReponseAnthropicMinimale {
  return { content: [{ type: "text", text: "[]" }], stop_reason: "end_turn", usage: { input_tokens: 100, output_tokens: 10 }, ...surcharge };
}

function silencieux() {
  return {
    log: vi.spyOn(console, "log").mockImplementation(() => {}),
    erreur: vi.spyOn(console, "error").mockImplementation(() => {}),
  };
}

describe("appeler", () => {
  it("impose un timeout et aucune relance automatique : une relance repayerait tout l'appel", async () => {
    const espions = silencieux();
    const create = vi.fn().mockResolvedValue(reponse());
    await appeler({ messages: { create } }, REQUETE, CONTEXTE);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][1]).toEqual({ timeout: TIMEOUT_APPEL_MS, maxRetries: 0 });
    Object.values(espions).forEach((e) => e.mockRestore());
  });

  it("imprime un bilan complet : arrêt, jetons, durée, outils", async () => {
    const espions = silencieux();
    const create = vi.fn().mockResolvedValue(
      reponse({ usage: { input_tokens: 1500000, output_tokens: 8000, cache_read_input_tokens: 42 } }),
    );
    await appeler({ messages: { create } }, REQUETE, CONTEXTE);
    const sortie = espions.log.mock.calls.map((c) => String(c[0])).join("\n");
    expect(sortie).toContain("génération attal × fiscalite");
    expect(sortie).toContain("fin normale (end_turn)");
    expect(sortie).toContain("1500000");
    expect(sortie).toContain("cache lu 42");
    expect(sortie).toContain("claude-sonnet-5");
    expect(sortie).toContain("timeout 10 min");
    Object.values(espions).forEach((e) => e.mockRestore());
  });

  it("signale une troncature (max_tokens) comme un arrêt anormal, en toutes lettres", async () => {
    const espions = silencieux();
    const create = vi.fn().mockResolvedValue(reponse({ stop_reason: "max_tokens" }));
    const { reponse: r } = await appeler({ messages: { create } }, REQUETE, CONTEXTE);
    expect(r.stop_reason).toBe("max_tokens");
    const sortie = espions.log.mock.calls.map((c) => String(c[0])).join("\n");
    expect(sortie).toContain("SORTIE TRONQUÉE");
    Object.values(espions).forEach((e) => e.mockRestore());
  });

  it("continue après pause_turn en renvoyant la réponse partielle, puis fusionne contenu et jetons", async () => {
    const espions = silencieux();
    const create = vi
      .fn()
      .mockResolvedValueOnce(
        reponse({
          stop_reason: "pause_turn",
          content: [{ type: "server_tool_use", id: "s1", name: "web_search", input: { query: "q" } }],
          usage: { input_tokens: 1000, output_tokens: 50 },
        }),
      )
      .mockResolvedValueOnce(reponse({ usage: { input_tokens: 2000, output_tokens: 70 } }));
    const resultat = await appeler({ messages: { create } }, REQUETE, CONTEXTE);

    expect(create).toHaveBeenCalledTimes(2);
    const secondeRequete = create.mock.calls[1][0] as RequeteGeneration;
    expect(secondeRequete.messages).toHaveLength(2);
    expect(secondeRequete.messages[1].role).toBe("assistant");
    expect(resultat.continuations).toBe(1);
    expect(resultat.reponse.stop_reason).toBe("end_turn");
    expect(resultat.reponse.content.map((b) => b.type)).toEqual(["server_tool_use", "text"]);
    expect(resultat.reponse.usage).toMatchObject({ input_tokens: 3000, output_tokens: 120 });
    Object.values(espions).forEach((e) => e.mockRestore());
  });

  it("s'arrête avec une erreur si la pause dure trop, plutôt que de boucler en payant", async () => {
    const espions = silencieux();
    const create = vi.fn().mockResolvedValue(reponse({ stop_reason: "pause_turn" }));
    await expect(appeler({ messages: { create } }, REQUETE, CONTEXTE)).rejects.toThrow("pause_turn");
    expect(create).toHaveBeenCalledTimes(MAX_CONTINUATIONS + 1);
    Object.values(espions).forEach((e) => e.mockRestore());
  });

  it("attribue le timeout à notre limite SEULEMENT si la durée l'a atteinte, et relance l'erreur", async () => {
    const espions = silencieux();
    const erreurTimeout = Object.assign(new Error("Request timed out."), { name: "APIConnectionTimeoutError" });
    const create = vi.fn().mockRejectedValue(erreurTimeout);
    // Limite ramenée à 0 : n'importe quelle durée l'a « atteinte ».
    await expect(appeler({ messages: { create } }, REQUETE, CONTEXTE, { timeoutMs: 0 })).rejects.toThrow("timed out");
    const sortie = espions.erreur.mock.calls.map((c) => String(c[0])).join("\n");
    expect(sortie).toContain("TIMEOUT imposé");
    expect(sortie).not.toContain("AVANT notre limite");
    Object.values(espions).forEach((e) => e.mockRestore());
  });

  it("ne prétend PAS que notre limite est en cause quand la coupure arrive bien avant elle", async () => {
    const espions = silencieux();
    const erreurTimeout = Object.assign(new Error("Request timed out."), { name: "APIConnectionTimeoutError" });
    const create = vi.fn().mockRejectedValue(erreurTimeout);
    await expect(appeler({ messages: { create } }, REQUETE, CONTEXTE)).rejects.toThrow("timed out");
    const sortie = espions.erreur.mock.calls.map((c) => String(c[0])).join("\n");
    expect(sortie).toContain("AVANT notre limite");
    expect(sortie).toContain("10 min");
    expect(sortie).toContain("connexion");
    expect(sortie).not.toContain("TIMEOUT imposé");
    Object.values(espions).forEach((e) => e.mockRestore());
  });

  it("journalise aussi une erreur non liée au timeout, sans la présenter comme un timeout", async () => {
    const espions = silencieux();
    const create = vi.fn().mockRejectedValue(new Error("400 invalid_request_error"));
    await expect(appeler({ messages: { create } }, REQUETE, CONTEXTE)).rejects.toThrow("400");
    const sortie = espions.erreur.mock.calls.map((c) => String(c[0])).join("\n");
    expect(sortie).toContain("ÉCHEC");
    expect(sortie).not.toContain("TIMEOUT");
    Object.values(espions).forEach((e) => e.mockRestore());
  });
});

describe("resumerAppel", () => {
  it("compte les recherches et lectures déclarées par l'API en plus des blocs observés", () => {
    const texte = resumerAppel(
      reponse({ usage: { input_tokens: 5, output_tokens: 6, server_tool_use: { web_search_requests: 3, web_fetch_requests: 7 } } }),
      1000,
    );
    expect(texte).toContain("recherches 3");
    expect(texte).toContain("lectures 7");
  });

  it("dit la longueur du texte final : un texte vide n'est pas une réponse", () => {
    expect(resumerAppel(reponse({ content: [{ type: "text", text: "[]" }] }), 1000)).toContain("texte final : 2 caractères");
    expect(resumerAppel(reponse({ content: [] }), 1000)).toContain("texte final : aucun");
  });
});

describe("appeler avec un budget", () => {
  const REQUETE_CACHE: RequeteGeneration = {
    model: "claude-sonnet-5",
    max_tokens: 8000,
    system: "S".repeat(360),
    tools: [],
    output_config: { format: {}, effort: "medium" },
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "C".repeat(360_000), cache_control: { type: "ephemeral" } }, // ~100 000 jetons de corpus
          { type: "text", text: "Q".repeat(360) },
        ],
      },
    ],
  };

  afterEach(() => definirBudget(undefined));

  it("refuse d'envoyer un appel dont le coût estimé dépasse le plafond, sans le facturer", async () => {
    const espions = silencieux();
    definirBudget(new Budget(0.05, TARIFS_PAR_MODELE["claude-sonnet-5"], 1));
    const create = vi.fn().mockResolvedValue(reponse());
    await expect(appeler({ messages: { create } }, REQUETE_CACHE, CONTEXTE)).rejects.toThrow(/Budget dépassé/);
    expect(create).not.toHaveBeenCalled();
    Object.values(espions).forEach((e) => e.mockRestore());
  });

  it("enregistre le coût réel de l'appel et l'affiche avec le cumul et le plafond", async () => {
    const espions = silencieux();
    const budget = new Budget(5, TARIFS_PAR_MODELE["claude-sonnet-5"], 1);
    definirBudget(budget);
    const create = vi.fn().mockResolvedValue(reponse({ usage: { input_tokens: 1_000, output_tokens: 1_000, cache_creation_input_tokens: 100_000 } }));
    await appeler({ messages: { create } }, REQUETE_CACHE, CONTEXTE);
    expect(budget.depenseEur).toBeGreaterThan(0.3);
    const sortie = espions.log.mock.calls.map((c) => String(c[0])).join("\n");
    expect(sortie).toContain("coût");
    expect(sortie).toContain("plafond");
    Object.values(espions).forEach((e) => e.mockRestore());
  });

  it("estime la lecture du corpus au tarif du cache quand il est chaud : le second appel passe là où le premier aurait été refusé", async () => {
    const espions = silencieux();
    const tarifs = TARIFS_PAR_MODELE["claude-sonnet-5"];
    // Plafond entre le coût d'une écriture de cache (~0,50 $) et celui d'une lecture (~0,15 $).
    const budget = new Budget(0.4, tarifs, 1);
    budget.enregistrer({ cache_read_input_tokens: 10 }); // cache déclaré chaud
    definirBudget(budget);
    const create = vi.fn().mockResolvedValue(reponse());
    await expect(appeler({ messages: { create } }, REQUETE_CACHE, CONTEXTE)).resolves.toBeDefined();
    Object.values(espions).forEach((e) => e.mockRestore());
  });

  it("sans budget défini, ne contrôle rien (comportement existant)", async () => {
    const espions = silencieux();
    const create = vi.fn().mockResolvedValue(reponse());
    await expect(appeler({ messages: { create } }, REQUETE_CACHE, CONTEXTE)).resolves.toBeDefined();
    Object.values(espions).forEach((e) => e.mockRestore());
  });
});
