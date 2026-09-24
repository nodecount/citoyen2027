import { describe, expect, it, vi } from "vitest";
import { clientEnFlux, decrireEvenementFlux } from "./flux";

describe("decrireEvenementFlux", () => {
  it("annonce le démarrage avec les jetons d'entrée", () => {
    const ligne = decrireEvenementFlux({ type: "message_start", message: { usage: { input_tokens: 4200 } } }, 1500);
    expect(ligne).toContain("+2 s");
    expect(ligne).toContain("démarré");
    expect(ligne).toContain("4200");
  });

  it("annonce chaque outil lancé par son nom", () => {
    const ligne = decrireEvenementFlux(
      { type: "content_block_start", content_block: { type: "server_tool_use", name: "web_fetch" } },
      65_000,
    );
    expect(ligne).toContain("+65 s");
    expect(ligne).toContain("web_fetch");
  });

  it("annonce un résultat d'outil réussi, et signale un échec avec son code", () => {
    const ok = decrireEvenementFlux(
      { type: "content_block_start", content_block: { type: "web_fetch_tool_result", content: { type: "web_fetch_result" } } },
      1000,
    );
    expect(ok).toContain("web_fetch_tool_result");
    expect(ok).toContain("ok");
    const echec = decrireEvenementFlux(
      { type: "content_block_start", content_block: { type: "web_fetch_tool_result", content: { error_code: "url_not_accessible" } } },
      1000,
    );
    expect(echec).toContain("ÉCHEC");
    expect(echec).toContain("url_not_accessible");
  });

  it("annonce la rédaction de la réponse et l'arrêt annoncé", () => {
    expect(decrireEvenementFlux({ type: "content_block_start", content_block: { type: "text" } }, 1000)).toContain("rédaction");
    const arret = decrireEvenementFlux(
      { type: "message_delta", delta: { stop_reason: "max_tokens" }, usage: { output_tokens: 16000 } },
      1000,
    );
    expect(arret).toContain("max_tokens");
    expect(arret).toContain("16000");
  });

  it("ignore les événements sans intérêt pour le suivi (deltas de texte, arrêts de bloc)", () => {
    expect(decrireEvenementFlux({ type: "content_block_delta", delta: { type: "text_delta", text: "x" } }, 1)).toBeNull();
    expect(decrireEvenementFlux({ type: "content_block_stop" }, 1)).toBeNull();
    expect(decrireEvenementFlux({ type: "message_delta", delta: {}, usage: {} }, 1)).toBeNull();
  });
});

describe("clientEnFlux", () => {
  function sdkFactice(evenements: unknown[], final: unknown) {
    const ecouteurs: Array<(e: unknown) => void> = [];
    const flux = {
      on: (nom: string, f: (e: unknown) => void) => {
        if (nom === "streamEvent") ecouteurs.push(f);
        return flux;
      },
      finalMessage: async () => {
        evenements.forEach((e) => ecouteurs.forEach((f) => f(e)));
        return final;
      },
    };
    const stream = vi.fn().mockReturnValue(flux);
    return { sdk: { messages: { stream } }, stream };
  }

  it("reçoit la réponse en flux, avec les options de timeout et de relance transmises", async () => {
    const final = { content: [{ type: "text", text: "[]" }], stop_reason: "end_turn" };
    const { sdk, stream } = sdkFactice([], final);
    const client = clientEnFlux(sdk as never, () => {});
    const requete = { model: "m", max_tokens: 1, system: "s", tools: [], output_config: { format: {}, effort: "medium" }, messages: [] };
    const reponse = await client.messages.create(requete, { timeout: 5000, maxRetries: 0 });
    expect(reponse).toBe(final);
    expect(stream).toHaveBeenCalledWith(requete, { timeout: 5000, maxRetries: 0 });
  });

  it("imprime la progression au fil des événements", async () => {
    const lignes: string[] = [];
    const { sdk } = sdkFactice(
      [
        { type: "message_start", message: { usage: { input_tokens: 10 } } },
        { type: "content_block_start", content_block: { type: "server_tool_use", name: "web_search" } },
        { type: "content_block_delta", delta: { type: "text_delta", text: "x" } },
      ],
      { content: [] },
    );
    await clientEnFlux(sdk as never, (l) => lignes.push(l)).messages.create({} as never);
    expect(lignes).toHaveLength(2);
    expect(lignes[1]).toContain("web_search");
  });
});
