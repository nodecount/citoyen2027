import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { InfoBase } from "../data/bases";
import { SelecteurBase } from "./SelecteurBase";

const A: InfoBase = { id: "a", libelle: "Base A", description: "Description de A.", avertissement: "" };
const B: InfoBase = { id: "b", libelle: "Base B", description: "Description de B.", avertissement: "" };

describe("SelecteurBase", () => {
  it("n'affiche rien quand il n'y a qu'une base : il n'y a pas de choix à faire", () => {
    expect(renderToStaticMarkup(<SelecteurBase bases={[A]} actif="a" onChoisir={() => {}} />)).toBe("");
  });

  it("liste toutes les bases, sélectionne l'active et décrit ce qu'elle contient", () => {
    const rendu = renderToStaticMarkup(<SelecteurBase bases={[A, B]} actif="b" onChoisir={() => {}} />);
    expect(rendu).toContain("Base A");
    expect(rendu).toContain("Base B");
    expect(rendu).toMatch(/<option value="b" selected/);
    expect(rendu).toContain("Description de B.");
    expect(rendu).not.toContain("Description de A.");
  });
});
