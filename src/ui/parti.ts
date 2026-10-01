// Parti à afficher à côté du nom d'un candidat : rien quand il est inconnu (champ vide, « non renseigné par la source ») ou
// masqué (simulateur à l'aveugle : la méta anonyme n'en porte aucun).
export function partiAffichable(parti: string | undefined | null): string | null {
  const texte = (parti ?? "").trim();
  return texte === "" || /^non renseign/i.test(texte) ? null : texte;
}
