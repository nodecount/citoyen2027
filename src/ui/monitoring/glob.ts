import type { CandidatMeta, Proposition } from "../../types";
import type { EntreeAVerifier } from "../../ingestion/depot";
import { extraireSlug } from "./couverture";

const metaModules = import.meta.glob("../../../data/programmes/*/meta.json", { eager: true }) as Record<
  string,
  { default: CandidatMeta }
>;
const propositionsModules = import.meta.glob("../../../data/programmes/*/propositions.json", {
  eager: true,
}) as Record<string, { default: Proposition[] }>;
const aVerifierModules = import.meta.glob("../../../data/programmes/*/_a-verifier.json", {
  eager: true,
}) as Record<string, { default: EntreeAVerifier[] }>;

function construireRecord<T>(modules: Record<string, { default: T }>): Record<string, T> {
  const resultat: Record<string, T> = {};
  for (const [chemin, module] of Object.entries(modules)) {
    resultat[extraireSlug(chemin)] = module.default;
  }
  return resultat;
}

export function construireDonneesCouverture(): {
  metas: Record<string, CandidatMeta>;
  propositions: Record<string, Proposition[]>;
  aVerifier: Record<string, EntreeAVerifier[]>;
} {
  return {
    metas: construireRecord(metaModules),
    propositions: construireRecord(propositionsModules),
    aVerifier: construireRecord(aVerifierModules),
  };
}
