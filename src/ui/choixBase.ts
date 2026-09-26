import { resoudreBase, type InfoBase } from "../data/bases";

const CLE_STOCKAGE = "base-active";

// Le stockage du navigateur peut être absent ou refusé (navigation privée, données bloquées) : jamais bloquant.
function lireMemorise(): string | null {
  try {
    return window.localStorage.getItem(CLE_STOCKAGE);
  } catch {
    return null;
  }
}

function memoriser(id: string): void {
  try {
    window.localStorage.setItem(CLE_STOCKAGE, id);
  } catch {
    // sans conséquence : le choix vaut pour cette session seulement
  }
}

// Priorité : adresse (?base=…, partageable) > dernier choix mémorisé > base par défaut.
export function baseInitiale(bases: InfoBase[]): InfoBase {
  const dansAdresse = new URLSearchParams(window.location.search).get("base");
  return resoudreBase(dansAdresse ?? lireMemorise(), bases);
}

export function retenirBase(id: string): void {
  memoriser(id);
  try {
    const adresse = new URL(window.location.href);
    adresse.searchParams.set("base", id);
    window.history.replaceState(null, "", adresse);
  } catch {
    // adresse non modifiable : le choix reste mémorisé
  }
}
