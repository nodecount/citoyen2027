import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PORTRAITS, Pastille } from "./Pastille";

describe("Pastille", () => {
  it("affiche la photo quand elle existe, décorative (le nom est porté ailleurs)", () => {
    const html = renderToStaticMarkup(<Pastille slug="le-pen" nom="Marine Le Pen" />);
    expect(html).toMatch(/class="pastille pastille--photo" aria-hidden="true"><img src="\/candidats\/le-pen\.\w+" alt=""/);
  });

  it("affiche les initiales quand il n'y a pas de photo", () => {
    expect(renderToStaticMarkup(<Pastille slug="parti-socialiste" nom="PARTI SOCIALISTE" />)).toContain(">PS<");
  });

  it("porte un nom accessible quand elle est seule à donner l'information", () => {
    const html = renderToStaticMarkup(<Pastille slug="x" nom="Nom X" libelle="Nom X : aucune mesure" />);
    expect(html).toContain('role="img" aria-label="Nom X : aucune mesure" title="Nom X : aucune mesure"');
  });
});

describe("portraits (data/portraits.json)", () => {
  it("chaque photo existe dans static/, sous licence libre, avec auteur et source", () => {
    for (const [slug, p] of Object.entries(PORTRAITS)) {
      expect(existsSync(resolve(process.cwd(), "static", p.fichier)), slug).toBe(true);
      expect(p.licence, slug).toMatch(/^(CC BY(-SA)? [\d.]+|CC0|Public domain)/i);
      expect(p.auteur.length, slug).toBeGreaterThan(0);
      expect(p.auteur.length, `${slug} : auteur illisible`).toBeLessThanOrEqual(80);
      expect(p.source_url, slug).toMatch(/^https:\/\/commons\.wikimedia\.org\//);
    }
  });
});
