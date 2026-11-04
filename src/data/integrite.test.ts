import { describe, expect, it } from "vitest";
import { chargerIntegrites, constatIntegrite, fusionnerCasier, INTEGRITES, validerIntegrite, type CasierPolitique, type Integrite } from "./integrite";

const casierTest: CasierPolitique = {
  date: "2026-11-04",
  candidats: {
    x: {
      fiche: "https://casier-politique.fr/p/Q1_X",
      affaires: [
        { annee: 2023, affaire: "Affaire Cimade à Mayotte", recours: "definitif", prison_mois: 0, prison_avec_sursis_mois: 0, amende_euros: 500, ineligibilite_mois: 0 },
        { annee: 2020, affaire: "Affaire Jeanne / Riwal", recours: "appel", prison_mois: 12, prison_avec_sursis_mois: 6, amende_euros: 0, ineligibilite_mois: 24 },
      ],
    },
  },
};

describe("fusionnerCasier (décision du 2026-11-04)", () => {
  it("crée un fichier pour un candidat sans recensement : année seule, une source, recours repris du site", () => {
    const fusion = fusionnerCasier({}, casierTest);
    expect(validerIntegrite(fusion.x)).toEqual([]);
    const [definitive, enAppel] = fusion.x.condamnations_definitives;
    expect(definitive).toMatchObject({ origine: "casier-politique", date_decision: "2023", peine: "amende 500 €" });
    expect(definitive.statut).toBeUndefined();
    expect(enAppel).toMatchObject({ statut: "non_definitive", peine: "prison 12 mois dont 6 avec sursis, inéligibilité 24 mois" });
    expect(enAppel.recours).toContain("appel");
    expect(constatIntegrite(fusion.x).etat).toBe("recensee");
  });

  it("n'ajoute pas une affaire déjà recensée à la main (même nom propre dans la nature)", () => {
    const manuel: Integrite = {
      slug: "x",
      verifie_le: "2026-10-05",
      sources_consultees: [{ type: "secondaire", nom: "S", annee: 2026, url: "https://exemple.fr" }],
      condamnations_definitives: [
        { nature: "Diffamation publique envers La Cimade", juridiction: "Cour de cassation", date_decision: "2025-12-16", peine: "500 euros", statut: "non_definitive", recours: "r", sources: [{ type: "secondaire", nom: "A", annee: 2025, url: "https://a.fr" }, { type: "secondaire", nom: "B", annee: 2025, url: "https://b.fr" }] },
      ],
    };
    const fusion = fusionnerCasier({ x: manuel }, casierTest);
    expect(fusion.x.condamnations_definitives.map((c) => c.nature)).toEqual(["Diffamation publique envers La Cimade", "Affaire Jeanne / Riwal"]);
  });

  it("garde les règles strictes hors casier : année seule refusée sans origine", () => {
    const strict = { slug: "x", verifie_le: "2026-10-05", sources_consultees: [{ type: "secondaire", nom: "S", annee: 2026, url: "https://e.fr" }], condamnations_definitives: [{ nature: "n", juridiction: "j", date_decision: "2023", peine: "p", sources: [{ type: "secondaire", nom: "A", annee: 2025, url: "https://a.fr" }] }] };
    expect(validerIntegrite(strict).length).toBeGreaterThan(0);
  });
});

const src = (type: "primaire" | "secondaire" = "primaire") => ({ type, nom: "Legifrance", annee: 2026, url: "https://www.legifrance.gouv.fr/x" });
const condamnation = () => ({ nature: "nature", juridiction: "Cour de cassation", date_decision: "2025-06-10", peine: "peine", sources: [src("primaire"), src("secondaire")] });
const valide = (): Integrite => ({ slug: "x", verifie_le: "2026-09-29", sources_consultees: [src()], condamnations_definitives: [] });

