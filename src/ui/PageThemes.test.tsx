import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { chargerBase } from "../data/bases";
import type { ProfilPartiel } from "../profil";
import PageThemes from "./PageThemes";

const AUCUNE_REPONSE: ProfilPartiel = {};
const UNE_REPONSE: ProfilPartiel = { tranche_age: "30_49" };

function rendre(baseId: string, profil: ProfilPartiel, generalSoumis: boolean): string {
  return renderToStaticMarkup(
    <PageThemes base={chargerBase(baseId)} profil={profil} generalSoumis={generalSoumis} onRenseigner={() => {}} onEffacer={() => {}} onReponse={() => {}} />,
  );
}

const portraits = (rendu: string): string => (rendu.match(/<ul class="portraits"[\s\S]*?<\/ul>/g) ?? []).join("");
// Le nom n'est plus écrit sous la pastille : il est porté par le bouton (title et nom accessible).
const noms = (rendu: string): string[] => [...portraits(rendu).matchAll(/class="portrait[^"]*"[^>]*title="([^"]+)"/g)].map((m) => m[1]);

// Rendu de bout en bout avec les VRAIES données de chaque base : le même moteur et la même interface doivent
// fonctionner quelle que soit la base, avec ses propres thèmes.
describe("page des thèmes, sur les données réelles", () => {
  it.each(["officielle", "agregateurs"])("base « %s » : une carte par thème, des portraits cliquables, aucun indicateur avant le formulaire général", (id) => {
    const rendu = rendre(id, AUCUNE_REPONSE, false);
    const base = chargerBase(id);
    for (const theme of base.themes) expect(rendu).toContain(`id="theme-${theme.id}"`);
    expect(rendu).toMatch(/<button[^>]*class="portrait"/);
    expect(portraits(rendu)).not.toContain("data-niveau"); // aucune couleur autour des portraits
    expect(portraits(rendu)).not.toContain("niveau--"); // aucun badge
    expect(rendu).not.toContain("Comment lire les indicateurs");
    expect(rendu).toContain("Et pour vous ?");
    expect(rendu).toContain("Répondre aux questions");
    expect(rendu).not.toContain("<form"); // aucun formulaire imposé avant de voir les programmes
    expect(rendu).not.toContain("Préciser ma situation pour ce thème"); // les questions par thème viennent après
  });

  it("affiche la provenance des données en une seule ligne, celle de la base active", () => {
    expect(rendre("agregateurs", AUCUNE_REPONSE, false)).toContain("Mesures reprises du comparateur iFRAP, non vérifiées dans les programmes.");
    expect(rendre("officielle", AUCUNE_REPONSE, false)).toContain("pas encore relues par l&#x27;équipe");
    expect((rendre("agregateurs", AUCUNE_REPONSE, false).match(/class="avertissement"/g) ?? []).length).toBe(1);
  });

  it("base « agregateurs » : thèmes du comparateur, portraits avec photo, aucun thème de l'autre base", () => {
    const rendu = rendre("agregateurs", AUCUNE_REPONSE, false);
    expect(rendu).toContain("Finances publiques");
    expect(rendu).toContain("Retraites &amp; Travail");
    expect(rendu).not.toContain("Mes impôts");
    expect(rendu).toContain('src="/candidats/le-pen.');
    expect(rendu).toContain(">PS<"); // le Parti socialiste n'est pas une personne : initiales, pas de photo
  });

  it("n'écrit pas le nom des candidats sous leur portrait", () => {
    expect(rendre("agregateurs", AUCUNE_REPONSE, false)).not.toContain("portrait-nom");
  });

  it("l'ordre des portraits reste alphabétique dans une carte, quelle que soit la base", () => {
    const rendu = rendre("agregateurs", AUCUNE_REPONSE, false);
    const carte = rendu.slice(rendu.indexOf('id="theme-finances-publiques"'), rendu.indexOf('id="theme-interieur-justice"'));
    const liste = noms(carte);
    expect(liste.length).toBeGreaterThan(5);
    expect(liste[0]).toBe("Gabriel Attal");
    expect(liste.indexOf("Nicolas Dupont-Aignan")).toBeLessThan(liste.indexOf("Jean-Luc Mélenchon"));
    expect(liste.indexOf("Jean-Luc Mélenchon")).toBeLessThan(liste.indexOf("Éric Zemmour"));
  });
});

describe("les indicateurs n'apparaissent qu'après la validation du formulaire général", () => {
  it("des réponses en brouillon (formulaire non validé) ne colorent aucun portrait", () => {
    const rendu = rendre("agregateurs", UNE_REPONSE, false);
    expect(portraits(rendu)).not.toContain("data-niveau");
    expect(rendu).toContain("Et pour vous ?");
  });

  it("après validation avec au moins une réponse : couleurs autour des portraits, mot et symbole, légende", () => {
    const rendu = rendre("agregateurs", UNE_REPONSE, true);
    expect(rendu).toContain("Comment lire les indicateurs");
    expect(rendu).toContain("Vos réponses sont prises en compte");
    expect(rendu).toContain("Modifier mes réponses");
    expect(rendu).toContain("Effacer mes réponses");
    expect(portraits(rendu)).toMatch(/data-niveau="[a-z_]+"/);
    expect(portraits(rendu)).toMatch(/[▲◆○▼]/);
  });

  it("après validation d'un formulaire resté vide : toujours aucun indicateur, et on invite à répondre", () => {
    const rendu = rendre("agregateurs", AUCUNE_REPONSE, true);
    expect(portraits(rendu)).not.toContain("data-niveau");
    expect(rendu).toContain("Aucune réponse donnée");
  });

  it("ouvre alors les questions propres à chaque thème, sur les thèmes qui en ont", () => {
    const rendu = rendre("officielle", UNE_REPONSE, true);
    expect(rendu).toContain("Préciser ma situation pour ce thème");
    const base = chargerBase("officielle");
    expect((rendu.match(/class="questions-theme"/g) ?? []).length).toBe(base.questionnaire.parTheme.length);
  });

  it("garde les mêmes portraits qu'au départ : répondre n'ajoute ni ne retire aucun candidat", () => {
    expect(noms(rendre("agregateurs", UNE_REPONSE, true))).toEqual(noms(rendre("agregateurs", AUCUNE_REPONSE, false)));
  });
});
