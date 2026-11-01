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

  it("est un texte rédigé : un titre, des chapitres à titres, des encarts dans la marge, pas de cartes", () => {
    expect(html).not.toContain("<h1"); // le menu dit déjà où l'on est
    expect((html.match(/<section class="chapitre/g) ?? []).length).toBe(6);
    expect((html.match(/<aside class="encart/g) ?? []).length).toBeGreaterThanOrEqual(6);
    for (const ancien of ["kpi", "bloc-a-propos", "essai-source"]) expect(html, ancien).not.toContain(ancien);
  });

  it("ouvre sur trois repères d'un coup d'œil : une icône, un titre, une mini phrase", () => {
    expect((html.match(/<li class="repere repere--(bleu|rouge|fonce)"><svg[^>]*>[\s\S]*?<\/svg><strong>[^<]+<\/strong><span>[^<]+<\/span><\/li>/g) ?? []).length).toBe(3);
    for (const t of ["Indépendant", "Même règle pour tous", "Vos données"]) expect(html, t).toContain(t);
  });

  it("a un vrai chapitre sur le choix de la source : trois essais et leur verdict, pourquoi iFRAP, ce qui est écarté, où voir les essais", () => {
    expect(html).toContain("Le choix de la source des données");
    expect(html).not.toContain("D&#x27;où viennent les données");
    for (const t of ["Programmes officiels : en pause", "en pause", "écartée", "retenue", "ne sont pas vérifiées une à une", "Ce qui a été écarté d&#x27;emblée", "Tests de situations", "Monitoring", "Voir les essais"]) expect(html, t).toContain(t);
    expect(html.indexOf("en pause")).toBeLessThan(html.indexOf("retenue"));
  });

  it("a un chapitre sur les limites et les partis pris (score en mesures, compromis des tranches, pondération laissée au citoyen)", () => {
    expect(html).toContain("Limites et partis pris");
    expect(html).toContain("jamais votre situation au centime");
    expect(html).toContain("ne mesure pas la fiabilité du résultat"); // le pourcentage de précision compte des réponses, rien d'autre
    expect(html).toContain("nombre de mesures qui améliorent votre situation, moins le nombre de mesures qui la dégradent");
    expect(html).toContain("Il n&#x27;y a ni pourcentage ni pondération");
    expect(html).toContain("C&#x27;est à vous de peser les mesures");
    expect(html).toContain("une note sur 100");
    expect(html).toContain("plus grand nombre de mesures qui vous concernent");
    expect(html).toContain("moyenne des deux notes");
    expect(html).not.toContain("—");
  });

  it("schématise la chaîne de traitement : qui agit (code ou modèle) à chaque étape, et les deux branches", () => {
    expect(html).toContain("Comment les mesures sont traitées");
    expect(html).toContain("Pour votre situation");
    expect(html).toContain("Pour vos convictions");
    expect(html).toContain("npm run scrape:positions");
    expect((html.match(/acteur--modele/g) ?? []).length).toBe(4);
    expect((html.match(/acteur--code/g) ?? []).length).toBe(5);
    expect(html).toContain("mot pour mot");
  });

  it("crédite chaque photo : vignette, auteur, licence et source, cliquables", () => {
    expect((html.match(/>source<\/a>/g) ?? []).length).toBe(1);
    const toutes = renderToStaticMarkup(<PageAPropos bases={listerBases()} nomsParSlug={Object.fromEntries(Object.keys(PORTRAITS).map((s) => [s, s]))} />);
    expect((toutes.match(/>source<\/a>/g) ?? []).length).toBe(Object.keys(PORTRAITS).length);
    expect(html).toContain("<strong>Marine Le Pen</strong>");
    expect(html).toContain(PORTRAITS["le-pen"].licence);
    expect(html).toContain(`href="${PORTRAITS["le-pen"].source_url}"`);
  });
});
