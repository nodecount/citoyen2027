import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { InfoBase } from "../data/bases";
import { Menu } from "./Menu";
import type { Ecran } from "./router";

const UNE_BASE: InfoBase[] = [{ id: "a", libelle: "Base A", description: "", avertissement: "" }];
const DEUX_BASES: InfoBase[] = [...UNE_BASE, { id: "b", libelle: "Base B", description: "", avertissement: "" }];

function rendre(ecran: Ecran, bases = DEUX_BASES) {
  return renderToStaticMarkup(<Menu ecran={ecran} onNaviguer={() => {}} bases={bases} baseActive="a" onChoisirBase={() => {}} />);
}

describe("Menu", () => {
  it("propose Accueil, Simulateur et À propos, et marque l'onglet actif", () => {
    const html = rendre("accueil");
    for (const libelle of ["Accueil", "Simulateur", "À propos"]) expect(html).toContain(`>${libelle}<`);
    expect(html).toMatch(/lien-menu--actif"[^>]*aria-current="page"[^>]*>Accueil/);
    expect(rendre("a-propos")).toMatch(/lien-menu--actif"[^>]*aria-current="page"[^>]*>À propos/);
  });

  it("garde l'onglet Simulateur actif pendant le formulaire général (il fait partie du parcours)", () => {
    expect(rendre("questions-generales")).toMatch(/lien-menu--actif"[^>]*aria-current="page"[^>]*>Simulateur/);
  });

  it("change de base par une icône qui ouvre une modale, avec le nom de la base active visible", () => {
    const html = rendre("simulateur");
    expect(html).toMatch(/class="bouton-base"[^>]*aria-haspopup="dialog"/);
    expect(html).toContain("<svg"); // icône
    expect(html).toContain("<span>Base A</span>");
    expect(html).not.toContain('role="dialog"'); // fermée tant qu'on n'a pas cliqué
  });

  it("n'affiche pas le choix de base quand il n'y en a qu'une", () => {
    expect(rendre("simulateur", UNE_BASE)).not.toContain("bouton-base");
  });
});
