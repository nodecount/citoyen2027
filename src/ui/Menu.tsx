import { useCallback, useState } from "react";
import { Database } from "lucide-react";
import type { InfoBase } from "../data/bases";
import { ModaleBase } from "./ModaleBase";
import type { Ecran } from "./router";

interface MenuProps {
  ecran: Ecran;
  onNaviguer: (ecran: Ecran) => void;
  bases: InfoBase[];
  baseActive: string;
  onChoisirBase: (id: string) => void;
}

// Barre de navigation présente sur tout le site : Accueil, Thèmes, et une icône qui ouvre le choix de la base de
// connaissances dans une modale (seulement s'il y a plusieurs bases). Le nom de la base active reste visible.
export function Menu({ ecran, onNaviguer, bases, baseActive, onChoisirBase }: MenuProps) {
  const [modaleOuverte, setModaleOuverte] = useState(false);
  const fermer = useCallback(() => setModaleOuverte(false), []);
  const courante = bases.find((b) => b.id === baseActive);
  // Le formulaire général fait partie du parcours « Thèmes » : c'est cet onglet qui reste marqué.
  const onglet = ecran === "questions-generales" ? "themes" : ecran;

  const lien = (cible: "accueil" | "themes" | "a-propos", libelle: string) => (
    <button
      type="button"
      className={onglet === cible ? "lien-menu lien-menu--actif" : "lien-menu"}
      aria-current={onglet === cible ? "page" : undefined}
      onClick={() => onNaviguer(cible)}
    >
      {libelle}
    </button>
  );

  return (
    <header className="menu">
      <span className="marque">
        Citoyen 2027
      </span>
      <nav aria-label="Navigation principale">
        {lien("accueil", "Accueil")}
        {lien("themes", "Thèmes")}
        {lien("a-propos", "À propos")}
      </nav>
      {bases.length > 1 && courante && (
        <>
          <button
            type="button"
            className="bouton-base"
            aria-haspopup="dialog"
            aria-label={`Base de connaissances : ${courante.libelle}. Changer`}
            title="Changer de base de connaissances"
            onClick={() => setModaleOuverte(true)}
          >
            <Database size={18} aria-hidden="true" />
            <span>{courante.libelle}</span>
          </button>
          <ModaleBase ouverte={modaleOuverte} bases={bases} actif={baseActive} onChoisir={onChoisirBase} onFermer={fermer} />
        </>
      )}
    </header>
  );
}
