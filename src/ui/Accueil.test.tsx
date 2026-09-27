import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { chargerBase } from "../data/bases";
import Accueil from "./Accueil";

function rendre(baseId: string) {
  return renderToStaticMarkup(<Accueil base={chargerBase(baseId)} onCommencer={() => {}} />);
}

describe("Accueil", () => {
  it.each(["officielle", "agregateurs"])("annonce l'élection, la mise à jour et l'idée de personnalisation (base « %s »)", (id) => {
    const rendu = rendre(id);
    expect(rendu).toContain("élection présidentielle de 2027");
    expect(rendu).toContain("Dernière mise à jour des données");
    expect(rendu).toContain("consentement");
    expect(rendu).toContain("facultatives");
    expect(rendu).toContain("mandat à venir");
    expect(rendu).toContain("Découvrir les thèmes");
  });

  it("écrit la date en français, pas au format technique AAAA-MM-JJ", () => {
    const rendu = rendre("officielle");
    expect(rendu).toMatch(/Dernière mise à jour des données : \d{1,2} [a-zûé]+ 2026/);
    expect(rendu).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("nomme la base et compte ses candidats, sans classement ni score", () => {
    const rendu = rendre("agregateurs");
    expect(rendu).toContain("base « Base issue de comparateurs indépendants »");
    expect(rendu).toContain("19 candidats");
    expect(rendu).toContain("pas de classement, pas de score");
  });

  it("n'affiche aucun formulaire : la personnalisation reste une promesse, pas une saisie", () => {
    expect(rendre("officielle")).not.toContain("<form");
  });
});
