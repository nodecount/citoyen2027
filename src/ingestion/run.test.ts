import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { executerCombinaison, genererIdProposition, combinaisonsDiffere, executerRefresh, tirerEchantillon } from "./run";
import { chargerAVerifier, chargerPropositions, enregistrerPropositions } from "./depot";
import type { CandidatMeta } from "../types";

let racine: string;

const META: CandidatMeta = {
  slug: "candidat-x",
  nom: "Candidat X",
  parti: "Parti X",
  date_derniere_maj: "2026-09-18",
  sources_officielles: [{ type: "primaire", label: "Programme", url: "https://exemple-officiel.fr/programme" }],
};

function preparerRacine(): void {
  racine = mkdtempSync(resolve(tmpdir(), "ingestion-run-test-"));
  mkdirSync(resolve(racine, "candidat-x"), { recursive: true });
  writeFileSync(resolve(racine, "candidat-x/meta.json"), JSON.stringify(META));
}

describe("genererIdProposition", () => {
  it("produit un identifiant déterministe basé sur le slug, le thème et l'index", () => {
    expect(genererIdProposition("candidat-x", "fiscalite", 1)).toBe("candidat-x-fiscalite-001");
    expect(genererIdProposition("candidat-x", "fiscalite", 12)).toBe("candidat-x-fiscalite-012");
  });
});

describe("executerCombinaison", () => {
  afterEach(() => {
    rmSync(racine, { recursive: true, force: true });
  });

  it("fusionne les propositions PASS et met les FAIL en attente", async () => {
    preparerRacine();
    const propositionGeneree = {
      titre: "Titre",
      resume_factuel: "Résumé",
      sources: [
        { type: "primaire" as const, label: "A", url: "https://exemple-officiel.fr/a" },
        { type: "primaire" as const, label: "B", url: "https://exemple-officiel.fr/b" },
      ],
      chiffrage_disponible: false,
      hypotheses_calcul: "",
      statut: "complet" as const,
      date_derniere_verification: "2026-09-18",
    };
    const clientFactice = {
      messages: {
        create: vi
          .fn()
          .mockResolvedValueOnce({ content: [{ type: "text", text: JSON.stringify([propositionGeneree]) }] })
          .mockResolvedValueOnce({
            content: [{ type: "text", text: JSON.stringify([{ titre: "Titre", verdict: "PASS" }]) }],
          }),
      },
    };
    const fetchFactice = async () => new Response("contenu de la page");

    await executerCombinaison(
      clientFactice,
      META,
      { slug: "candidat-x", themeId: "fiscalite", themeLibelle: "Fiscalité" },
      [],
      { racine, fetchImpl: fetchFactice },
    );

    const propositionsEnregistrees = chargerPropositions("candidat-x", racine);
    expect(propositionsEnregistrees).toHaveLength(1);
    expect(propositionsEnregistrees[0].id).toBe("candidat-x-fiscalite-001");
    expect(propositionsEnregistrees[0].candidat).toBe("candidat-x");
    expect(chargerAVerifier("candidat-x", racine)).toEqual([]);
  });

  it("n'enregistre rien dans propositions.json pour une proposition qui échoue la vérification", async () => {
    preparerRacine();
    const propositionGeneree = {
      titre: "Titre invalide",
      resume_factuel: "Résumé",
      sources: [
        { type: "primaire" as const, label: "A", url: "https://domaine-non-autorise.fr/a" },
        { type: "primaire" as const, label: "B", url: "https://exemple-officiel.fr/b" },
      ],
      chiffrage_disponible: false,
      hypotheses_calcul: "",
      statut: "complet" as const,
      date_derniere_verification: "2026-09-18",
    };
    const clientFactice = {
      messages: {
        create: vi.fn().mockResolvedValue({ content: [{ type: "text", text: JSON.stringify([propositionGeneree]) }] }),
      },
    };
    const fetchFactice = async () => new Response("contenu de la page");

    await executerCombinaison(
      clientFactice,
      META,
      { slug: "candidat-x", themeId: "fiscalite", themeLibelle: "Fiscalité" },
      [],
      { racine, fetchImpl: fetchFactice },
    );

    expect(chargerPropositions("candidat-x", racine)).toEqual([]);
    expect(chargerAVerifier("candidat-x", racine)).toHaveLength(1);
  });
});

