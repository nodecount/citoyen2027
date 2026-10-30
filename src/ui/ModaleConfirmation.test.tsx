import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ModaleConfirmation } from "./ModaleConfirmation";

const rendre = (ouverte: boolean) =>
  renderToStaticMarkup(<ModaleConfirmation ouverte={ouverte} titre="Effacer ?" message="Irréversible." libelleConfirmer="Oui, tout effacer" onConfirmer={() => {}} onAnnuler={() => {}} />);

describe("ModaleConfirmation", () => {
  it("fermée : rien dans la page", () => {
    expect(rendre(false)).toBe("");
  });
  it("libellé d'annulation et bouton de confirmation non destructeur configurables (la révélation n'est pas un effacement)", () => {
    const html = renderToStaticMarkup(
      <ModaleConfirmation ouverte titre="Révéler ?" message="Oui." libelleConfirmer="Oui, révéler" libelleAnnuler="Continuer à répondre" destructrice={false} onConfirmer={() => {}} onAnnuler={() => {}} />,
    );
    expect(html).toMatch(/class="secondaire"[^>]*>Continuer à répondre</);
    expect(html).not.toContain(">Annuler<");
    expect(html).not.toContain("bouton-danger"); // le rouge reste réservé aux boutons destructeurs
    expect(html).toContain("Oui, révéler");
  });
  it("ouverte : « Annuler » est secondaire (focus sûr) et la confirmation est un bouton danger", () => {
    const html = rendre(true);
    expect(html).toContain('role="alertdialog"');
    expect(html).toMatch(/class="secondaire"[^>]*>Annuler</);
    expect(html).toMatch(/class="bouton-danger"[^>]*>Oui, tout effacer</);
  });
});
