import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { chargerBase } from "../data/bases";
import type { Profil } from "../types";
import Accueil from "./Accueil";
import Resultats from "./Resultats";

const PROFIL: Profil = {
  statut_professionnel: "salarie",
  tranche_revenus: "3000_5000",
  situation_familiale: "en_couple",
  nombre_enfants: 1,
  logement: "locataire",
  secteur_activite: "commerce",
  region: "Bretagne",
  tranche_age: "moins_30",
  tranche_patrimoine: "moins_100k",
};

// Rendu de bout en bout avec les VRAIES données de chaque base : le même moteur et la même interface doivent
// fonctionner quelle que soit la base, avec ses propres thèmes.
describe("Résultats sur les données réelles", () => {
  it("base « agregateurs » : thèmes du comparateur, sources secondaires citées, jamais de badge inventé", () => {
    const rendu = renderToStaticMarkup(<Resultats profil={PROFIL} base={chargerBase("agregateurs")} />);
    expect(rendu).toContain("Finances publiques");
    expect(rendu).toContain("Retraites &amp; Travail");
    expect(rendu).toContain("Fondation iFRAP · 2026");
    expect(rendu).toContain("Cette base ne calcule pas de projection");
    // Aucun badge à côté d'un nom de candidat (la légende, elle, décrit les niveaux : on ne regarde que les candidats).
    expect(rendu).not.toMatch(/candidat-nom">[^<]+<\/span><span class="niveau/);
    expect(rendu).toContain("Pas de projection");
    expect(rendu).not.toContain("Mes impôts");
  });

  it("base « officielle » : ses propres thèmes, sans ceux du comparateur", () => {
    const rendu = renderToStaticMarkup(<Resultats profil={PROFIL} base={chargerBase("officielle")} />);
    expect(rendu).not.toContain("Retraites &amp; Travail");
    expect(rendu).toContain("relu ni validé");
  });

  it("l'accueil liste les thèmes de la base choisie et compte ses candidats", () => {
    const agregateurs = renderToStaticMarkup(<Accueil base={chargerBase("agregateurs")} onCommencer={() => {}} />);
    expect(agregateurs).toContain("Défense");
    expect(agregateurs).toContain("19 candidats");
    const officielle = renderToStaticMarkup(<Accueil base={chargerBase("officielle")} onCommencer={() => {}} />);
    expect(officielle).not.toContain("Défense");
  });

  it("l'ordre des candidats reste alphabétique dans une card, quelle que soit la base", () => {
    const rendu = renderToStaticMarkup(<Resultats profil={PROFIL} base={chargerBase("agregateurs")} />);
    const carte = rendu.slice(rendu.indexOf('id="theme-finances-publiques"'), rendu.indexOf('id="theme-interieur-justice"'));
    const noms = [...carte.matchAll(/class="candidat-nom">([^<]+)</g)].map((m) => m[1]);
    expect(noms.length).toBeGreaterThan(5);
    // Ordre = nom de famille (slug), pas le nombre de propositions : Mélenchon (le plus fourni) n'est pas en tête.
    expect(noms[0]).toBe("Gabriel Attal");
    expect(noms.indexOf("Nicolas Dupont-Aignan")).toBeLessThan(noms.indexOf("Jean-Luc Mélenchon"));
    expect(noms.indexOf("Jean-Luc Mélenchon")).toBeLessThan(noms.indexOf("Éric Zemmour"));
  });
});
