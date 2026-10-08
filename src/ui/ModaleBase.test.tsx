import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { InfoBase } from "../data/bases";
import { ModaleBase } from "./ModaleBase";

const BASES: InfoBase[] = [
  { id: "a", libelle: "Base A", description: "Description A.", avertissement: "" },
  { id: "b", libelle: "Base B", description: "Description B.", avertissement: "" },
];

const rendre = (ouverte: boolean) =>
  renderToStaticMarkup(<ModaleBase ouverte={ouverte} bases={BASES} actif="b" onChoisir={() => {}} onControle={() => {}} onFermer={() => {}} />);

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

  it("propose, pour chaque base, son monitoring et ses tests de situations", () => {
    const html = rendre(true);
    expect(html.match(/>Monitoring</g)).toHaveLength(BASES.length);
    expect(html.match(/>Tests de situations</g)).toHaveLength(BASES.length);
  });
});
