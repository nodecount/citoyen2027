import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ChampProfil } from "../types";
import PageQuestionsGenerales from "./PageQuestionsGenerales";
import { PasAPas, type EtapeQuestion } from "./PasAPas";

const STATUT: ChampProfil = { id: "statut", label: "Votre statut", type: "enum", options: ["salarie", "retraite"], libelles: { salarie: "Salarié", retraite: "Retraité" }, finalite: "Les mesures ne visent pas les mêmes statuts." };
const AIDES: ChampProfil = { id: "aides", label: "Aides perçues", type: "multi", options: ["rsa", "apl"], libelles: { rsa: "RSA", apl: "Aide au logement" } };
const ENFANTS: ChampProfil = { id: "nombre_enfants", label: "Nombre d'enfants", type: "number" };

const ETAPES: EtapeQuestion[] = [{ champ: STATUT }, { champ: AIDES, theme: "Mon logement" }, { champ: ENFANTS }];
const rendre = (profil = {}, etapes = ETAPES) => renderToStaticMarkup(<PasAPas etapes={etapes} profil={profil} onReponse={() => {}} onToutVoir={() => {}} />);

describe("PasAPas", () => {
  it("pose une seule question à la fois, avec son rang et sa finalité", () => {
    const html = rendre();
    expect(html).toContain("Question 1 sur 3");
    expect(html).toContain("Votre statut");
    expect(html).toContain("Les mesures ne visent pas les mêmes statuts.");
    expect(html).not.toContain("Aides perçues");
    expect(html).not.toContain("Nombre d&#x27;enfants");
  });

  it("ne présélectionne rien et propose « Passer » tant que la question est sans réponse", () => {
    const html = rendre();
    expect(html).toContain('type="radio"');
    expect(html).not.toContain("checked");
    expect(html).toContain("Passer");
    expect(html).not.toContain("Effacer ma réponse");
  });

  it("n'a pas de « Précédent » actif sur la première question", () => {
    expect(rendre()).toMatch(/<button type="button" class="secondaire" disabled="">.*Précédent/);
  });

  it("reprend à la première question sans réponse, et rappelle le thème des questions propres à un thème", () => {
    const html = rendre({ statut: "salarie" });
    expect(html).toContain("Question 2 sur 3");
    expect(html).toContain("Mon logement");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("Aide au logement");
  });

  it("affiche « Suivant » et la réponse cochée quand la question a déjà une réponse", () => {
    const html = rendre({ statut: "salarie", aides: ["apl"], nombre_enfants: 1 }, [{ champ: AIDES }, { champ: ENFANTS }]);
    expect(html).toContain("Suivant");
    expect(html).toContain("Effacer ma réponse");
    expect(html).toMatch(/checked=""[^>]*\/><span>Aide au logement/);
  });

  it("à la dernière question, « Suivant » devient « Enregistrer et fermer » (réponse donnée ou non), sans « Passer »", () => {
    const sans = rendre({}, [{ champ: ENFANTS }]);
    expect(sans).toContain("Enregistrer et fermer");
    expect(sans).not.toContain("Passer");
    const avec = rendre({ nombre_enfants: 2 }, [{ champ: ENFANTS }]);
    expect(avec).toContain("Enregistrer et fermer");
    expect(avec).not.toContain(">Suivant<");
  });

  it("propose un champ nombre sans valeur par défaut", () => {
    const html = rendre({}, [{ champ: ENFANTS }]);
    expect(html).toContain('type="number"');
    expect(html).toContain('value=""');
  });
});

describe("PageQuestionsGenerales intégrée", () => {
  const page = (integre: boolean) =>
    renderToStaticMarkup(<PageQuestionsGenerales champs={[STATUT]} questions={[STATUT]} profilInitial={{}} onValider={() => {}} onAnnuler={() => {}} integre={integre} />);

  it("propose par défaut une question par écran, sans la grille, avec un accès à toutes les questions", () => {
    const html = page(true);
    expect(html).toContain("Question 1 sur 1");
    expect(html).not.toContain("grille-questions");
    expect(html).toContain("Voir toutes les questions d&#x27;un coup");
  });

  it("garde la page à part (hors simulateur) sous forme de formulaire complet", () => {
    const html = page(false);
    expect(html).not.toContain("Question 1 sur");
    expect(html).toContain("Votre statut");
  });
});
