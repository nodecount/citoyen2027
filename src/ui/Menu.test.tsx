import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { InfoBase } from "../data/bases";
import { Menu } from "./Menu";

const UNE_BASE: InfoBase[] = [{ id: "a", libelle: "A", description: "", avertissement: "" }];
const DEUX_BASES: InfoBase[] = [...UNE_BASE, { id: "b", libelle: "B", description: "", avertissement: "" }];

function rendre(ecran: "accueil" | "themes", bases = DEUX_BASES) {
  return renderToStaticMarkup(<Menu ecran={ecran} onNaviguer={() => {}} bases={bases} baseActive="a" onChoisirBase={() => {}} />);
}

describe("Menu", () => {
  it("propose Accueil et Thèmes, et marque l'écran actif", () => {
    const surAccueil = rendre("accueil");
    expect(surAccueil).toContain(">Accueil<");
    expect(surAccueil).toContain(">Thèmes<");
    expect(surAccueil).toMatch(/lien-menu--actif"[^>]*aria-current="page"[^>]*>\s*Accueil/);
    expect(rendre("themes")).toMatch(/lien-menu--actif"[^>]*aria-current="page"[^>]*>\s*Thèmes/);
  });

  it("affiche le sélecteur de base quand il y a plusieurs bases, pas quand il n'y en a qu'une", () => {
    expect(rendre("accueil", DEUX_BASES)).toContain("selecteur-base");
    expect(rendre("accueil", UNE_BASE)).not.toContain("selecteur-base");
  });
});
