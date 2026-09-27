import type { InfoBase } from "../data/bases";
import { SelecteurBase } from "./SelecteurBase";

export type Ecran = "accueil" | "themes";

interface MenuProps {
  ecran: Ecran;
  onNaviguer: (ecran: Ecran) => void;
  bases: InfoBase[];
  baseActive: string;
  onChoisirBase: (id: string) => void;
}

// Barre de navigation présente sur tout le site : accueil, thèmes, et le choix de base (visible seulement s'il y a
// plusieurs bases). Un menu simple, sans routeur : l'écran actif est un état de l'application, pas une adresse.
export function Menu({ ecran, onNaviguer, bases, baseActive, onChoisirBase }: MenuProps) {
  return (
    <header className="menu">
      <nav aria-label="Navigation principale">
        <button type="button" className={ecran === "accueil" ? "lien-menu lien-menu--actif" : "lien-menu"} aria-current={ecran === "accueil" ? "page" : undefined} onClick={() => onNaviguer("accueil")}>
          Accueil
        </button>
        <button type="button" className={ecran === "themes" ? "lien-menu lien-menu--actif" : "lien-menu"} aria-current={ecran === "themes" ? "page" : undefined} onClick={() => onNaviguer("themes")}>
          Thèmes
        </button>
      </nav>
      <SelecteurBase bases={bases} actif={baseActive} onChoisir={onChoisirBase} />
    </header>
  );
}
