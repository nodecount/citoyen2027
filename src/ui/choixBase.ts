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

// Le choix de base vit dans le navigateur (localStorage), jamais dans l'adresse. Priorité : ancien lien portant encore
// ?base=… (retenu une fois, puis retiré de l'adresse) > dernier choix mémorisé > base par défaut.
export function baseInitiale(bases: InfoBase[]): InfoBase {
  const dansAdresse = new URLSearchParams(window.location.search).get("base");
  if (dansAdresse !== null) {
    const base = resoudreBase(dansAdresse, bases);
    memoriser(base.id);
    retirerBaseDeLAdresse();
    return base;
  }
  return resoudreBase(lireMemorise(), bases);
}

export function retenirBase(id: string): void {
  memoriser(id);
}

function retirerBaseDeLAdresse(): void {
  try {
    const adresse = new URL(window.location.href);
    adresse.searchParams.delete("base");
    window.history.replaceState(null, "", adresse);
  } catch {
    // adresse non modifiable : sans conséquence
  }
}