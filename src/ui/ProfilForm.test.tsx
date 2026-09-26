import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ProfilForm, { profilDepuisValeurs } from "./ProfilForm";

const rendu = (profilInitial = {}) => renderToStaticMarkup(<ProfilForm profilInitial={profilInitial} onValider={() => {}} onAnnuler={() => {}} />);

describe("ProfilForm", () => {
  it("ne demande rien d'obligatoire et ne présélectionne aucune réponse", () => {
    const html = rendu();
    expect(html).not.toContain("required");
    // Chaque question à choix propose de ne pas répondre, et c'est elle qui est sélectionnée : rien n'est répondu à la place du visiteur.
    expect((html.match(/<option value="" selected="">Je préfère ne pas répondre<\/option>/g) ?? []).length).toBe(6);
    expect((html.match(/<option value="[^"]+" selected/g) ?? []).length).toBe(0);
  });

  it("affiche des libellés lisibles, jamais les identifiants techniques", () => {
    const html = rendu();
    expect(html).toContain("Moins de 1 200 €");
    expect(html).toContain("Propriétaire");
    expect(html).not.toContain(">moins_1200<");
    expect(html).not.toContain(">2000_3000<");
  });

  it("annonce que les réponses restent dans le navigateur et qu'une absence de réponse n'est pas un « non »", () => {
    const html = rendu();
    expect(html).toContain("facultatives");
    expect(html).toContain("ne sont ni envoyées ni conservées");
    expect(html).toContain("jamais comptée");
  });

  it("préremplit les réponses déjà données quand on modifie sa situation", () => {
    expect(rendu({ logement: "proprietaire", region: "Bretagne" })).toMatch(/<option value="proprietaire" selected/);
    expect(rendu({ region: "Bretagne" })).toContain('value="Bretagne"');
  });

  it("propose de revenir aux thèmes sans rien enregistrer", () => {
    expect(rendu()).toContain("Retour aux thèmes");
  });
});

describe("profilDepuisValeurs", () => {
  it("ne garde que les réponses données : un champ vide n'apparaît pas dans le profil", () => {
    expect(profilDepuisValeurs({ tranche_age: "30_49", logement: "", region: "  ", nombre_enfants: "" })).toEqual({ tranche_age: "30_49" });
  });

  it("garde « 0 enfant » comme une réponse et convertit les nombres", () => {
    expect(profilDepuisValeurs({ nombre_enfants: "0" })).toEqual({ nombre_enfants: 0 });
    expect(profilDepuisValeurs({ nombre_enfants: "2" })).toEqual({ nombre_enfants: 2 });
  });

  it("ignore un nombre invalide ou négatif plutôt que de le deviner", () => {
    expect(profilDepuisValeurs({ nombre_enfants: "abc" })).toEqual({});
    expect(profilDepuisValeurs({ nombre_enfants: "-1" })).toEqual({});
  });

  it("garde le texte libre nettoyé", () => {
    expect(profilDepuisValeurs({ region: "  Bretagne " })).toEqual({ region: "Bretagne" });
  });
});