describe("validerIntegrite", () => {
  it("accepte un fichier complet, avec ou sans condamnation", () => {
    expect(validerIntegrite(valide())).toEqual([]);
    expect(validerIntegrite({ ...valide(), condamnations_definitives: [condamnation()] })).toEqual([]);
  });
  it("refuse un fichier sans source consultée : rien ne prouve la vérification", () => {
    expect(validerIntegrite({ ...valide(), sources_consultees: [] }).length).toBeGreaterThan(0);
  });
  it("refuse une date de vérification absente ou mal formée", () => {
    expect(validerIntegrite({ ...valide(), verifie_le: "" }).length).toBeGreaterThan(0);
    expect(validerIntegrite({ ...valide(), verifie_le: "29/09/2026" }).length).toBeGreaterThan(0);
  });
  it("refuse une condamnation sans source, avec une seule source, ou sans source primaire", () => {
    const sans = { ...condamnation(), sources: [] };
    const une = { ...condamnation(), sources: [src("primaire")] };
    const aucunePrimaire = { ...condamnation(), sources: [src("secondaire"), src("secondaire")] };
    for (const c of [sans, une, aucunePrimaire]) {
      expect(validerIntegrite({ ...valide(), condamnations_definitives: [c] }).length).toBeGreaterThan(0);
    }
  });
  it("recours en cours : accepté avec deux sources secondaires et un recours décrit, refusé sans recours ni avec une seule source", () => {
    const enCours = { ...condamnation(), statut: "non_definitive" as const, recours: "pourvoi en cassation formé", sources: [src("secondaire"), src("secondaire")] };
    expect(validerIntegrite({ ...valide(), condamnations_definitives: [enCours] })).toEqual([]);
    expect(validerIntegrite({ ...valide(), condamnations_definitives: [{ ...enCours, recours: "" }] }).length).toBeGreaterThan(0);
    expect(validerIntegrite({ ...valide(), condamnations_definitives: [{ ...enCours, sources: [src("secondaire")] }] }).length).toBeGreaterThan(0);
    expect(validerIntegrite({ ...valide(), condamnations_definitives: [{ ...condamnation(), statut: "autre" }] }).length).toBeGreaterThan(0);
  });
  it("refuse une source sans URL http(s), sans nom ou sans année", () => {
    for (const mauvaise of [{ ...src(), url: "legifrance" }, { ...src(), nom: "" }, { ...src(), annee: "2026" }]) {
      expect(validerIntegrite({ ...valide(), sources_consultees: [mauvaise] }).length).toBeGreaterThan(0);
    }
  });
  it("refuse une condamnation sans date de décision ou sans nature", () => {
    expect(validerIntegrite({ ...valide(), condamnations_definitives: [{ ...condamnation(), date_decision: "" }] }).length).toBeGreaterThan(0);
    expect(validerIntegrite({ ...valide(), condamnations_definitives: [{ ...condamnation(), nature: "" }] }).length).toBeGreaterThan(0);
  });
  it("refuse une date impossible ou dans le futur (vérification comme décision)", () => {
    for (const date of ["2026-13-45", "2026-02-30", "2999-01-01"]) {
      expect(validerIntegrite({ ...valide(), verifie_le: date }).length, `verifie_le ${date}`).toBeGreaterThan(0);
      expect(validerIntegrite({ ...valide(), condamnations_definitives: [{ ...condamnation(), date_decision: date }] }).length, `date_decision ${date}`).toBeGreaterThan(0);
    }
  });
  it("accepte la date du jour et une date bissextile", () => {
    const aujourdhui = new Date("2026-09-30T12:00:00Z");
    expect(validerIntegrite({ ...valide(), verifie_le: "2026-09-30" }, aujourdhui)).toEqual([]);
    expect(validerIntegrite({ ...valide(), verifie_le: "2024-02-29" }, aujourdhui)).toEqual([]);
  });
  it("refuse tout ce qui n'est pas un objet", () => {
    for (const brut of [null, "x", 3, []]) expect(validerIntegrite(brut).length).toBeGreaterThan(0);
  });
});

describe("constatIntegrite", () => {
  it("sans fichier : non vérifié, jamais « aucune condamnation »", () => {
    expect(constatIntegrite(undefined)).toEqual({ etat: "non_verifie" });
  });
  it("fichier vide de condamnations mais sans sources : non vérifié", () => {
    expect(constatIntegrite({ ...valide(), sources_consultees: [] }).etat).toBe("non_verifie");
  });
  it("aucune condamnation avec sources et date : aucune recensée, datée", () => {
    expect(constatIntegrite(valide())).toMatchObject({ etat: "aucune_recensee", verifieLe: "2026-09-29" });
  });
  it("condamnation définitive : recensée, avec ses détails", () => {
    const c = constatIntegrite({ ...valide(), condamnations_definitives: [condamnation()] });
    expect(c).toMatchObject({ etat: "recensee", verifieLe: "2026-09-29" });
    if (c.etat === "recensee") expect(c.condamnations).toHaveLength(1);
  });
});

describe("chargerIntegrites", () => {
  it("garde les fichiers valides dont le slug est le nom du fichier", () => {
    const charges = chargerIntegrites({ "../../data/integrite/x.json": { default: valide() } });
    expect(Object.keys(charges)).toEqual(["x"]);
  });
  it("écarte un fichier invalide ou dont le slug diffère du nom du fichier", () => {
    const charges = chargerIntegrites({
      "../../data/integrite/y.json": { default: valide() }, // slug interne « x » ≠ « y »
      "../../data/integrite/x.json": { default: { ...valide(), sources_consultees: [] } },
    });
    expect(charges).toEqual({});
  });
});

describe("données réelles", () => {
  it("aucun fichier de data/integrite n'est ignoré en silence (invalide ou slug différent du nom de fichier)", () => {
    const bruts = import.meta.glob("../../data/integrite/*.json", { eager: true }) as Record<string, { default: unknown }>;
    expect(Object.keys(INTEGRITES).sort()).toEqual(Object.keys(bruts).map((c) => c.split("/").pop()!.replace(/\.json$/, "")).sort());
  });
  it("tous les fichiers de data/integrite sont valides (le dossier peut être vide)", () => {
    for (const [slug, integrite] of Object.entries(INTEGRITES)) {
      expect(validerIntegrite(integrite), slug).toEqual([]);
    }
  });
});
