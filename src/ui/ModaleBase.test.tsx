import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { InfoBase } from "../data/bases";
import { ModaleBase } from "./ModaleBase";

const BASES: InfoBase[] = [
  { id: "a", libelle: "Base A", description: "Description A.", avertissement: "" },
  { id: "b", libelle: "Base B", description: "Description B.", avertissement: "" },
];

const rendre = (ouverte: boolean) => renderToStaticMarkup(<ModaleBase ouverte={ouverte} bases={BASES} onControle={() => {}} onFermer={() => {}} />);

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

  it("liste chaque source avec sa description, sans aucun système de sélection ni phrase d'invitation à choisir", () => {
    const html = rendre(true);
    expect(html).toContain("Description A.");
    expect(html).toContain("Description B.");
    expect(html).not.toContain("<input");
    expect(html).not.toContain("Choisissez la source");
  });

  it("ne liste plus les candidats sans mesure : cette information est dans la page de monitoring de la source", () => {
    expect(rendre(true)).not.toContain("Sans mesure dans cette source");
  });

  it("dit pour chaque source si elle est connectée (vert) ou déconnectée (rouge), en mots et en pictogramme", () => {
    const bases = [{ ...BASES[0], desactivee: true }, BASES[1]];
    const html = renderToStaticMarkup(<ModaleBase ouverte bases={bases} onControle={() => {}} onFermer={() => {}} />);
    expect(html).toContain("source source--debranchee");
    expect(html).toContain("source source--branchee");
    expect(html).toContain(">Déconnectée<");
    expect(html).toContain(">Connectée<");
    expect(html.match(/<svg/g)?.length).toBeGreaterThanOrEqual(3); // un pictogramme par source, plus la croix
    // Le pictogramme précède le nom de la source.
    expect(html.indexOf("<svg")).toBeLessThan(html.indexOf("<strong>Base A</strong>"));
  });

  it("n'offre le monitoring et les tests de situations que pour une source connectée", () => {
    const bases = [{ ...BASES[0], desactivee: true }, BASES[1]];
    const html = renderToStaticMarkup(<ModaleBase ouverte bases={bases} onControle={() => {}} onFermer={() => {}} />);
    expect(html.match(/>Monitoring</g)).toHaveLength(1);
    expect(html.match(/>Tests de situations</g)).toHaveLength(1);
    // Les liens sont sous la source connectée (B), pas sous la déconnectée (A).
    expect(html.indexOf(">Monitoring<")).toBeGreaterThan(html.indexOf("Description B."));
    expect(rendre(true).match(/>Monitoring</g)).toHaveLength(2); // deux sources connectées : un lien chacune
  });
});
