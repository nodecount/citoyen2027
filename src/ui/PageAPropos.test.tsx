import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { listerBases } from "../data/bases";
import PageAPropos from "./PageAPropos";
import { PORTRAITS } from "./Pastille";

describe("PageAPropos", () => {
  const html = renderToStaticMarkup(<PageAPropos bases={listerBases()} nomsParSlug={{ "le-pen": "Marine Le Pen" }} />);

  it("dit l'indépendance, la provenance des données et la confidentialité, brièvement", () => {
    expect(html).toContain("Aucun lien avec un parti ou un candidat");
    for (const base of listerBases()) expect(html).toContain(base.libelle);
    expect(html).toContain("Rien n&#x27;est envoyé ni enregistré");
  });

  it("présente chaque section dans un bloc avec son icône", () => {
    expect((html.match(/<article class="bloc-a-propos[^"]*"><svg/g) ?? []).length).toBe(4);
  });

  it("crédite chaque photo : vignette, auteur, licence et source, cliquables", () => {
    expect((html.match(/>source<\/a>/g) ?? []).length).toBe(Object.keys(PORTRAITS).length);
    expect(html).toContain("<strong>Marine Le Pen</strong>");
    expect(html).toContain(PORTRAITS["le-pen"].licence);
    expect(html).toContain(`href="${PORTRAITS["le-pen"].source_url}"`);
  });
});
