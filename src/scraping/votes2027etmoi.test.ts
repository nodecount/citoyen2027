import { describe, expect, it } from "vitest";
import { LONGUEUR_MAX_ARTICLE } from "../votes/conversion";
import type { Theme } from "../types";
import { classerScrutins, convertirVotes, LONGUEUR_MAX_LOI, restreindreAuxCandidats, retenirScrutins, type ScrutinSource, type TexteLoi } from "./votes2027etmoi";

function scrutin(surcharge: Partial<ScrutinSource> = {}): ScrutinSource {
  return {
    id: "an-15-351",
    chambre: "AN",
    date: "2017-12-19T00:00:00+01:00",
    titre: "L'ensemble du projet de loi relatif à l'orientation et à la réussite des étudiants (première lecture).",
    type: "solennel",
    resultat: "adopté",
    url: "https://www.assemblee-nationale.fr/dyn/15/scrutins/351",
    votes: { melenchon: "contre", "le-pen": "pour", attal: "abstention", faure: "absent", lisnard: "non_votant" },
    ...surcharge,
  };
}

const THEMES: Theme[] = [
  { id: "education", libelle: "Mes études", question_citoyen: "Que propose chaque candidat pour les études ?", description: "Études", statut: "populated" },
  { id: "retraites", libelle: "Ma retraite", question_citoyen: "Que propose chaque candidat pour la retraite ?", description: "Retraites", statut: "populated" },
];

describe("retenirScrutins", () => {
  it("garde les scrutins de l'Assemblée et du Sénat qui portent sur un texte", () => {
    const ids = retenirScrutins([scrutin(), scrutin({ id: "senat-1", chambre: "SENAT", type: "ensemble" })]).map((s) => s.id);
    expect(ids).toEqual(["an-15-351", "senat-1"]);
  });

  it("écarte le Parlement européen, les motions de censure et les propositions de résolution", () => {
    const retenus = retenirScrutins([
      scrutin({ id: "pe-1", chambre: "PE", type: "appel_nominal" }),
      scrutin({ id: "mc-1", type: "motion_censure", titre: "La motion de censure, déposée en application de l'article 49." }),
      scrutin({ id: "res-1", titre: "La proposition de résolution affirmant le soutien de l'Assemblée nationale à l'Ukraine." }),
    ]);
    expect(retenus).toEqual([]);
  });

  it("applique la même règle à tous : aucun candidat n'entre dans sa signature", () => {
    expect(retenirScrutins.length).toBe(1);
  });
});

describe("classerScrutins", () => {
  it("rattache chaque scrutin au thème choisi par le modèle", async () => {
    const carte = await classerScrutins([scrutin()], THEMES, async () => ({ "an-15-351": "education" }));
    expect(carte.get("an-15-351")).toBe("education");
  });

  it("écarte un scrutin dont le thème est « aucun », inconnu de la base, ou absent de la réponse", async () => {
    const scrutins = [scrutin({ id: "a" }), scrutin({ id: "b" }), scrutin({ id: "c" })];
    const carte = await classerScrutins(scrutins, THEMES, async () => ({ a: "aucun", b: "theme-inexistant" }));
    expect([...carte.keys()]).toEqual([]);
  });
});

