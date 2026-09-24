import { describe, expect, it } from "vitest";
import { resumerAppel, type ReponseAnthropicMinimale } from "./generate";

describe("resumerAppel", () => {
  const reponse: ReponseAnthropicMinimale = {
    usage: { input_tokens: 132000, output_tokens: 9800 },
    content: [
      { type: "server_tool_use", id: "s1", name: "web_search", input: { query: "fiscalité programme" } },
      { type: "server_tool_use", id: "f1", name: "web_fetch", input: { url: "https://exemple-officiel.fr/programme" } },
      { type: "web_fetch_tool_result", tool_use_id: "f1", content: { type: "web_fetch_result" } },
      { type: "server_tool_use", id: "f2", name: "web_fetch", input: { url: "https://exemple-officiel.fr/introuvable" } },
      { type: "web_fetch_tool_result", tool_use_id: "f2", content: { error_code: "url_not_accessible" } },
      { type: "text", text: "[]" },
    ],
  };

  it("indique la durée, les jetons et le nombre d'appels d'outil par outil", () => {
    const ligne = resumerAppel(reponse, 14 * 60_000 + 8_000);
    expect(ligne).toContain("14 min 8 s");
    expect(ligne).toContain("132000");
    expect(ligne).toContain("9800");
    expect(ligne).toContain("web_search ×1");
    expect(ligne).toContain("web_fetch ×2");
  });

  it("liste les adresses qui ont échoué avec leur code, sans lister celles qui ont réussi", () => {
    const ligne = resumerAppel(reponse, 1000);
    expect(ligne).toContain("https://exemple-officiel.fr/introuvable (url_not_accessible)");
    expect(ligne).not.toContain("programme (");
  });

  it("reste lisible sans usage ni appel d'outil", () => {
    const ligne = resumerAppel({ content: [{ type: "text", text: "[]" }] }, 2400);
    expect(ligne).toContain("2 s");
    expect(ligne).toContain("aucun appel d'outil");
  });
});
