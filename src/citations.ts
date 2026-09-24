import type { Source } from "./types";

// Format de citation acté (CLAUDE.md) : « <nom de la source> · <année> », cliquable, discret, en fin
// du texte de synthèse. `nom` et `annee` sont des champs structurés de la source — jamais rédigés
// par le modèle dans le texte. Les sources antérieures aux champs nom/annee gardent leur label.
export function libelleCitation(source: Source): string {
  if (source.nom && typeof source.annee === "number") {
    return `${source.nom} · ${source.annee}`;
  }
  return source.label;
}

export interface SourceCitee {
  texte: string;
  url: string;
}

// Sources d'une synthèse : celles des propositions utilisées, dédoublonnées par URL, dans l'ordre de
// première apparition (aucun tri : aucun ordre implicite favorable à une source).
export function sourcesCitees(propositions: Array<{ sources: Source[] }>): SourceCitee[] {
  const vues = new Set<string>();
  const citees: SourceCitee[] = [];
  for (const proposition of propositions) {
    for (const source of proposition.sources) {
      if (vues.has(source.url)) continue;
      vues.add(source.url);
      citees.push({ texte: libelleCitation(source), url: source.url });
    }
  }
  return citees;
}
