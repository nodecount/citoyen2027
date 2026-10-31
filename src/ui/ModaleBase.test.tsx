import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { InfoBase } from "../data/bases";
import { ModaleBase } from "./ModaleBase";

const BASES: InfoBase[] = [
  { id: "a", libelle: "Base A", description: "Description A.", avertissement: "" },
  { id: "b", libelle: "Base B", description: "Description B.", avertissement: "" },
];

const rendre = (ouverte: boolean, sansMesure?: Record<string, string[]>) =>
  renderToStaticMarkup(<ModaleBase ouverte={ouverte} bases={BASES} actif="b" onChoisir={() => {}} onControle={() => {}} onFermer={() => {}} sansMesure={sansMesure} />);

describe("ModaleBase", () => {
  it("n'existe pas dans la page tant qu'elle est fermée", () => {
    expect(rendre(false)).toBe("");
  });

  it("ouverte : boîte de dialogue modale, titrée, avec un bouton de fermeture accessible", () => {
    const html = rendre(true);
    expect(html).toMatch(/role="dialog" aria-modal="true" aria-labelledby="modale-base-titre"/);
    expect(html).toContain('id="modale-base-titre">Base de connaissances</h2>');
    expect(html).toContain('aria-label="Fermer"');
  });

  it("liste chaque base avec sa description, la base active cochée", () => {
    const html = rendre(true);
    expect(html).toContain("Description A.");
    expect(html).toContain("Description B.");
    const radio = (id: string) => html.match(new RegExp(`<input[^>]*value="${id}"[^>]*>`))?.[0] ?? "";
    expect(radio("b")).toContain("checked");
    expect(radio("a")).not.toContain("checked");
    expect(html).toContain("choix-base choix-base--actif");
  });

  it("dit, sous chaque base, les candidats qu'elle ne couvre pas du tout ; rien quand la liste est vide ou absente", () => {
    const html = rendre(true, { a: ["Nom-Un", "Nom-Deux"], b: [] });
    expect(html).toContain("Sans mesure dans cette source pour le moment : Nom-Un, Nom-Deux.");
    expect(html.match(/Sans mesure dans cette source/g)).toHaveLength(1);
    expect(rendre(true)).not.toContain("Sans mesure dans cette source");
  });

  it("grise le choix d'une base désactivée, et ses liens de contrôle, sans toucher aux autres", () => {
    const bases = [{ ...BASES[0], desactivee: true }, BASES[1]];
    const html = renderToStaticMarkup(<ModaleBase ouverte bases={bases} actif="b" onChoisir={() => {}} onControle={() => {}} onFermer={() => {}} />);
    const radio = (id: string) => html.match(new RegExp(`<input[^>]*value="${id}"[^>]*>`))?.[0] ?? "";
    expect(radio("a")).toContain("disabled");
    expect(radio("b")).not.toContain("disabled");
    expect(html.match(/<button[^>]*disabled=""[^>]*>Monitoring</g)).toHaveLength(1);
  });

  it("propose, pour chaque base, son monitoring et ses tests de situations", () => {
    const html = rendre(true);
    expect(html.match(/>Monitoring</g)).toHaveLength(BASES.length);
    expect(html.match(/>Tests de situations</g)).toHaveLength(BASES.length);
  });
});
