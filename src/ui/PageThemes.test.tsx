import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { chargerBase } from "../data/bases";
import type { ProfilPartiel } from "../profil";
import PageThemes from "./PageThemes";

const AUCUNE_REPONSE: ProfilPartiel = {};
const UNE_REPONSE: ProfilPartiel = { tranche_age: "30_49" };

function rendre(baseId: string, profil: ProfilPartiel): string {
  return renderToStaticMarkup(<PageThemes base={chargerBase(baseId)} profil={profil} onRenseigner={() => {}} onEffacer={() => {}} />);
}

const portraits = (rendu: string): string => (rendu.match(/<ul class="portraits"[\s\S]*?<\/ul>/g) ?? []).join("");

// Rendu de bout en bout avec les VRAIES données de chaque base : le même moteur et la même interface doivent
// fonctionner quelle que soit la base, avec ses propres thèmes.
describe("page de départ, sur les données réelles", () => {
  it.each(["officielle", "agregateurs"])("base « %s » : les thèmes, des portraits cliquables, et aucun indicateur sans réponse", (id) => {
    const rendu = rendre(id, AUCUNE_REPONSE);
    const base = chargerBase(id);
    for (const theme of base.themes) expect(rendu).toContain(`id="theme-${theme.id}"`);
    expect(rendu).toMatch(/<button[^>]*class="portrait"/);
    expect(portraits(rendu)).not.toContain("niveau"); // aucun badge
    expect(rendu).not.toContain("Comment lire les indicateurs");
    expect(rendu).toContain("Aucun indicateur pour l&#x27;instant");
    expect(rendu).toContain("Renseigner ma situation");
    expect(rendu).not.toContain("<form"); // aucun formulaire imposé avant de voir les programmes
  });

  it("base « agregateurs » : thèmes du comparateur, portraits à initiales, avertissement de la base", () => {
    const rendu = rendre("agregateurs", AUCUNE_REPONSE);
    expect(rendu).toContain("Finances publiques");
    expect(rendu).toContain("Retraites &amp; Travail");
    expect(rendu).toContain("sources secondaires");
    expect(rendu).not.toContain("Mes impôts");
    expect(rendu).toContain(">MLP<"); // Marine Le Pen
    expect(rendu).toContain(">JM<"); // Jean-Luc Mélenchon
    expect(rendu).toContain("19 candidats");
  });

  it("base « officielle » : ses propres thèmes, sans ceux du comparateur", () => {
    const rendu = rendre("officielle", AUCUNE_REPONSE);
    expect(rendu).not.toContain("Retraites &amp; Travail");
    expect(rendu).toContain("relu ni validé");
  });

  it("l'ordre des portraits reste alphabétique dans une card, quelle que soit la base", () => {
    const rendu = rendre("agregateurs", AUCUNE_REPONSE);
    const carte = rendu.slice(rendu.indexOf('id="theme-finances-publiques"'), rendu.indexOf('id="theme-interieur-justice"'));
    const noms = [...carte.matchAll(/class="portrait-nom">([^<]+)</g)].map((m) => m[1]);
    expect(noms.length).toBeGreaterThan(5);
    // Ordre = nom de famille (slug), pas le nombre de propositions : Mélenchon (le plus fourni) n'est pas en tête.
    expect(noms[0]).toBe("Gabriel Attal");
    expect(noms.indexOf("Nicolas Dupont-Aignan")).toBeLessThan(noms.indexOf("Jean-Luc Mélenchon"));
    expect(noms.indexOf("Jean-Luc Mélenchon")).toBeLessThan(noms.indexOf("Éric Zemmour"));
  });
});

describe("après une première réponse, sur les données réelles", () => {
  it("la légende et des indicateurs apparaissent sur des portraits, chacun avec son mot et son symbole", () => {
    const rendu = rendre("agregateurs", UNE_REPONSE);
    expect(rendu).toContain("Comment lire les indicateurs");
    expect(rendu).toContain("Vos réponses sont prises en compte");
    expect(rendu).toContain("Modifier mes réponses");
    expect(rendu).toContain("Effacer mes réponses");
    const badges = portraits(rendu).match(/class="niveau niveau--[a-z-]+"/g) ?? [];
    expect(badges.length).toBeGreaterThan(0);
    expect(portraits(rendu)).toMatch(/[▲◆○▼]/);
  });

  it("garde les mêmes portraits qu'au départ : répondre n'ajoute ni ne retire aucun candidat", () => {
    const avant = [...portraits(rendre("agregateurs", AUCUNE_REPONSE)).matchAll(/class="portrait-nom">([^<]+)</g)].map((m) => m[1]);
    const apres = [...portraits(rendre("agregateurs", UNE_REPONSE)).matchAll(/class="portrait-nom">([^<]+)</g)].map((m) => m[1]);
    expect(apres).toEqual(avant);
  });

  it("un profil dont toutes les réponses sont vides équivaut à aucune réponse", () => {
    const rendu = rendre("agregateurs", { region: "", secteur_activite: "  " });
    expect(portraits(rendu)).not.toContain("niveau");
    expect(rendu).toContain("Aucun indicateur pour l&#x27;instant");
  });
});
