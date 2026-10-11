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
    expect((html.match(/<article class="bloc-a-propos[^"]*"><svg/g) ?? []).length).toBe(5);
  });

  it("a un chapitre sur les limites et les partis pris (score en mesures, compromis des tranches, pondération laissée au citoyen)", () => {
    expect(html).toContain("Limites et partis pris");
    expect(html).toContain("jamais votre situation au centime");
    expect(html).toContain("nombre de mesures qui améliorent votre situation, moins le nombre de mesures qui la dégradent");
    expect(html).toContain("Il n&#x27;y a ni pourcentage ni pondération");
    expect(html).toContain("C&#x27;est à vous de peser les mesures");
    expect(html).toContain("noté sur 100");
    expect(html).toContain("nombre de mesures du candidat qui en propose le plus");
    expect(html).not.toContain("—");
  });

  it("crédite chaque photo : vignette, auteur, licence et source, cliquables", () => {
    expect((html.match(/>source<\/a>/g) ?? []).length).toBe(Object.keys(PORTRAITS).length);
    expect(html).toContain("<strong>Marine Le Pen</strong>");
    expect(html).toContain(PORTRAITS["le-pen"].licence);
    expect(html).toContain(`href="${PORTRAITS["le-pen"].source_url}"`);
  });
});
