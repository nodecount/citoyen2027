import { describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { gererRelance, validerRequeteRelance } from "./serveur-local";
import { chargerPropositions } from "./depot";
import type { CandidatMeta } from "../types";
import type { ClientAnthropicMinimal } from "./generate";

const META: CandidatMeta = {
  slug: "candidat-x",
  nom: "Candidat X",
  parti: "Parti X",
  date_derniere_maj: "2026-09-18",
  sources_officielles: [{ type: "primaire", label: "Programme", url: "https://exemple-officiel.fr/programme" }],
};

function preparerRacine(): string {
  const racine = mkdtempSync(resolve(tmpdir(), "monitoring-serveur-test-"));
  mkdirSync(resolve(racine, "candidat-x"), { recursive: true });
  writeFileSync(resolve(racine, "candidat-x/meta.json"), JSON.stringify(META));
  return racine;
}

function clientFactice(reponseGeneration: unknown, reponseVerification: unknown): ClientAnthropicMinimal {
  return {
    messages: {
      create: vi
        .fn()
        .mockResolvedValueOnce({ content: [{ type: "text", text: JSON.stringify(reponseGeneration) }] })
        .mockResolvedValueOnce({ content: [{ type: "text", text: JSON.stringify(reponseVerification) }] }),
    },
  };
}

describe("gererRelance", () => {
  it("mode insert : génère et fusionne une combinaison non couverte", async () => {
    const racine = preparerRacine();
    try {
      const proposition = {
        titre: "Titre",
        resume_factuel: "Résumé",
        sources: [
          { type: "primaire", label: "A", url: "https://exemple-officiel.fr/a" },
          { type: "primaire", label: "B", url: "https://exemple-officiel.fr/b" },
        ],
        chiffrage_disponible: false,
        hypotheses_calcul: "",
        statut: "complet",
        date_derniere_verification: "2026-09-18",
        effets: [],
      };
      const client = clientFactice([proposition], [{ titre: "Titre", verdict: "PASS" }]);
      const fetchFactice = async () => new Response("contenu de la page");

      const resultat = await gererRelance(
        { slug: "candidat-x", themes: ["fiscalite"], mode: "insert", cleApi: "cle-test" },
        { racine, fetchImpl: fetchFactice, fabriquerClient: () => client },
      );

      expect(resultat.ok).toBe(true);
      expect(resultat.resultats).toEqual([{ theme: "fiscalite", statut: "traite", fusionnees: 1, enAttente: 0 }]);
      expect(chargerPropositions("candidat-x", racine)).toHaveLength(1);
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it("mode insert : saute une combinaison déjà couverte", async () => {
    const racine = preparerRacine();
    try {
      const propositionExistante = {
        id: "candidat-x-fisc-001",
        candidat: "candidat-x",
        theme: "fiscalite",
        titre: "Déjà là",
        resume_factuel: "x",
        sources: [],
        chiffrage_disponible: false,
        hypotheses_calcul: "",
        statut: "complet",
        date_derniere_verification: "2026-09-18",
        effets: [],
      };
      writeFileSync(resolve(racine, "candidat-x/propositions.json"), JSON.stringify([propositionExistante]));
      const create = vi.fn();

      const resultat = await gererRelance(
        { slug: "candidat-x", themes: ["fiscalite"], mode: "insert", cleApi: "cle-test" },
        { racine, fabriquerClient: () => ({ messages: { create } }) },
      );

      expect(create).not.toHaveBeenCalled();
      expect(resultat.resultats).toEqual([{ theme: "fiscalite", statut: "saute" }]);
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it("isole les erreurs par thème sans interrompre les thèmes suivants", async () => {
    const racine = preparerRacine();
    try {
      const create = vi.fn().mockRejectedValue(new Error("panne réseau"));
      const resultat = await gererRelance(
        { slug: "candidat-x", themes: ["fiscalite", "sante"], mode: "insert", cleApi: "cle-test" },
        { racine, fabriquerClient: () => ({ messages: { create } }) },
      );
      expect(resultat.ok).toBe(false);
      expect(resultat.resultats).toEqual([
        { theme: "fiscalite", statut: "erreur", message: "panne réseau" },
        { theme: "sante", statut: "erreur", message: "panne réseau" },
      ]);
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it("mode update : appelle executerRefresh et ne modifie jamais propositions.json directement", async () => {
    const racine = preparerRacine();
    try {
      const propositionExistante = {
        id: "candidat-x-fisc-001",
        candidat: "candidat-x",
        theme: "fiscalite",
        titre: "Titre",
        resume_factuel: "Résumé",
        sources: [
          { type: "primaire", label: "A", url: "https://exemple-officiel.fr/a" },
          { type: "primaire", label: "B", url: "https://exemple-officiel.fr/b" },
        ],
        chiffrage_disponible: false,
        hypotheses_calcul: "",
        statut: "complet",
        date_derniere_verification: "2026-09-01",
        effets: [],
      };
      writeFileSync(resolve(racine, "candidat-x/propositions.json"), JSON.stringify([propositionExistante]));
      // executerRefresh n'appelle que genererPropositions (une seule passe, pas de vérification
      // sémantique — limite connue et assumée du pipeline, voir la spec d'ingestion), donc un
      // seul appel au client est réellement consommé ici ; le second argument de clientFactice
      // ne sert qu'à respecter sa signature et n'est jamais lu.
      const client = clientFactice([{ ...propositionExistante, date_derniere_verification: "2026-09-18" }], []);

      const resultat = await gererRelance(
        { slug: "candidat-x", themes: ["fiscalite"], mode: "update", cleApi: "cle-test" },
        { racine, fabriquerClient: () => client },
      );

      expect(resultat.resultats).toEqual([{ theme: "fiscalite", statut: "traite", divergence: false }]);
      expect(chargerPropositions("candidat-x", racine)).toEqual([propositionExistante]);
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });
});

describe("validerRequeteRelance", () => {
  const VALIDE = { slug: "candidat-x", cleApi: "cle-test", themes: ["fiscalite"], mode: "insert" };

  it("accepte un corps valide et retourne l'objet RequeteRelance", () => {
    expect(validerRequeteRelance(VALIDE)).toEqual({
      slug: "candidat-x",
      cleApi: "cle-test",
      themes: ["fiscalite"],
      mode: "insert",
    });
  });

  it("rejette une cleApi vide (repli silencieux sur .env interdit)", () => {
    expect(validerRequeteRelance({ ...VALIDE, cleApi: "" })).toBeNull();
  });

  it("rejette un slug tentant une traversée de répertoire", () => {
    expect(validerRequeteRelance({ ...VALIDE, slug: "../../etc" })).toBeNull();
  });

  it("rejette des themes qui ne sont pas un tableau", () => {
    expect(validerRequeteRelance({ ...VALIDE, themes: "pas-un-tableau" })).toBeNull();
  });

  it("rejette un mode inconnu", () => {
    expect(validerRequeteRelance({ ...VALIDE, mode: "supprimer" })).toBeNull();
  });
});
