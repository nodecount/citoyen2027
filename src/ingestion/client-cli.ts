import { appelerClaudeCli, type OptionsCli } from "../scraping/claude-cli";
import type { ClientAnthropicMinimal, RequeteGeneration } from "./generate";

// Client du pipeline branché sur la commande `claude -p` (abonnement) plutôt que sur l'API payante. Il implémente la
// même interface que le SDK : extraction, relecture et synthèse, qui n'utilisent aucun outil et renvoient du JSON
// contraint par un schéma, passent donc sans autre changement.
//
// Différences avec l'API, à garder en tête :
// - `max_tokens` n'est pas réglable : une sortie tronquée se manifeste par une sortie structurée absente (erreur),
//   jamais par un JSON partiel pris pour complet ;
// - le cache de prompt (`cache_control`) est géré par la commande elle-même ;
// - pas d'outil web : une requête qui en demande est refusée (seul le mode « corpus » est pris en charge).

// Longueur maximale du prompt système passé en argument : la ligne de commande Windows est limitée (~32 000 caractères).
// Au-delà, le système est placé en tête du message (entrée standard), sans limite.
const LIMITE_SYSTEME_ARGUMENT = 20_000;

export class LimiteAppelsAtteinte extends Error {}

// La sortie structurée de `claude -p` laisse parfois des balises de fermeture en fin de chaîne (« …texte.</texte></invoke> »),
// un résidu de format et non du contenu. On ne retire que des balises FERMANTES collées à la FIN d'une chaîne ; tout le
// reste passe tel quel, et les contrôles en aval (synthese.ts) refusent encore toute balise restante.
export function retirerBalisesParasites<T>(valeur: T): T {
  if (typeof valeur === "string") return valeur.replace(/(\s*<\/[A-Za-z_][\w-]*>)+\s*$/, "") as unknown as T;
  if (Array.isArray(valeur)) return valeur.map(retirerBalisesParasites) as unknown as T;
  if (valeur !== null && typeof valeur === "object") {
    return Object.fromEntries(Object.entries(valeur).map(([k, v]) => [k, retirerBalisesParasites(v)])) as T;
  }
  return valeur;
}

export interface OptionsClientCli {
  // Plafond du nombre d'appels de ce run : l'abonnement n'a pas de solde en euros à décompter, mais des fenêtres de quota.
  maxAppels?: number;
  modele?: string;
  timeoutMs?: number;
  lanceur?: OptionsCli["lanceur"];
}

function texteDesMessages(requete: RequeteGeneration): string {
  return requete.messages
    .map((m) => (typeof m.content === "string" ? m.content : m.content.map((b) => b.text ?? "").join("\n\n")))
    .join("\n\n");
}

export function clientCli(options: OptionsClientCli = {}): ClientAnthropicMinimal & { appels: () => number; coutReferenceUsd: () => number } {
  let appels = 0;
  let cout = 0;
  return {
    appels: () => appels,
    coutReferenceUsd: () => cout,
    messages: {
      async create(requete, opts) {
        if (requete.tools.length > 0) {
          throw new Error("Le moteur « cli » ne gère pas les outils web : utiliser le mode « corpus ».");
        }
        const format = requete.output_config.format as { type?: string; schema?: object } | undefined;
        if (format?.type !== "json_schema" || !format.schema) {
          throw new Error("Le moteur « cli » exige une sortie JSON contrainte par un schéma (output_config.format).");
        }
        if (options.maxAppels !== undefined && appels >= options.maxAppels) {
          throw new LimiteAppelsAtteinte(`Plafond de ${options.maxAppels} appel(s) atteint pour ce run : relancer la même commande pour reprendre.`);
        }
        appels += 1;

        let systeme = requete.system;
        let prompt = texteDesMessages(requete);
        if (systeme.length > LIMITE_SYSTEME_ARGUMENT) {
          prompt = `${systeme}\n\n---\n\n${prompt}`;
          systeme = "Suis strictement les instructions qui ouvrent le message de l'utilisateur.";
        }
        const effort = requete.output_config.effort;
        // La commande n'accepte qu'un objet à la racine du schéma : un tableau est enveloppé puis déballé.
        const enveloppe = (format.schema as { type?: string }).type === "array";
        const schema = enveloppe
          ? { type: "object", properties: { resultat: format.schema }, required: ["resultat"], additionalProperties: false }
          : format.schema;
        const sortie = await appelerClaudeCli(prompt, systeme, schema, {
          modele: options.modele,
          effort: effort === "low" || effort === "medium" || effort === "high" ? effort : "medium",
          timeoutMs: opts?.timeout ?? options.timeoutMs,
          lanceur: options.lanceur,
        });
        cout += sortie.coutReferenceUsd;
        const structure = retirerBalisesParasites(enveloppe ? (sortie.structure as { resultat?: unknown }).resultat : sortie.structure);
        if (structure === undefined) throw new Error("Sortie structurée sans le champ « resultat » attendu.");
        return {
          content: [{ type: "text", text: JSON.stringify(structure) }],
          stop_reason: "end_turn",
          usage: { input_tokens: sortie.jetonsEntree, output_tokens: sortie.jetonsSortie },
        };
      },
    },
  };
}
