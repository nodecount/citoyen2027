import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ModaleTravail } from "./ModaleTravail";

const rendre = (props: { introAuDebut?: boolean; avecIntro?: boolean; pleinePage?: boolean } = {}) =>
  renderToStaticMarkup(
    <ModaleTravail ouverte titre="Ma situation" onFermer={() => {}} introAuDebut={props.introAuDebut} pleinePage={props.pleinePage} intro={props.avecIntro === false ? undefined : <p>TEXTE-INTRO</p>}>
      <p>QUESTIONS</p>
    </ModaleTravail>,
  );

describe("ModaleTravail", () => {
  it("au début (aucune réponse) : l'introduction est la première page, avec « Continuer », et les questions sont masquées mais montées", () => {
    const html = rendre({ introAuDebut: true });
    expect(html).toMatch(/class="modale-intro"[^>]*>/);
    expect(html).not.toMatch(/class="modale-intro" hidden/);
    expect(html).toContain("Continuer");
    expect(html).toMatch(/class="modale-corps" hidden/);
    expect(html).toContain("QUESTIONS"); // monté : aucun brouillon perdu
  });

  it("une fois des réponses données : l'introduction est masquée, les questions sont affichées", () => {
    const html = rendre({ introAuDebut: false });
    expect(html).toMatch(/class="modale-intro" hidden/);
    expect(html).not.toMatch(/class="modale-corps" hidden/);
  });

  it("sans introduction : pas de page d'introduction, questions affichées ; plein page demandée : classe dédiée", () => {
    const html = rendre({ avecIntro: false, introAuDebut: true, pleinePage: true });
    expect(html).not.toContain("modale-intro");
    expect(html).toContain("modale--plein");
  });
});
