import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ZoneOnglets } from "./ZoneOnglets";

const rendre = (props: { onglet: "questions" | "candidats"; candidatsOuverts: boolean }) =>
  renderToStaticMarkup(<ZoneOnglets zone="situation" {...props} onChoisir={() => {}} questions={<p>QUESTIONS</p>} candidats={<p>SECRET</p>} />);

describe("ZoneOnglets", () => {
  it("verrouillé : l'onglet Candidats est inactif et son contenu n'est pas dans la page", () => {
    const html = rendre({ onglet: "questions", candidatsOuverts: false });
    expect(html).toMatch(/role="tab"[^>]*aria-disabled="true"[^>]*>[^<]*(<svg[\s\S]*?<\/svg>)?[^<]*Candidats/);
    expect(html).toContain("disabled");
    expect(html).toContain("QUESTIONS");
    expect(html).not.toContain("SECRET");
  });

  it("ouvert et sélectionné : le classement remplace les questions", () => {
    const html = rendre({ onglet: "candidats", candidatsOuverts: true });
    expect(html).toContain("SECRET");
    expect(html).not.toContain("QUESTIONS");
    expect(html).toMatch(/aria-selected="true"[^>]*>[^<]*Candidats/);
    expect(html).toContain('role="tabpanel"');
  });

  it("un onglet Candidats demandé alors qu'il est verrouillé n'affiche jamais son contenu", () => {
    expect(rendre({ onglet: "candidats", candidatsOuverts: false })).not.toContain("SECRET");
  });
});