describe("convertirVotes", () => {
  const texte: TexteLoi = { texte: "Article 1er. Les inscriptions sont organisées par une plateforme nationale.", url: "https://www.assemblee-nationale.fr/dyn/15/textes/l15t0000_texte-adopte-seance", libelle: "T.A. n° 100" };
  const noms = { melenchon: "Jean-Luc Mélenchon", "le-pen": "Marine Le Pen", attal: "Gabriel Attal", faure: "Olivier Faure", lisnard: "David Lisnard" };
  const themes = new Map([["an-15-351", "education"]]);
  const textes = new Map<string, TexteLoi | null>([["an-15-351", texte]]);
  const convertir = (textesUtilises = textes) => convertirVotes([scrutin()], themes, textesUtilises, noms, "2026-11-06");

  it("crée une proposition par vote pour ou contre, et rien pour abstention, absence ou non-votant", () => {
    const { parCandidat, rapport } = convertir();
    expect([...parCandidat.keys()].sort()).toEqual(["le-pen", "melenchon"]);
    expect(parCandidat.get("melenchon")![0].vote).toBe("contre");
    expect(parCandidat.get("le-pen")![0].vote).toBe("pour");
    expect(rapport).toEqual({ propositions: 2, sansTexte: 0, ignores: 3 });
  });

  it("donne un identifiant unique par candidat et par scrutin, dans le thème choisi", () => {
    const { parCandidat } = convertir();
    expect(parCandidat.get("melenchon")![0].id).toBe("melenchon-education-an-15-351");
    expect(parCandidat.get("melenchon")![0].theme).toBe("education");
    expect(parCandidat.get("melenchon")![0].candidat).toBe("melenchon");
  });

  it("décrit le texte de la même façon pour un pour et un contre, sans mentionner le vote", () => {
    const { parCandidat } = convertir();
    const contre = parCandidat.get("melenchon")![0];
    const pour = parCandidat.get("le-pen")![0];
    expect(contre.resume_factuel).toBe(pour.resume_factuel);
    expect(contre.resume_factuel).toContain("plateforme nationale");
    expect(contre.resume_factuel).not.toMatch(/a vot[ée]/);
  });

  it("tronque une loi trop longue à la fenêtre prévue pour une loi (plus large que celle d'un article) et le dit dans l'hypothèse", () => {
    const long: TexteLoi = { ...texte, texte: "Phrase. ".repeat(5000) };
    const { parCandidat } = convertir(new Map([["an-15-351", long]]));
    const p = parCandidat.get("le-pen")![0];
    expect(LONGUEUR_MAX_LOI).toBeGreaterThan(LONGUEUR_MAX_ARTICLE);
    expect(p.resume_factuel.length).toBeLessThanOrEqual(LONGUEUR_MAX_LOI);
    expect(p.resume_factuel.length).toBeGreaterThan(LONGUEUR_MAX_ARTICLE);
    expect(p.hypotheses_calcul).toContain(`tronqué à ${LONGUEUR_MAX_LOI} caractères`);
  });

  it("attribue le vote au candidat lui-même, daté, avec deux sources primaires", () => {
    const { parCandidat } = convertir();
    const p = parCandidat.get("melenchon")![0];
    expect(p.titre).toBe("Jean-Luc Mélenchon a voté contre l'ensemble du projet de loi relatif à l'orientation et à la réussite des étudiants (première lecture), le 19 décembre 2017.");
    expect(p.sources.map((s) => s.type)).toEqual(["primaire", "primaire"]);
    expect(p.sources[0].url).toBe("https://www.assemblee-nationale.fr/dyn/15/scrutins/351");
    expect(p.sources[1].url).toBe(texte.url);
    expect(p.sources[0].annee).toBe(2017);
    expect(p.hypotheses_calcul).toContain("pas un engagement");
  });

  it("explique qu'un vote contre ne propose pas l'effet inverse", () => {
    const { parCandidat } = convertir();
    expect(parCandidat.get("melenchon")![0].hypotheses_calcul).toMatch(/refuser un effet n'est pas proposer l'effet inverse/);
    expect(parCandidat.get("le-pen")![0].hypotheses_calcul).not.toMatch(/refuser un effet/);
  });

  it("garde la mesure sans texte : le titre du scrutin sert de résumé, une seule source, comptée à part", () => {
    const { parCandidat, rapport } = convertir(new Map([["an-15-351", null]]));
    const p = parCandidat.get("melenchon")![0];
    expect(p.resume_factuel).toBe(scrutin().titre);
    expect(p.sources).toHaveLength(1);
    expect(rapport.sansTexte).toBe(2);
  });

  it("ignore un scrutin sans thème et un candidat dont le nom est inconnu", () => {
    const sansTheme = convertirVotes([scrutin()], new Map(), textes, noms, "2026-11-06");
    expect(sansTheme.parCandidat.size).toBe(0);
    const sansNom = convertirVotes([scrutin()], themes, textes, { "le-pen": "Marine Le Pen" }, "2026-11-06");
    expect([...sansNom.parCandidat.keys()]).toEqual(["le-pen"]);
  });
});

describe("restreindreAuxCandidats", () => {
  const scrutins = [
    scrutin({ id: "a", votes: { melenchon: "contre", "le-pen": "pour" } }),
    scrutin({ id: "b", votes: { melenchon: "absent", "le-pen": "pour" } }),
    scrutin({ id: "c", votes: { attal: "pour" } }),
  ];

  it("sans liste, ne touche à rien", () => {
    expect(restreindreAuxCandidats(scrutins, undefined)).toEqual(scrutins);
  });

  it("ne garde que les votes des candidats demandés, et les scrutins où l'un d'eux a voté pour ou contre", () => {
    const restreints = restreindreAuxCandidats(scrutins, ["melenchon"]);
    expect(restreints.map((s) => s.id)).toEqual(["a"]);
    expect(restreints[0].votes).toEqual({ melenchon: "contre" });
  });

  it("n'invente rien pour un candidat sans vote : aucun scrutin", () => {
    expect(restreindreAuxCandidats(scrutins, ["lisnard"])).toEqual([]);
  });
});
