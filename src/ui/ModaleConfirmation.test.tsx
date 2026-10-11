import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ModaleConfirmation } from "./ModaleConfirmation";

const rendre = (ouverte: boolean) =>
  renderToStaticMarkup(<ModaleConfirmation ouverte={ouverte} titre="Effacer ?" message="Irréversible." libelleConfirmer="Oui, tout effacer" onConfirmer={() => {}} onAnnuler={() => {}} />);

describe("ModaleConfirmation", () => {
  it("fermée : rien dans la page", () => {
    expect(rendre(false)).toBe("");
  });
  it("ouverte : « Annuler » est secondaire (focus sûr) et la confirmation est un bouton danger", () => {
    const html = rendre(true);
    expect(html).toContain('role="alertdialog"');
    expect(html).toMatch(/class="secondaire"[^>]*>Annuler</);
    expect(html).toMatch(/class="bouton-danger"[^>]*>Oui, tout effacer</);
  });
});
