import type { CandidatMeta } from "../types";

export function domainesAutorises(meta: CandidatMeta): string[] {
  const domaines = new Set<string>();
  for (const source of meta.sources_officielles) {
    try {
      domaines.add(new URL(source.url).hostname);
    } catch {
      // URL invalide dans les données existantes : ignorée plutôt que d'interrompre le lot
    }
  }
  return Array.from(domaines);
}
