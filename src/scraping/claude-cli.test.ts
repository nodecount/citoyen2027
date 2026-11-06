import { describe, expect, it } from "vitest";
import { PanneCli, appelerClaudeCli, construireArguments, type Lanceur } from "./claude-cli";

const SCHEMA = { type: "object", properties: { a: { type: "string" } }, required: ["a"] };

function lanceurQuiRepond(stdout: string, code = 0, stderr = ""): { lanceur: Lanceur; appels: Array<{ args: string[]; entree: string; cwd: string }> } {
  const appels: Array<{ args: string[]; entree: string; cwd: string }> = [];
  const lanceur: Lanceur = async (_exe, args, entree, cwd) => {
    appels.push({ args, entree, cwd });
    return { code, stdout, stderr, delaiDepasse: false };
  };
  return { lanceur, appels };
}

const REPONSE_OK = JSON.stringify({
  is_error: false,
  stop_reason: "end_turn",
  result: "{}",
  structured_output: { a: "b" },
  total_cost_usd: 0.0123,
  usage: { input_tokens: 2, cache_creation_input_tokens: 1000, cache_read_input_tokens: 500, output_tokens: 80 },
});

describe("construireArguments", () => {
  it("isole l'appel : sans outil, sans réglage utilisateur, sans session, sans commande personnalisée", () => {
    const args = construireArguments("Système.", SCHEMA);
    const apres = (option: string) => args[args.indexOf(option) + 1];
    expect(args).toContain("-p");
    expect(apres("--tools")).toBe("");
    expect(apres("--setting-sources")).toBe("");
    expect(args).toContain("--no-session-persistence");
    expect(args).toContain("--disable-slash-commands");
    expect(args).toContain("--strict-mcp-config");
    expect(apres("--output-format")).toBe("json");
    expect(JSON.parse(apres("--json-schema"))).toEqual(SCHEMA);
    expect(apres("--system-prompt")).toBe("Système.");
    expect(args).not.toContain("--bare"); // --bare exige une clé API : incompatible avec l'abonnement
  });

  it("fixe le modèle et l'effort, modifiables", () => {
    expect(construireArguments("s", SCHEMA)).toEqual(expect.arrayContaining(["--model", "claude-sonnet-5", "--effort", "low"]));
    expect(construireArguments("s", SCHEMA, { modele: "autre", effort: "high" })).toEqual(expect.arrayContaining(["--model", "autre", "--effort", "high"]));
  });
});

describe("appelerClaudeCli", () => {
  it("renvoie la sortie structurée, le coût de référence et les jetons, et passe le prompt par l'entrée standard", async () => {
    const { lanceur, appels } = lanceurQuiRepond(REPONSE_OK);
    const sortie = await appelerClaudeCli("Mon prompt", "Système", SCHEMA, { lanceur });
    expect(sortie.structure).toEqual({ a: "b" });
    expect(sortie.coutReferenceUsd).toBeCloseTo(0.0123);
    expect(sortie.jetonsEntree).toBe(1502);
    expect(sortie.jetonsSortie).toBe(80);
    expect(appels[0].entree).toBe("Mon prompt");
    expect(appels[0].cwd).not.toContain("citoyen2027\\src"); // dossier neutre, hors du projet
  });

  it("traite un abonnement épuisé comme une panne à ne pas réessayer", async () => {
    const { lanceur } = lanceurQuiRepond(JSON.stringify({ is_error: true, result: "Claude usage limit reached. Your limit will reset at 3pm." }), 1);
    await expect(appelerClaudeCli("p", "s", SCHEMA, { lanceur })).rejects.toBeInstanceOf(PanneCli);
  });

  it("traite la limite de 5 heures de l'abonnement comme une panne (message du 2026-11-07)", async () => {
    const { lanceur } = lanceurQuiRepond(JSON.stringify({ is_error: true, result: "You've hit your 5-hour limit · resets 9:40pm (Europe/Paris)" }), 1);
    await expect(appelerClaudeCli("p", "s", SCHEMA, { lanceur })).rejects.toBeInstanceOf(PanneCli);
  });

  it("traite un compte non connecté comme une panne", async () => {
    const { lanceur } = lanceurQuiRepond("", 1, "Not logged in · Please run /login");
    await expect(appelerClaudeCli("p", "s", SCHEMA, { lanceur })).rejects.toBeInstanceOf(PanneCli);
  });

  it("traite une commande introuvable comme une panne, avec le moyen d'y remédier", async () => {
    const lanceur: Lanceur = async () => {
      throw new Error("spawn claude ENOENT");
    };
    await expect(appelerClaudeCli("p", "s", SCHEMA, { lanceur })).rejects.toThrow("CLAUDE_CLI_CHEMIN");
  });

  it("refuse une sortie sans structure plutôt que de deviner", async () => {
    const { lanceur } = lanceurQuiRepond(JSON.stringify({ is_error: false, stop_reason: "max_tokens", result: "texte" }));
    await expect(appelerClaudeCli("p", "s", SCHEMA, { lanceur })).rejects.toThrow("sortie structurée");
  });

  it("signale une sortie illisible et un délai dépassé sans les confondre avec une panne", async () => {
    const illisible = lanceurQuiRepond("pas du json");
    await expect(appelerClaudeCli("p", "s", SCHEMA, { lanceur: illisible.lanceur })).rejects.toThrow("illisible");
    const lent: Lanceur = async () => ({ code: null, stdout: "", stderr: "", delaiDepasse: true });
    const erreur = await appelerClaudeCli("p", "s", SCHEMA, { lanceur: lent, timeoutMs: 1000 }).catch((e) => e);
    expect(erreur).toBeInstanceOf(Error);
    expect(erreur).not.toBeInstanceOf(PanneCli);
    expect(erreur.message).toContain("n'a pas répondu");
  });

  it("signale une erreur applicative de la commande, sans la prendre pour une panne de compte", async () => {
    const { lanceur } = lanceurQuiRepond(JSON.stringify({ is_error: true, result: "Schéma refusé" }), 1);
    const erreur = await appelerClaudeCli("p", "s", SCHEMA, { lanceur }).catch((e) => e);
    expect(erreur).not.toBeInstanceOf(PanneCli);
    expect(erreur.message).toContain("Schéma refusé");
  });
});
