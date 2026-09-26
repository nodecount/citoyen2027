import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Effet } from "../effets";
import type { CandidatCharge } from "../data/chargerCandidats";
import type { Profil, Proposition, SyntheseTheme, Theme } from "../types";
import { construireCards } from "./cards";
import { VueResultats } from "./VueResultats";

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

const THEMES: Theme[] = [
  { id: "fiscalite", libelle: "Mes impôts et taxes", question_citoyen: "Combien vais-je payer ?", description: "d", statut: "populated" },
  { id: "retraites", libelle: "Ma retraite", question_citoyen: "À quel âge partir ?", description: "d", statut: "provisoire" },
];

const HAUSSE: Effet = { cibles: [], dimension: "revenu_disponible", sens: "hausse", source_url: "https://a.fr/p", extrait: "une aide mensuelle pour tous" };
const BAISSE: Effet = { ...HAUSSE, sens: "baisse", extrait: "une contribution sur les revenus" };

function prop(candidat: string, effets: Effet[] | undefined, theme = "fiscalite"): Proposition {
  return {
    id: `${candidat}-${theme}-001`,
    candidat,
    theme,
    titre: `Mesure de ${candidat}`,
    resume_factuel: "Résumé factuel.",
    sources: [{ type: "primaire", label: "Ancien libellé", url: `https://${candidat}.fr/p`, nom: `${candidat}.fr`, annee: 2021 }],
    chiffrage_disponible: false,
    hypotheses_calcul: "",
    statut: "complet",
    date_derniere_verification: "2026-09-24",
    effets,
  };
}

function candidat(slug: string, propositions: Proposition[], syntheses: SyntheseTheme[] = []): CandidatCharge {
  return {
    meta: { slug, nom: `Nom ${slug}`, parti: "P", sources_officielles: [], date_derniere_maj: "2026-09-24" },
    propositions,
    syntheses,
  };
}

function html(candidats: CandidatCharge[]): string {
  return renderToStaticMarkup(
    <VueResultats cards={construireCards(THEMES, candidats, PROFIL)} profil={PROFIL} avertissement="Avertissement de la base." />,
  );
}

describe("VueResultats", () => {
  it("affiche l'avertissement propre à la base utilisée", () => {
    expect(html([candidat("a", [prop("a", [HAUSSE])])])).toContain("Avertissement de la base.");
  });

  it("affiche une card par thème avec son libellé et la question du citoyen", () => {
    const rendu = html([candidat("a", [prop("a", [HAUSSE])])]);
    expect(rendu).toContain("Mes impôts et taxes");
    expect(rendu).toContain("Combien vais-je payer ?");
    expect(rendu).toContain("Ma retraite");
    expect(rendu).toContain('id="theme-fiscalite"');
  });

  it("propose des repères cliquables vers chaque thème", () => {
    const rendu = html([candidat("a", [prop("a", [HAUSSE])])]);
    expect(rendu).toContain('href="#theme-fiscalite"');
    expect(rendu).toContain('href="#theme-retraites"');
  });

  it("range les candidats par ordre alphabétique dans la page, quel que soit leur indicateur", () => {
    const rendu = html([
      candidat("z", [prop("z", [HAUSSE])]),
      candidat("b", [prop("b", [BAISSE])]),
    ]);
    expect(rendu.indexOf("Nom b")).toBeLessThan(rendu.indexOf("Nom z"));
  });

  it("affiche chaque niveau avec son texte ET son symbole, pas seulement une couleur", () => {
    const ameliorant = html([candidat("a", [prop("a", [HAUSSE])])]);
    expect(ameliorant).toContain("Améliorant");
    expect(ameliorant).toContain("▲");
    const degradant = html([candidat("a", [prop("a", [BAISSE])])]);
    expect(degradant).toContain("Dégradant");
    expect(degradant).toContain("▼");
    const mixte = html([candidat("a", [prop("a", [HAUSSE, BAISSE])])]);
    expect(mixte).toContain("Mixte");
    const nonConcerne = html([
      candidat("a", [prop("a", [{ ...HAUSSE, cibles: [{ champ: "tranche_age", valeurs: ["65_plus"] }] }])]),
    ]);
    expect(nonConcerne).toContain("Non concerné");
  });

  it("sans effets (anciennes données) : pas de badge, et l'explication est donnée", () => {
    const rendu = html([candidat("a", [prop("a", undefined)])]);
    expect(rendu).toContain("Pas de projection");
    expect(rendu).toContain("pas encore disponible");
    // La légende montre les quatre niveaux une fois : aucun badge en plus dans les cards.
    expect((rendu.match(/niveau--/g) ?? []).length).toBe(4);
  });

  it("affiche la synthèse puis les sources citées « nom · année », cliquables", () => {
    const mesure = prop("a", [HAUSSE]);
    const synthese: SyntheseTheme = {
      theme: "fiscalite",
      texte: "Le programme prévoit une aide mensuelle.",
      propositions: [mesure.id],
      date_derniere_verification: "2026-09-24",
    };
    const rendu = html([candidat("a", [mesure], [synthese])]);
    expect(rendu).toContain("Le programme prévoit une aide mensuelle.");
    expect(rendu).toContain(">a.fr · 2021</a>");
    expect(rendu).toContain('href="https://a.fr/p"');
    expect(rendu).toContain('rel="noopener noreferrer"');
    expect(rendu.indexOf("Le programme prévoit une aide mensuelle.")).toBeLessThan(rendu.indexOf("a.fr · 2021"));
  });

  it("explique l'indicateur : mesure, effet et extrait de source", () => {
    const rendu = html([candidat("a", [prop("a", [BAISSE])])]);
    expect(rendu).toContain("Pourquoi cet indicateur ?");
    expect(rendu).toContain("Revenu disponible en baisse");
    expect(rendu).toContain("une contribution sur les revenus");
  });

  it("nomme les candidats sans mesure sur le thème plutôt que de les omettre", () => {
    const rendu = html([candidat("a", [prop("a", [HAUSSE])]), candidat("b", [prop("b", [HAUSSE], "retraites")])]);
    expect(rendu).toContain("Aucune mesure analysée sur ce thème : Nom b.");
  });

  it("annonce un thème sans aucun programme analysé comme en cours d'analyse", () => {
    const rendu = html([candidat("a", [prop("a", [HAUSSE])])]);
    expect(rendu).toContain("Ce thème est en cours d&#x27;analyse"); // l'apostrophe est échappée en HTML
  });

  it("explique les quatre niveaux dans la légende, sans score global", () => {
    const rendu = html([]);
    for (const libelle of ["Améliorant", "Mixte", "Non concerné", "Dégradant"]) expect(rendu).toContain(libelle);
    expect(rendu).toContain("pas de score global");
  });

  it("rend les listes de candidats et de mesures repliables, sans JavaScript", () => {
    const rendu = html([candidat("a", [prop("a", [HAUSSE])])]);
    expect(rendu).toContain("<details");
    expect(rendu).toContain("<summary");
  });
});
