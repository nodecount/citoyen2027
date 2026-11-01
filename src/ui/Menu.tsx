import { useCallback, useState } from "react";
import { Database, Menu as Menu_, X } from "lucide-react";
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

// Barre de navigation présente sur tout le site : Accueil, Simulateur, et une icône qui ouvre le choix de la base de
// connaissances dans une modale (seulement s'il y a plusieurs bases). Le nom de la base active reste visible.
export function Menu({ ecran, onNaviguer, bases, baseActive, onChoisirBase }: MenuProps) {
  const [modaleOuverte, setModaleOuverte] = useState(false);
  const fermer = useCallback(() => setModaleOuverte(false), []);
  const courante = bases.find((b) => b.id === baseActive);
  // Le formulaire général fait partie du parcours « Simulateur » : c'est cet onglet qui reste marqué.
  const onglet = ecran === "questions-generales" ? "simulateur" : ecran;
  // Sur écran étroit, les liens sont repliés derrière un bouton « burger » ; sur grand écran il est caché et les liens restent visibles.
  const [burgerOuvert, setBurgerOuvert] = useState(false);

  const lien = (cible: "accueil" | "exploration" | "simulateur" | "a-propos", libelle: string) => (
    <button
      type="button"
      className={onglet === cible ? "lien-menu lien-menu--actif" : "lien-menu"}
      aria-current={onglet === cible ? "page" : undefined}
      onClick={() => {
        setBurgerOuvert(false);
        onNaviguer(cible);
      }}
    >
      {libelle}
    </button>
  );

  return (
    <header className="menu">
      <span className="marque">
        Citoyen 2027
      </span>
      <button
        type="button"
        className="menu-burger"
        aria-expanded={burgerOuvert}
        aria-controls="navigation-principale"
        aria-label={burgerOuvert ? "Fermer le menu" : "Ouvrir le menu"}
        onClick={() => setBurgerOuvert((o) => !o)}
      >
        {burgerOuvert ? <X size={22} aria-hidden="true" /> : <Menu_ size={22} aria-hidden="true" />}
      </button>
      <nav id="navigation-principale" aria-label="Navigation principale" className={burgerOuvert ? "menu-nav menu-nav--ouvert" : "menu-nav"}>
        {lien("accueil", "Accueil")}
        {lien("exploration", "Exploration")}
        {lien("simulateur", "Simulateur")}
        {lien("a-propos", "À propos")}
      </nav>
      {bases.length > 1 && courante && (
        <>
          <button
            type="button"
            className="bouton-base"
            aria-haspopup="dialog"
            title="Voir les sources de données"
            onClick={() => setModaleOuverte(true)}
          >
            <Database size={18} aria-hidden="true" />
            <span>Base de connaissances</span>
          </button>
          <ModaleBase ouverte={modaleOuverte} bases={bases}
            onControle={(id, cible) => {
              onChoisirBase(id);
              onNaviguer(cible);
            }}
            onFermer={fermer}
          />
        </>
      )}
    </header>
  );
}
