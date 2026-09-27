import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PiedDePage } from "./PiedDePage";

describe("PiedDePage", () => {
  const html = renderToStaticMarkup(<PiedDePage onNaviguer={() => {}} />);

  it("est un pied de page avec la marque, les liens des pages et une ligne sur l'indépendance", () => {
    expect(html).toMatch(/^<footer class="pied-de-page">/);
    expect(html).toContain("Citoyen 2027");
    for (const libelle of ["Accueil", "Simulateur", "À propos"]) expect(html).toContain(`>${libelle}</button>`);
    expect(html).toContain("sans lien avec un parti ou un candidat");
  });

  it("ne répète pas le contenu de la page À propos (crédits, confidentialité)", () => {
    expect(html).not.toContain("Crédits");
    expect(html).not.toContain("navigateur");
  });
});
