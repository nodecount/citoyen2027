import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Appel du modèle par la commande `claude -p` (Claude Code en mode non interactif) plutôt que par l'API payante :
// l'usage est décompté de l'abonnement, pas du crédit API. Le coût affiché par la commande est un coût de RÉFÉRENCE
// au tarif public, utile pour comparer et plafonner, pas une facture.
//
// Isolation : la commande est lancée depuis un dossier neutre (aucun CLAUDE.md à remonter), sans outil, sans réglage
// utilisateur (donc sans hooks ni extensions), sans session enregistrée et sans commande personnalisée. Le modèle ne voit
// que le prompt que nous lui donnons. (`--bare` isolerait mieux encore, mais il exige une clé API : incompatible avec
// l'abonnement.)

export const MODELE_CLI = "claude-sonnet-5";

export interface SortieCli {
  structure: unknown;
  coutReferenceUsd: number;
  dureeMs: number;
  jetonsEntree: number;
  jetonsSortie: number;
  brut: string;
}

export interface OptionsCli {
  modele?: string;
  effort?: "low" | "medium" | "high";
  timeoutMs?: number;
  lanceur?: Lanceur;
}

export type Lanceur = (
  executable: string,
  args: string[],
  entree: string,
  cwd: string,
  timeoutMs: number,
) => Promise<{ code: number | null; stdout: string; stderr: string; delaiDepasse: boolean }>;

// Panne qui se reproduira à l'identique à tous les appels suivants (abonnement épuisé, non connecté, commande absente) :
// il faut s'arrêter, pas insister.
export class PanneCli extends Error {}

export function cheminExecutable(): string {
  if (process.env.CLAUDE_CLI_CHEMIN) return process.env.CLAUDE_CLI_CHEMIN;
  if (process.env.APPDATA) {
    const npmGlobal = join(process.env.APPDATA, "npm", "node_modules", "@anthropic-ai", "claude-code", "bin", "claude.exe");
    if (existsSync(npmGlobal)) return npmGlobal;
  }
  return "claude";
}

export function dossierNeutre(): string {
  const dossier = join(tmpdir(), "citoyen2027-claude-neutre");
  mkdirSync(dossier, { recursive: true });
  return dossier;
}

export function construireArguments(systeme: string, schema: object, options: OptionsCli = {}): string[] {
  return [
    "-p",
    "--model", options.modele ?? MODELE_CLI,
    "--effort", options.effort ?? "low",
    "--tools", "",
    "--setting-sources", "",
    "--no-session-persistence",
    "--disable-slash-commands",
    "--strict-mcp-config",
    "--output-format", "json",
    "--json-schema", JSON.stringify(schema),
    "--system-prompt", systeme,
  ];
}

const lanceurReel: Lanceur = (executable, args, entree, cwd, timeoutMs) =>
  new Promise((resolve, reject) => {
    const enfant = spawn(executable, args, { cwd, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    let stdout = "";
    let stderr = "";
    let delaiDepasse = false;
    const minuteur = setTimeout(() => {
      delaiDepasse = true;
      enfant.kill();
    }, timeoutMs);
    enfant.stdout.setEncoding("utf8").on("data", (morceau: string) => (stdout += morceau));
    enfant.stderr.setEncoding("utf8").on("data", (morceau: string) => (stderr += morceau));
    enfant.on("error", (erreur) => {
      clearTimeout(minuteur);
      reject(erreur);
    });
    enfant.on("close", (code) => {
      clearTimeout(minuteur);
      resolve({ code, stdout, stderr, delaiDepasse });
    });
    enfant.stdin.on("error", () => {}); // processus déjà terminé : la fermeture ci-dessus rapportera l'erreur
    enfant.stdin.end(entree);
  });

const MOTIFS_PANNE = /usage limit|limit reached|hit your [\w-]* ?limit|rate limit|not logged in|please run \/login|invalid api key|authentication|credit balance|overloaded_error/i;

// Panne d'abonnement ou de commande → PanneCli (à ne pas réessayer) ; autre incident → Error (l'appelant peut réessayer).
export async function appelerClaudeCli(prompt: string, systeme: string, schema: object, options: OptionsCli = {}): Promise<SortieCli> {
  const lanceur = options.lanceur ?? lanceurReel;
  const args = construireArguments(systeme, schema, options);
  const timeoutMs = options.timeoutMs ?? 300_000;
  const debut = Date.now();

  let sortie;
  try {
    sortie = await lanceur(cheminExecutable(), args, prompt, dossierNeutre(), timeoutMs);
  } catch (erreur) {
    throw new PanneCli(`Impossible de lancer la commande claude (${erreur instanceof Error ? erreur.message : String(erreur)}). Renseigner CLAUDE_CLI_CHEMIN si elle n'est pas dans le PATH.`);
  }
  if (sortie.delaiDepasse) throw new Error(`La commande claude n'a pas répondu en ${Math.round(timeoutMs / 1000)} s.`);

  let json: Record<string, unknown> | undefined;
  try {
    json = JSON.parse(sortie.stdout) as Record<string, unknown>;
  } catch {
    // stdout illisible : on regarde s'il s'agit d'une panne connue avant de conclure à un simple incident
  }
  const texteErreur = `${typeof json?.result === "string" ? json.result : ""} ${sortie.stderr} ${json ? "" : sortie.stdout}`;
  if (MOTIFS_PANNE.test(texteErreur) && (sortie.code !== 0 || json?.is_error === true)) {
    throw new PanneCli(`La commande claude signale un problème de compte : ${texteErreur.trim().slice(0, 300)}`);
  }
  if (!json) throw new Error(`Sortie de claude illisible (code ${sortie.code}) : « ${sortie.stdout.slice(0, 200)} » ${sortie.stderr.slice(0, 200)}`);
  if (json.is_error === true || sortie.code !== 0) {
    throw new Error(`claude a échoué (code ${sortie.code}) : ${typeof json.result === "string" ? json.result.slice(0, 300) : sortie.stderr.slice(0, 300)}`);
  }
  if (json.structured_output === undefined || json.structured_output === null) {
    throw new Error(`Pas de sortie structurée dans la réponse (arrêt : ${String(json.stop_reason)}) : « ${String(json.result ?? "").slice(0, 200)} »`);
  }

  const usage = (json.usage ?? {}) as Record<string, number>;
  return {
    structure: json.structured_output,
    coutReferenceUsd: typeof json.total_cost_usd === "number" ? json.total_cost_usd : 0,
    dureeMs: Date.now() - debut,
    jetonsEntree: (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0),
    jetonsSortie: usage.output_tokens ?? 0,
    brut: sortie.stdout,
  };
}
