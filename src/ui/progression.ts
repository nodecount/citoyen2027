// Progression de la suggestion « candidat idéal » : la part de questions de situation et de sujets de convictions répondus,
// côtés confondus et sans pondération. Ce n'est PAS une fiabilité du résultat, seulement un décompte de réponses.
export interface Comptes {
  repondues: number;
  total: number;
}

export interface Progression extends Comptes {
  pourcent: number;
}

export function progression(situation: Comptes, convictions: Comptes): Progression {
  const repondues = situation.repondues + convictions.repondues;
  const total = situation.total + convictions.total;
  if (total <= 0 || repondues <= 0) return { repondues, total, pourcent: 0 };
  // Jamais 100 tant qu'il manque une réponse : un arrondi ne doit pas annoncer « complet » à tort.
  const arrondi = Math.round((repondues / total) * 100);
  return { repondues, total, pourcent: repondues < total ? Math.min(arrondi, 99) : 100 };
}

// D'où vient la suggestion : null tant qu'aucune réponse n'a été donnée.
export function sourceDeLaSuggestion(situation: Comptes, convictions: Comptes): "situation" | "convictions" | "les deux" | null {
  if (situation.repondues > 0 && convictions.repondues > 0) return "les deux";
  if (situation.repondues > 0) return "situation";
  if (convictions.repondues > 0) return "convictions";
  return null;
}

// Texte de la fenêtre de confirmation avant de lever le flou.
export function messageRevelation(situation: Comptes, convictions: Comptes): string {
  const p = progression(situation, convictions);
  const source = sourceDeLaSuggestion(situation, convictions);
  const cote = source === "situation" ? "côté situation seulement" : source === "convictions" ? "côté convictions seulement" : "situation et convictions";
  const reponses = `${p.repondues} réponse${p.repondues > 1 ? "s" : ""} sur ${p.total} question${p.total > 1 ? "s" : ""}`;
  return `Cette suggestion a ${p.pourcent} % de précision : ${reponses}, ${cote}. Elle pourra être revue si vous répondez à d'autres questions.`;
}
