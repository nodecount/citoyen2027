import type Anthropic from "@anthropic-ai/sdk";
import type { ClientAnthropicMinimal, ReponseAnthropicMinimale, RequeteGeneration } from "./generate";

// Réception en flux : une requête longue avec outils web reste silencieuse pendant des minutes si on
// attend la réponse d'un bloc, ce qui la rend fragile face à toute coupure de connexion (premier essai
// sur Retailleau : coupé à 5 min 7 s, sans aucune réponse). Le flux garde la connexion active et
// permet d'afficher la progression en direct — outil lancé, page lue ou refusée, rédaction, arrêt.

interface EvenementFlux {
  type: string;
  message?: { usage?: { input_tokens?: number } };
  content_block?: { type?: string; name?: string; content?: unknown };
  delta?: { stop_reason?: string | null; type?: string; text?: string };
  usage?: { output_tokens?: number };
}

function horodatage(dureeMs: number): string {
  return `[flux +${Math.round(dureeMs / 1000)} s]`;
}

// Une ligne pour les événements utiles au suivi, null pour le reste (deltas de texte, fins de bloc…).
export function decrireEvenementFlux(evenement: EvenementFlux, dureeMs: number): string | null {
  const t = horodatage(dureeMs);
  if (evenement.type === "message_start") {
    return `${t} démarré · entrée ${evenement.message?.usage?.input_tokens ?? "?"} jetons`;
  }
  if (evenement.type === "content_block_start") {
    const bloc = evenement.content_block;
    if (bloc?.type === "server_tool_use") return `${t} outil lancé : ${bloc.name ?? "outil"}`;
    if (bloc?.type === "text") return `${t} rédaction de la réponse`;
    if (bloc?.type?.endsWith("_tool_result")) {
      const contenu = bloc.content as Record<string, unknown> | null | undefined;
      if (contenu && typeof contenu === "object" && "error_code" in contenu) {
        return `${t} résultat ${bloc.type} : ÉCHEC ${String(contenu.error_code)}`;
      }
      return `${t} résultat ${bloc.type} : ok`;
    }
    return null;
  }
  if (evenement.type === "message_delta" && evenement.delta?.stop_reason) {
    return `${t} arrêt annoncé : ${evenement.delta.stop_reason} · sortie ${evenement.usage?.output_tokens ?? "?"} jetons`;
  }
  return null;
}

// Adapte le SDK à l'interface minimale du pipeline : même `create`, mais reçu en flux. Les tests
// continuent d'utiliser de simples faux clients ; seul ce point d'entrée réel diffuse.
export function clientEnFlux(sdk: Anthropic, journal: (ligne: string) => void = console.log): ClientAnthropicMinimal {
  return {
    messages: {
      async create(requete: RequeteGeneration, options?: { timeout?: number; maxRetries?: number }) {
        const debut = Date.now();
        const flux = sdk.messages.stream(requete as never, options);
        flux.on("streamEvent", (evenement: unknown) => {
          const ligne = decrireEvenementFlux(evenement as EvenementFlux, Date.now() - debut);
          if (ligne) journal(ligne);
        });
        return (await flux.finalMessage()) as unknown as ReponseAnthropicMinimale;
      },
    },
  };
}
