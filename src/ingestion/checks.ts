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
    return domaines.includes(new URL(url).hostname);
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
