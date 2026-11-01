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

function candidat(slug: string, propositions: Proposition[], syntheses: SyntheseTheme[] = [], remarques: CandidatCharge["remarques"] = []): CandidatCharge {
  return {
    meta: { slug, nom: slug.toUpperCase(), parti: "P", sources_officielles: [], date_derniere_maj: "2026-09-24" },
    propositions,
    syntheses,
    remarques,
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
    expect(cards[0].lignes.map((l) => l.projection?.niveau)).toEqual(["degradant", "ameliorant", "ameliorant"]);
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
    expect(cards[0].lignes[0].projection?.niveau).toBeNull();
    expect(cards[0].lignes[0].messagesSansBadge.length).toBeGreaterThan(0);
  });

  describe("tant que le visiteur n'a rien dit de lui", () => {
    const candidats = [candidat("a", [prop("a", "fiscalite", [HAUSSE])])]; // effet sans cible : s'appliquerait à tout le monde

    it("n'applique aucun effet : pas de projection, même pour un effet qui vise tout le monde", () => {
      for (const profil of [null, {}, { region: "", tranche_age: "  " }]) {
        const ligne = construireCards(THEMES, candidats, profil)[0].lignes[0];
        expect(ligne.projection).toBeNull();
        expect(ligne.messagesSansBadge).toEqual([]);
      }
    });

    it("garde pourtant le candidat, sa synthèse, ses mesures et ses sources : seul l'indicateur manque", () => {
      const ligne = construireCards(THEMES, candidats, null)[0].lignes[0];
      expect(ligne.propositions).toHaveLength(1);
      expect(ligne.sources).toEqual([{ texte: "a · 2026", url: "https://a.fr/p" }]);
    });

    it("calcule l'indicateur dès qu'une seule information est donnée, avec ce qu'on sait", () => {
      const ligne = construireCards(THEMES, candidats, { tranche_age: "30_49" })[0].lignes[0];
      expect(ligne.projection?.niveau).toBe("ameliorant");
    });

    it("s'affine : un effet ciblé sur un champ non répondu donne « mixte » (à préciser), puis se résout à la réponse", () => {
      const cible = { ...HAUSSE, cibles: [{ champ: "logement", valeurs: ["locataire"] }] };
      const ciblees = [candidat("a", [prop("a", "fiscalite", [cible])])];
      const sansLogement = construireCards(THEMES, ciblees, { tranche_age: "30_49" })[0].lignes[0];
      expect(sansLogement.projection?.niveau).toBe("mixte");
      expect(sansLogement.projection?.incertain).toBe(true);
      expect(sansLogement.messagesIncertitude.join(" ")).toContain("Statut de votre résidence principale");
      expect(sansLogement.messagesSansBadge).toEqual([]); // ce n'est pas une absence de badge : il y a un badge, et on explique
      expect(construireCards(THEMES, ciblees, { logement: "locataire" })[0].lignes[0].projection?.niveau).toBe("ameliorant");
      expect(construireCards(THEMES, ciblees, { logement: "proprietaire" })[0].lignes[0].projection?.niveau).toBe("non_concerne");
    });
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

  it("n'attache à chaque ligne que les remarques de SON thème", () => {
    const remarques = [
      { theme: "fiscalite", texte: "Remarque fiscalité.", mesures: [], empreinte: "e", date: "2026-09-28" },
      { theme: "retraites", texte: "Remarque retraite.", mesures: [], empreinte: "e", date: "2026-09-28" },
    ];
    const candidats = [candidat("a", [prop("a", "fiscalite", [HAUSSE]), prop("a", "retraites", [HAUSSE])], [], remarques)];
    const cards = construireCards(THEMES, candidats, PROFIL);
    expect(cards.find((c) => c.theme.id === "fiscalite")!.lignes[0].remarques).toEqual([remarques[0]]);
    expect(cards.find((c) => c.theme.id === "retraites")!.lignes[0].remarques).toEqual([remarques[1]]);
  });
});
