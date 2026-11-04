import bordsPolitiques from "../../data/bords-politiques.json";

// Parti à afficher à côté du nom d'un candidat : rien quand il est inconnu (champ vide, « non renseigné par la source ») ou
// masqué (simulateur à l'aveugle : la méta anonyme n'en porte aucun).
export function partiAffichable(parti: string | undefined | null): string | null {
  const texte = (parti ?? "").trim();
  return texte === "" || /^non renseign/i.test(texte) ? null : texte;
}

// Bord politique affiché à côté du badge de parti : seulement quand le parti l'est (en mode aveugle la méta anonyme n'a pas de
// parti, donc rien ne trahit le candidat) et quand un bord est renseigné pour lui (`data/bords-politiques.json`).
export function bordAffichable(slug: string | undefined | null, parti: string | undefined | null): string | null {
  if (!slug || !partiAffichable(parti)) return null;
  return (bordsPolitiques.bords as Record<string, string>)[slug] ?? null;
}
