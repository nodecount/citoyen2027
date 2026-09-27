import type { Ecran } from "./router";

// Pied de page présent sur tout le site : la marque, les pages, et une ligne sur l'indépendance. Le détail (sources,
// confidentialité, crédits photos) est sur la page À propos : on y renvoie, on ne le répète pas.
export function PiedDePage({ onNaviguer }: { onNaviguer: (ecran: Ecran) => void }) {
  const lien = (cible: Ecran, libelle: string) => (
    <li>
      <button type="button" className="lien-menu" onClick={() => onNaviguer(cible)}>
        {libelle}
      </button>
    </li>
  );
  return (
    <footer className="pied-de-page">
      <span className="marque">
        Citoyen 2027
      </span>
      <nav aria-label="Pied de page">
        <ul>
          {lien("accueil", "Accueil")}
          {lien("themes", "Thèmes")}
          {lien("a-propos", "À propos")}
        </ul>
      </nav>
      <p>Outil citoyen indépendant, sans lien avec un parti ou un candidat.</p>
    </footer>
  );
}
