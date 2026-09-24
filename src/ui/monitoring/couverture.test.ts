import { describe, expect, it } from "vitest";
import { calculerCouverture, extraireSlug } from "./couverture";
import type { CandidatMeta, Proposition, Theme } from "../../types";
import type { EntreeAVerifier } from "../../ingestion/depot";

const THEMES: Theme[] = [
  { id: "fiscalite", libelle: "Fiscalité", question_citoyen: "", description: "", projetable: true, statut: "populated" },
  { id: "sante", libelle: "Santé", question_citoyen: "", description: "", projetable: true, statut: "populated" },
];

function proposition(overrides: Partial<Proposition> = {}): Proposition {
  return {
    id: "test-001",
    candidat: "test",
    theme: "fiscalite",
    titre: "Titre",
    resume_factuel: "Résumé",
    sources: [],
    chiffrage_disponible: false,
    hypotheses_calcul: "",
    statut: "complet",
    date_derniere_verification: "2026-09-18",
    ...overrides,
  };
}

describe("extraireSlug", () => {
  it("extrait le slug du chemin d'un module glob", () => {
    expect(extraireSlug("/data/programmes/le-pen/meta.json")).toBe("le-pen");
  });

  it("retourne le chemin tel quel si le motif ne correspond pas", () => {
    expect(extraireSlug("chemin-invalide.json")).toBe("chemin-invalide.json");
  });
});

describe("calculerCouverture", () => {
  const META: CandidatMeta = {
    slug: "test",
    nom: "Candidat Test",
    parti: "Parti Test",
    sources_officielles: [],
    date_derniere_maj: "2026-09-01",
  };

  it("compte les propositions par thème et par statut", () => {
    const resultat = calculerCouverture(
      THEMES,
      { test: META },
      { test: [proposition({ statut: "complet" }), proposition({ statut: "partiel", id: "test-002" })] },
      {},
    );
    const candidat = resultat.find((c) => c.slug === "test")!;
    const themeFiscalite = candidat.parTheme.find((t) => t.themeId === "fiscalite")!;
    expect(themeFiscalite.parStatut).toEqual({ complet: 1, partiel: 1, provisoire: 0 });
    const themeSante = candidat.parTheme.find((t) => t.themeId === "sante")!;
    expect(themeSante.parStatut).toEqual({ complet: 0, partiel: 0, provisoire: 0 });
  });

  it("retient la date de vérification la plus récente par thème", () => {
    const resultat = calculerCouverture(
      THEMES,
      { test: META },
      {
        test: [
          proposition({ date_derniere_verification: "2026-09-10", id: "test-001" }),
          proposition({ date_derniere_verification: "2026-09-18", id: "test-002" }),
        ],
      },
      {},
    );
    const candidat = resultat.find((c) => c.slug === "test")!;
    expect(candidat.parTheme.find((t) => t.themeId === "fiscalite")!.dateVerificationRecente).toBe("2026-09-18");
  });

  it("retourne null pour dateVerificationRecente si aucune proposition sur ce thème", () => {
    const resultat = calculerCouverture(THEMES, { test: META }, { test: [] }, {});
    const candidat = resultat.find((c) => c.slug === "test")!;
    expect(candidat.parTheme.find((t) => t.themeId === "sante")!.dateVerificationRecente).toBeNull();
  });

  it("inclut le contenu en attente de relecture par candidat", () => {
    const entree: EntreeAVerifier = {
      theme: "fiscalite",
      proposition: {
        titre: "Titre rejeté",
        resume_factuel: "x",
        sources: [],
        chiffrage_disponible: false,
        hypotheses_calcul: "",
        statut: "complet",
        date_derniere_verification: "2026-09-18",
      },
      raison: "test",
    };
    const resultat = calculerCouverture(THEMES, { test: META }, {}, { test: [entree] });
    expect(resultat.find((c) => c.slug === "test")!.enAttente).toEqual([entree]);
  });

  it("gère un candidat sans propositions.json ni _a-verifier.json (seulement meta.json)", () => {
    const resultat = calculerCouverture(THEMES, { test: META }, {}, {});
    expect(resultat).toHaveLength(1);
    expect(resultat[0].enAttente).toEqual([]);
  });

  it("trie les candidats par slug", () => {
    const resultat = calculerCouverture(
      THEMES,
      { zebre: { ...META, slug: "zebre" }, alpha: { ...META, slug: "alpha" } },
      {},
      {},
    );
    expect(resultat.map((c) => c.slug)).toEqual(["alpha", "zebre"]);
  });
});
