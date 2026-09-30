import { describe, expect, it } from "vitest";
import type { Lanceur } from "../scraping/claude-cli";
import { PanneCli } from "../scraping/claude-cli";
import { LimiteAppelsAtteinte, clientCli, retirerBalisesParasites } from "./client-cli";
import type { RequeteGeneration } from "./generate";

const SCHEMA = { type: "array", items: { type: "string" } };

const REPONSE_OK = JSON.stringify({
  is_error: false,
  stop_reason: "end_turn",
  result: "",
  structured_output: { resultat: ["a", "b"] },
  total_cost_usd: 0.05,
  usage: { input_tokens: 10, cache_creation_input_tokens: 100, cache_read_input_tokens: 40, output_tokens: 7 },
});

function requete(surcharge: Partial<RequeteGeneration> = {}): RequeteGeneration {
  return {
    model: "claude-sonnet-5",
    max_tokens: 1000,
    system: "Système.",
    tools: [],
    output_config: { format: { type: "json_schema", schema: SCHEMA }, effort: "low" },
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "CORPUS", cache_control: { type: "ephemeral" } },
          { type: "text", text: "Question" },
        ],
      },
    ],
    ...surcharge,
  };
}

function lanceurEspion(stdout = REPONSE_OK) {
  const appels: Array<{ args: string[]; entree: string }> = [];
  const lanceur: Lanceur = async (_e, args, entree) => {
    appels.push({ args, entree });
    return { code: 0, stdout, stderr: "", delaiDepasse: false };
  };
  return { lanceur, appels };
}

describe("retirerBalisesParasites", () => {
  it("retire les balises fermantes collées en fin de chaîne, à tous les niveaux", () => {
    expect(retirerBalisesParasites({ texte: "Phrase.</texte>\n</invoke>\n", l: ["a</x>", "b"] })).toEqual({ texte: "Phrase.", l: ["a", "b"] });
  });

  it("ne touche pas au reste : balise au milieu, balise ouvrante, autres types", () => {
    expect(retirerBalisesParasites("a </b> c")).toBe("a </b> c");
    expect(retirerBalisesParasites("fin <texte>")).toBe("fin <texte>");
    expect(retirerBalisesParasites({ n: 3, ok: true, v: null })).toEqual({ n: 3, ok: true, v: null });
  });
});

describe("clientCli", () => {
  it("renvoie la sortie structurée sous forme de bloc texte JSON, comme le ferait l'API", async () => {
    const { lanceur, appels } = lanceurEspion();
    const client = clientCli({ lanceur });
    const r = await client.messages.create(requete());
    expect(JSON.parse(r.content[0].text!)).toEqual(["a", "b"]);
    expect(r.stop_reason).toBe("end_turn");
    expect(r.usage).toEqual({ input_tokens: 150, output_tokens: 7 });
    expect(appels[0].entree).toBe("CORPUS\n\nQuestion"); // les blocs sont concaténés, le corpus en tête
    expect(client.coutReferenceUsd()).toBeCloseTo(0.05);
  });

  it("enveloppe un schéma tableau dans un objet (la commande exige un objet à la racine)", async () => {
    const { lanceur, appels } = lanceurEspion();
    await clientCli({ lanceur }).messages.create(requete());
    const args = appels[0].args;
    const schema = JSON.parse(args[args.indexOf("--json-schema") + 1]);
    expect(schema.type).toBe("object");
    expect(schema.properties.resultat).toEqual(SCHEMA);
  });

  it("refuse une requête avec outils web", async () => {
    const client = clientCli({ lanceur: lanceurEspion().lanceur });
    await expect(client.messages.create(requete({ tools: [{ type: "web_search_20260209", name: "web_search", allowed_domains: [] }] }))).rejects.toThrow(/outils web/);
  });

  it("refuse une requête sans schéma de sortie", async () => {
    const client = clientCli({ lanceur: lanceurEspion().lanceur });
    await expect(client.messages.create(requete({ output_config: { format: undefined, effort: "low" } }))).rejects.toThrow(/schéma/);
  });

  it("s'arrête au plafond d'appels, avant d'appeler", async () => {
    const { lanceur, appels } = lanceurEspion();
    const client = clientCli({ lanceur, maxAppels: 1 });
    await client.messages.create(requete());
    await expect(client.messages.create(requete())).rejects.toBeInstanceOf(LimiteAppelsAtteinte);
    expect(appels).toHaveLength(1);
  });

  it("place un très long prompt système dans le message plutôt que sur la ligne de commande", async () => {
    const { lanceur, appels } = lanceurEspion();
    const long = "x".repeat(25_000);
    await clientCli({ lanceur }).messages.create(requete({ system: long }));
    expect(appels[0].args.join(" ")).not.toContain(long);
    expect(appels[0].entree.startsWith(long)).toBe(true);
  });

  it("transmet l'effort demandé", async () => {
    const { lanceur, appels } = lanceurEspion();
    await clientCli({ lanceur }).messages.create(requete({ output_config: { format: { type: "json_schema", schema: SCHEMA }, effort: "high" } }));
    expect(appels[0].args[appels[0].args.indexOf("--effort") + 1]).toBe("high");
  });

  it("laisse remonter une panne d'abonnement (PanneCli)", async () => {
    const lanceur: Lanceur = async () => ({ code: 1, stdout: JSON.stringify({ is_error: true, result: "Claude usage limit reached" }), stderr: "", delaiDepasse: false });
    await expect(clientCli({ lanceur }).messages.create(requete())).rejects.toBeInstanceOf(PanneCli);
  });
});
