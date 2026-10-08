// Verdicts du porteur du projet sur les tests de situations : « le candidat désigné correspond-il à ce qu'attendrait cet
// électorat ? ». Gardés dans le navigateur (jamais envoyés), un par couple base × électorat : chaque source a son propre découpage.

export type Verdict = "conforme" | "a-revoir";
export interface VerdictNote {
  verdict: Verdict | "";
  note: string;
}

const CLE = "verdicts-tests-situations";
export const cleVerdict = (baseId: string, electoratId: string) => `${baseId}:${electoratId}`;

export function lireVerdicts(): Record<string, VerdictNote> {
  try {
    const brut = JSON.parse(window.localStorage.getItem(CLE) ?? "{}") as Record<string, Partial<VerdictNote>>;
    const sortie: Record<string, VerdictNote> = {};
    for (const [cle, v] of Object.entries(brut)) {
      if (v && typeof v === "object") sortie[cle] = { verdict: v.verdict === "conforme" || v.verdict === "a-revoir" ? v.verdict : "", note: typeof v.note === "string" ? v.note : "" };
    }
    return sortie;
  } catch {
    return {};
  }
}

export function memoriserVerdicts(verdicts: Record<string, VerdictNote>): void {
  try {
    window.localStorage.setItem(CLE, JSON.stringify(verdicts));
  } catch {
    // sans conséquence : les verdicts valent pour cette session seulement
  }
}
