export type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;

export async function verifierUrlDisponible(url: string, fetchImpl: FetchImpl = fetch): Promise<boolean> {
  try {
    const reponse = await fetchImpl(url, { method: "GET" });
    return reponse.ok;
  } catch {
    return false;
  }
}

export function verifierDomaineAutorise(url: string, domaines: string[]): boolean {
  try {
    const hote = new URL(url).hostname;
    return domaines.some((domaine) => hote === domaine || hote.endsWith(`.${domaine}`));
  } catch {
    return false;
  }
}

function extraireChiffres(texte: string): string[] {
  return texte.match(/\d[\d\s.,]*\d|\d/g) ?? [];
}

function normaliserChiffre(chiffre: string): string {
  return chiffre.replace(/[\s.,]/g, "");
}

export function verifierChiffresPresents(hypothesesCalcul: string, texteFetched: string): boolean {
  const chiffres = extraireChiffres(hypothesesCalcul);
  if (chiffres.length === 0) return true;
  const texteNormalise = normaliserChiffre(texteFetched);
  return chiffres.every((chiffre) => texteNormalise.includes(normaliserChiffre(chiffre)));
}

export function normaliserPourComparaison(texte: string): string {
  return texte
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&(rsquo|#8217|#39|apos);/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// L'extrait cité pour fonder un effet doit apparaître dans la page source : sinon le modèle a
// paraphrasé ou inventé. Comparaison tolérante (balises, casse, accents, ponctuation) mais stricte
// sur les mots. Un extrait vide ne prouve rien.
export function verifierExtraitPresent(extrait: string, texteSource: string): boolean {
  const cible = normaliserPourComparaison(extrait);
  if (cible.length === 0) return false;
  return normaliserPourComparaison(texteSource).includes(cible);
}
