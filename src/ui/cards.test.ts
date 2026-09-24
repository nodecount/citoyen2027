import { describe, expect, it } from "vitest";
import type { Effet } from "../effets";
import type { CandidatCharge } from "../data/chargerCandidats";
import type { Profil, Proposition, SyntheseTheme, Theme } from "../types";
import { construireCards } from "./cards";

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
  { id: "fiscalite", libelle: "Mes impôts et taxes", question_citoyen: "Q1 ?", description: "d", statut: "populated" },
  { id: "retraites", libelle: "Ma retraite", question_citoyen: "Q2 ?", description: "d", statut: "provisoire" },
];

const HAUSSE: Effet = { cibles: [], dimension: "revenu_disponible", sens: "hausse", source_url: "https://a.fr/1", extrait: "extrait suffisamment long" };
const BAISSE: Effet = { ...HAUSSE, sens: "baisse" };

function prop(candidat: string, theme: string, effets: Effet[] | undefined, statut: Proposition["statut"] = "complet"): Proposition {
  return {
    id: `${candidat}-${theme}-001`,
    candidat,
    theme,
    titre: `Mesure ${candidat}`,
    resume_factuel: "Résumé",
    sources: [{ type: "primaire", label: "Site", url: `https://${candidat}.fr/p`, nom: candidat, annee: 2026 }],
    chiffrage_disponible: false,
    hypotheses_calcul: "",
    statut,
    date_derniere_verification: "2026-09-24",
    effets,
  };
}

function candidat(slug: string, propositions: Proposition[], syntheses: SyntheseTheme[] = []): CandidatCharge {
  return {
    meta: { slug, nom: slug.toUpperCase(), parti: "P", sources_officielles: [], date_derniere_maj: "2026-09-24" },
    propositions,
    syntheses,
  };
}

describe("construireCards", () => {
  it("produit une card par thème, dans l'ordre du référentiel", () => {
    const cards = construireCards(THEMES, [candidat("a", [prop("a", "fiscalite", [HAUSSE])])], PROFIL);
    expect(cards.map((c) => c.theme.id)).toEqual(["fiscalite", "retraites"]);
  });

  it("range les candidats par ordre alphabétique de slug, jamais selon leur indicateur", () => {
    const cards = construireCards(
      THEMES,
      [
        candidat("z", [prop("z", "fiscalite", [HAUSSE])]),
        candidat("b", [prop("b", "fiscalite", [BAISSE])]),
        candidat("m", [prop("m", "fiscalite", [HAUSSE])]),
      ],
      PROFIL,
    );
    expect(cards[0].lignes.map((l) => l.meta.slug)).toEqual(["b", "m", "z"]);
    expect(cards[0].lignes.map((l) => l.projection.niveau)).toEqual(["degradant", "ameliorant", "ameliorant"]);
  });

  it("ne range un candidat que dans les thèmes où il a des mesures affichables, et nomme les autres comme absents", () => {
    const cards = construireCards(
      THEMES,
      [candidat("a", [prop("a", "fiscalite", [HAUSSE])]), candidat("b", [prop("b", "retraites", [BAISSE])])],
      PROFIL,
    );
    const fiscalite = cards.find((c) => c.theme.id === "fiscalite")!;
    expect(fiscalite.lignes.map((l) => l.meta.slug)).toEqual(["a"]);
    expect(fiscalite.absents.map((m) => m.slug)).toEqual(["b"]);
  });

  it("marque « en cours d'analyse » un thème où aucun candidat n'a de mesure", () => {
    const cards = construireCards(THEMES, [candidat("a", [prop("a", "fiscalite", [HAUSSE])])], PROFIL);
    expect(cards[0].enCoursAnalyse).toBe(false);
    expect(cards[1].enCoursAnalyse).toBe(true);
    expect(cards[1].lignes).toEqual([]);
  });

  it("ignore les mesures provisoires : recherche inachevée", () => {
    const cards = construireCards(THEMES, [candidat("a", [prop("a", "fiscalite", [HAUSSE], "provisoire")])], PROFIL);
    expect(cards[0].lignes).toEqual([]);
    expect(cards[0].enCoursAnalyse).toBe(true);
  });

  it("calcule l'indicateur pour le profil, sans badge pour les mesures sans effets (anciennes données)", () => {
    const cards = construireCards(THEMES, [candidat("a", [prop("a", "fiscalite", undefined)])], PROFIL);
    expect(cards[0].lignes[0].projection.niveau).toBeNull();
    expect(cards[0].lignes[0].messagesSansBadge.length).toBeGreaterThan(0);
  });

  it("n'attache la synthèse que si elle couvre exactement les mesures actuelles du thème", () => {
    const mesure = prop("a", "fiscalite", [HAUSSE]);
    const aJour: SyntheseTheme = { theme: "fiscalite", texte: "T", propositions: [mesure.id], date_derniere_verification: "2026-09-24" };
    const perimee: SyntheseTheme = { ...aJour, propositions: ["autre-id"] };
    expect(construireCards(THEMES, [candidat("a", [mesure], [aJour])], PROFIL)[0].lignes[0].synthese).toEqual(aJour);
    expect(construireCards(THEMES, [candidat("a", [mesure], [perimee])], PROFIL)[0].lignes[0].synthese).toBeNull();
  });

  it("construit la liste des sources depuis les mesures du thème, formatée « nom · année »", () => {
    const cards = construireCards(THEMES, [candidat("a", [prop("a", "fiscalite", [HAUSSE])])], PROFIL);
    expect(cards[0].lignes[0].sources).toEqual([{ texte: "a · 2026", url: "https://a.fr/p" }]);
  });
});
