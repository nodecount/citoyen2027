import type { CandidatMeta, Proposition } from "../types";
import { genererPropositions, type ClientAnthropicMinimal } from "./generate";
import { verifier } from "./verify";
import type { FetchImpl } from "./checks";
import {
  chargerAVerifier,
  enregistrerAVerifier,
  enregistrerPropositions,
  type EntreeAVerifier,
} from "./depot";

export interface CombinaisonACouvrir {
  slug: string;
  themeId: string;
  themeLibelle: string;
}

export interface OptionsExecution {
  racine?: string;
  fetchImpl?: FetchImpl;
  force?: boolean;
}

export function genererIdProposition(slug: string, themeId: string, index: number): string {
  return `${slug}-${themeId}-${String(index).padStart(3, "0")}`;
}

export interface ResultatCombinaison {
  fusionnees: Proposition[];
  enAttente: EntreeAVerifier[];
}

export async function executerCombinaison(
  client: ClientAnthropicMinimal,
  meta: CandidatMeta,
  combinaison: CombinaisonACouvrir,
  propositionsExistantes: Proposition[],
  options: OptionsExecution = {},
): Promise<ResultatCombinaison> {
  const titresExistants = propositionsExistantes.map((p) => p.titre);
  const generees = await genererPropositions(
    client,
    meta,
    combinaison.themeId,
    combinaison.themeLibelle,
    titresExistants,
  );
  const verdicts = await verifier(client, meta, generees, options.fetchImpl);

  const fusionnees: Proposition[] = [];
  const enAttente: EntreeAVerifier[] = [];
  let indexSuivant = propositionsExistantes.length + 1;

  for (const proposition of generees) {
    const verdict = verdicts.get(proposition.titre);
    if (verdict?.statut === "PASS") {
      fusionnees.push({
        ...proposition,
        id: genererIdProposition(meta.slug, combinaison.themeId, indexSuivant),
        candidat: meta.slug,
        theme: combinaison.themeId,
      });
      indexSuivant += 1;
    } else {
      enAttente.push({
        theme: combinaison.themeId,
        proposition,
        raison: verdict?.statut === "FAIL" ? verdict.raison : "Aucun verdict reçu",
      });
    }
  }

  if (fusionnees.length > 0) {
    enregistrerPropositions(meta.slug, [...propositionsExistantes, ...fusionnees], options.racine);
  }
  if (enAttente.length > 0) {
    const existantes = chargerAVerifier(meta.slug, options.racine);
    enregistrerAVerifier(meta.slug, [...existantes, ...enAttente], options.racine);
  }

  return { fusionnees, enAttente };
}
