import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { chargerBase } from "../data/bases";
import Accueil from "./Accueil";

function rendre(baseId: string) {
  return renderToStaticMarkup(<Accueil base={chargerBase(baseId)} onCommencer={() => {}} onOuvrir={() => {}} />);
}

describe("Accueil", () => {
  it.each(["officielle", "agregateurs"])("présente l'outil en une phrase, avec l'idée de personnalisation (base « %s »)", (id) => {
    const rendu = rendre(id);
    expect(rendu).toContain("Présidentielle 2027");
    expect(rendu).toContain("pour vous");
    expect(rendu).toContain("prochain mandat");
    expect(rendu).toContain("Accéder au simulateur");
  });

  it("met la date de mise à jour dans le bloc « Programmes officiels », en français", () => {
    const rendu = rendre("officielle");
    const bloc = rendu.slice(rendu.indexOf("Programmes officiels</strong>"));
    expect(bloc).toMatch(/^Programmes officiels<\/strong><span>à jour du \d{1,2} [a-zûé]+ 2026<\/span>/);
    expect(rendu).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("annonce le nombre de candidats à l'élection", () => {
    const rendu = rendre("agregateurs");
    expect(rendu).toContain("12 candidats</strong><span>à l&#x27;élection présidentielle 2027</span>");
  });

  it("affiche le tableau « qui propose quoi », sans les crédits photos (ils sont sur la page À propos)", () => {
    const rendu = rendre("agregateurs");
    expect(rendu).toContain("Qui propose quoi ?");
    expect(rendu).toContain('class="tableau-couverture"');
    expect(rendu).not.toContain("Crédits photos");
  });

  it("n'affiche aucun formulaire : la personnalisation reste une promesse, pas une saisie", () => {
    expect(rendre("officielle")).not.toContain("<form");
  });
});