describe("combinaisonsDiffere", () => {
  it("retourne false si le contenu comparable est identique", () => {
    const existante = {
      id: "candidat-x-fiscalite-001",
      candidat: "candidat-x",
      theme: "fiscalite",
      titre: "Titre",
      resume_factuel: "Résumé",
      sources: [{ type: "primaire" as const, label: "A", url: "https://exemple-officiel.fr/a" }],
      chiffrage_disponible: false,
      hypotheses_calcul: "",
      statut: "complet" as const,
      date_derniere_verification: "2026-09-18",
    };
    const fraiche = {
      titre: "Titre",
      resume_factuel: "Résumé",
      sources: [{ type: "primaire" as const, label: "A", url: "https://exemple-officiel.fr/a" }],
      chiffrage_disponible: false,
      hypotheses_calcul: "",
      statut: "complet" as const,
      date_derniere_verification: "2026-09-19",
    };
    expect(combinaisonsDiffere([existante], [fraiche])).toBe(false);
  });

  it("retourne true si resume_factuel diffère", () => {
    const existante = {
      id: "candidat-x-fiscalite-001",
      candidat: "candidat-x",
      theme: "fiscalite",
      titre: "Titre",
      resume_factuel: "Ancien résumé",
      sources: [{ type: "primaire" as const, label: "A", url: "https://exemple-officiel.fr/a" }],
      chiffrage_disponible: false,
      hypotheses_calcul: "",
      statut: "complet" as const,
      date_derniere_verification: "2026-09-18",
    };
    const fraiche = { ...existante, resume_factuel: "Nouveau résumé" };
    expect(combinaisonsDiffere([existante], [fraiche])).toBe(true);
  });

  it("retourne true si le nombre de propositions diffère", () => {
    expect(combinaisonsDiffere([], [{ titre: "Nouvelle", resume_factuel: "x", sources: [], chiffrage_disponible: false, hypotheses_calcul: "", statut: "complet", date_derniere_verification: "2026-09-18" }])).toBe(true);
  });
});

describe("tirerEchantillon", () => {
  it("tire une proportion approximative des éléments avec un générateur déterministe", () => {
    const elements = Array.from({ length: 100 }, (_, i) => i);
    const echantillon = tirerEchantillon(elements, 0.1, () => 0.05);
    expect(echantillon.length).toBe(10);
  });

  it("retourne un tableau vide pour une liste vide", () => {
    expect(tirerEchantillon([], 0.1)).toEqual([]);
  });
});

// Tests ajoutés au-delà du brief (non fournis dans task-7-brief.md) : le brief ne couvre pas
// executerRefresh par un test direct, alors que la contrainte "ne jamais écraser
// propositions.json" est la contrainte critique de ce mode. On la vérifie ici explicitement.
describe("executerRefresh", () => {
  afterEach(() => {
    rmSync(racine, { recursive: true, force: true });
  });

  const existante = {
    id: "candidat-x-fiscalite-001",
    candidat: "candidat-x",
    theme: "fiscalite",
    titre: "Titre A",
    resume_factuel: "Résumé A",
    sources: [
      { type: "primaire" as const, label: "A", url: "https://exemple-officiel.fr/a" },
      { type: "primaire" as const, label: "B", url: "https://exemple-officiel.fr/b" },
    ],
    chiffrage_disponible: false,
    hypotheses_calcul: "",
    statut: "complet" as const,
    date_derniere_verification: "2026-09-18",
  };

  it("ne modifie ni propositions.json ni _a-verifier.json quand la fraîche re-vérification confirme l'existant", async () => {
    preparerRacine();
    enregistrerPropositions("candidat-x", [existante], racine);
    const fraiche = { ...existante, date_derniere_verification: "2026-09-19" } as Record<string, unknown>;
    delete fraiche.id;
    delete fraiche.candidat;
    delete fraiche.theme;
    const clientFactice = {
      messages: {
        create: vi.fn().mockResolvedValue({ content: [{ type: "text", text: JSON.stringify([fraiche]) }] }),
      },
    };

    const resultat = await executerRefresh(clientFactice, META, "fiscalite", "Fiscalité", { racine });

    expect(resultat.divergence).toBe(false);
    expect(chargerPropositions("candidat-x", racine)).toEqual([existante]);
    expect(chargerAVerifier("candidat-x", racine)).toEqual([]);
  });

  it("n'écrase jamais propositions.json en cas de divergence, écrit seulement dans _a-verifier.json", async () => {
    preparerRacine();
    enregistrerPropositions("candidat-x", [existante], racine);
    const fraiche = { ...existante, resume_factuel: "Nouveau résumé divergent" } as Record<string, unknown>;
    delete fraiche.id;
    delete fraiche.candidat;
    delete fraiche.theme;
    const clientFactice = {
      messages: {
        create: vi.fn().mockResolvedValue({ content: [{ type: "text", text: JSON.stringify([fraiche]) }] }),
      },
    };

    const resultat = await executerRefresh(clientFactice, META, "fiscalite", "Fiscalité", { racine });

    expect(resultat.divergence).toBe(true);
    // Contrainte critique : propositions.json reste inchangé, jamais écrasé silencieusement.
    expect(chargerPropositions("candidat-x", racine)).toEqual([existante]);
    const aVerifier = chargerAVerifier("candidat-x", racine);
    expect(aVerifier).toHaveLength(1);
    expect(aVerifier[0].theme).toBe("fiscalite");
    expect(aVerifier[0].raison).toBe("refresh : divergence avec l'existant");
  });
});
