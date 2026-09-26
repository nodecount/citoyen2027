// Pastille à initiales : le portrait d'un candidat en attendant des photos libres de droits. Volontairement neutre —
// une seule apparence pour tous, aucune couleur : une teinte par candidat évoquerait des couleurs de parti.
// « Marine Le Pen » → « MLP », « Jean-Luc Mélenchon » → « JM », « PARTI SOCIALISTE » → « PS ».
export function initiales(nom: string): string {
  const lettres = nom
    .split(/\s+/)
    .filter((mot) => mot.length > 0)
    .map((mot) => Array.from(mot)[0].toLocaleUpperCase("fr"));
  return lettres.slice(0, 3).join("");
}
