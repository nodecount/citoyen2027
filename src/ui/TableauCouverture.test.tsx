import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { candidatsDeBase, chargerBase } from "../data/bases";
import { TableauCouverture, compterMesures, intensite, styleCellule } from "./TableauCouverture";

describe("intensité de la couleur", () => {
  it("vaut 0 sans mesure, 1 au maximum, et suit une racine carrée entre les deux", () => {
    expect(intensite(0, 10)).toBe(0);
    expect(intensite(10, 10)).toBe(1);
    expect(intensite(1, 4)).toBeCloseTo(0.5);
    expect(intensite(3, 0)).toBe(0);
  });

  it("n'utilise qu'une teinte de bleu (ni vert ni rouge : pas de jugement), texte blanc sur les cases foncées", () => {
    expect(styleCellule(0, 10)).toEqual({});
    expect(styleCellule(1, 100).background).toMatch(/^rgba\(27, 63, 148, /);
    expect(styleCellule(1, 100).color).toBeUndefined();
    expect(styleCellule(100, 100).color).toBe("#ffffff");
  });
});

describe("TableauCouverture sur les données réelles", () => {
  const base = chargerBase("agregateurs");
  const { avecDonnees } = candidatsDeBase(base);
  const html = renderToStaticMarkup(<TableauCouverture themes={base.themes} candidats={avecDonnees} />);

  it("a une ligne par candidat (photo + nom) et une colonne par thème (icône + nom)", () => {
    expect((html.match(/<th scope="row">/g) ?? []).length).toBe(avecDonnees.length);
    expect((html.match(/<th scope="col"/g) ?? []).length).toBe(base.themes.length + 1);
    expect(html).toContain("<span>Marine Le Pen</span>");
    expect(html).toContain('src="/candidats/le-pen.');
    expect(html).toContain("<span>Finances publiques</span>");
  });

  it("range les candidats par ordre alphabétique, jamais par nombre de mesures", () => {
    const noms = [...html.matchAll(/<th scope="row">[\s\S]*?<span>([^<]+)<\/span><\/span><\/th>/g)].map((m) => m[1]);
    expect(noms[0]).toBe("Gabriel Attal");
    expect(noms.indexOf("Jean-Luc Mélenchon")).toBeGreaterThan(noms.indexOf("Marine Le Pen"));
  });

  it("écrit le nombre exact de mesures affichables à chaque intersection, et un tiret quand il n'y en a pas", () => {
    const melenchon = avecDonnees.find((c) => c.meta.slug === "melenchon")!;
    const n = compterMesures(melenchon, "finances-publiques");
    expect(n).toBeGreaterThan(0);
    expect(html).toContain(`>${n}</td>`);
    expect(html).toContain('aria-label="aucune mesure">—');
  });
});
