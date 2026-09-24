import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { executerCombinaison, executerLot, genererIdProposition, combinaisonsDiffere, executerRefresh, tirerEchantillon } from "./run";
import { chargerAVerifier, chargerPropositions, enregistrerPropositions } from "./depot";
import type { CandidatMeta } from "../types";

let racine: string;

const META: CandidatMeta = {
  slug: "candidat-x",
  nom: "Candidat X",
  parti: "Parti X",
  date_derniere_maj: "2026-09-18",
  sources_officielles: [{ type: "primaire", label: "Programme", url: "https://exemple-officiel.fr/programme", nom: "Source", annee: 2026 }],
};

function preparerRacine(): void {
  racine = mkdtempSync(resolve(tmpdir(), "ingestion-run-test-"));
  mkdirSync(resolve(racine, "candidat-x"), { recursive: true });
  writeFileSync(resolve(racine, "candidat-x/meta.json"), JSON.stringify(META));
}

describe("genererIdProposition", () => {
  it("produit un identifiant déterministe basé sur le slug, l'abréviation du thème et l'index", () => {
    expect(genererIdProposition("candidat-x", "fiscalite", 1)).toBe("candidat-x-fisc-001");
    expect(genererIdProposition("candidat-x", "fiscalite", 12)).toBe("candidat-x-fisc-012");
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
        { type: "primaire" as const, label: "A", url: "https://exemple-officiel.fr/a", nom: "Source", annee: 2026 },
        { type: "primaire" as const, label: "B", url: "https://exemple-officiel.fr/b", nom: "Source", annee: 2026 },
      ],
      chiffrage_disponible: false,
      hypotheses_calcul: "",
      statut: "complet" as const,
      date_derniere_verification: "2026-09-18",
      effets: [],
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
    expect(propositionsEnregistrees[0].id).toBe("candidat-x-fisc-001");
    expect(propositionsEnregistrees[0].candidat).toBe("candidat-x");
    expect(propositionsEnregistrees[0].date_derniere_verification).toBe(new Date().toISOString().slice(0, 10));
    expect(chargerAVerifier("candidat-x", racine)).toEqual([]);
  });

  it("numérote par thème : des propositions existantes sur un autre thème n'influencent pas l'index", async () => {
    preparerRacine();
    const propositionsExistantesSante = Array.from({ length: 3 }, (_, i) => ({
      id: `candidat-x-sante-00${i + 1}`,
      candidat: "candidat-x",
      theme: "sante",
      titre: `Titre santé ${i + 1}`,
      resume_factuel: "Résumé",
      sources: [{ type: "primaire" as const, label: "A", url: "https://exemple-officiel.fr/a", nom: "Source", annee: 2026 }],
      chiffrage_disponible: false,
      hypotheses_calcul: "",
      statut: "complet" as const,
      date_derniere_verification: "2026-09-18",
      effets: [],
    }));
    enregistrerPropositions("candidat-x", propositionsExistantesSante, racine);
    const propositionGeneree = {
      titre: "Titre fiscal",
      resume_factuel: "Résumé",
      sources: [
        { type: "primaire" as const, label: "A", url: "https://exemple-officiel.fr/a", nom: "Source", annee: 2026 },
        { type: "primaire" as const, label: "B", url: "https://exemple-officiel.fr/b", nom: "Source", annee: 2026 },
      ],
      chiffrage_disponible: false,
      hypotheses_calcul: "",
      statut: "complet" as const,
      date_derniere_verification: "2026-09-18",
      effets: [],
    };
    const clientFactice = {
      messages: {
        create: vi
          .fn()
          .mockResolvedValueOnce({ content: [{ type: "text", text: JSON.stringify([propositionGeneree]) }] })
          .mockResolvedValueOnce({
            content: [{ type: "text", text: JSON.stringify([{ titre: "Titre fiscal", verdict: "PASS" }]) }],
          }),
      },
    };
    const fetchFactice = async () => new Response("contenu de la page");

    await executerCombinaison(
      clientFactice,
      META,
      { slug: "candidat-x", themeId: "fiscalite", themeLibelle: "Fiscalité" },
      propositionsExistantesSante,
      { racine, fetchImpl: fetchFactice },
    );

    const propositionsEnregistrees = chargerPropositions("candidat-x", racine);
    const nouvelle = propositionsEnregistrees.find((p) => p.titre === "Titre fiscal");
    expect(nouvelle?.id).toBe("candidat-x-fisc-001");
  });

  it("ne transmet au modèle que les titres des AUTRES thèmes, jamais ceux du thème en cours de génération", async () => {
    preparerRacine();
    const existanteSante = {
      id: "candidat-x-sante-001",
      candidat: "candidat-x",
      theme: "sante",
      titre: "Titre Santé Existante",
      resume_factuel: "Résumé",
      sources: [{ type: "primaire" as const, label: "A", url: "https://exemple-officiel.fr/a", nom: "Source", annee: 2026 }],
      chiffrage_disponible: false,
      hypotheses_calcul: "",
      statut: "complet" as const,
      date_derniere_verification: "2026-09-18",
      effets: [],
    };
    const existanteFiscale = {
      id: "candidat-x-fisc-001",
      candidat: "candidat-x",
      theme: "fiscalite",
      titre: "Titre Fiscal Existant",
      resume_factuel: "Résumé",
      sources: [{ type: "primaire" as const, label: "A", url: "https://exemple-officiel.fr/a", nom: "Source", annee: 2026 }],
      chiffrage_disponible: false,
      hypotheses_calcul: "",
      statut: "complet" as const,
      date_derniere_verification: "2026-09-18",
      effets: [],
    };
    const creerMock = vi.fn().mockResolvedValue({ content: [{ type: "text", text: "[]" }] });
    const clientFactice = { messages: { create: creerMock } };
    const fetchFactice = async () => new Response("contenu de la page");

    // Génération pour le thème "fiscalite" : existanteSante est d'un autre thème,
    // existanteFiscale est du même thème que celui en cours de génération.
    await executerCombinaison(
      clientFactice,
      META,
      { slug: "candidat-x", themeId: "fiscalite", themeLibelle: "Fiscalité" },
      [existanteSante, existanteFiscale],
      { racine, fetchImpl: fetchFactice },
    );

    expect(creerMock).toHaveBeenCalledOnce();
    const requeteEnvoyee = creerMock.mock.calls[0][0] as { system: string };
    // Dédup cross-thème : le titre d'un autre thème doit apparaître dans la liste transmise...
    expect(requeteEnvoyee.system).toContain("Titre Santé Existante");
    // ... mais un titre du thème en cours de génération ne doit jamais être signalé comme
    // "déjà existant", sous peine de biaiser le modèle vers l'évitement de doublons internes
    // au thème (qui sont pourtant légitimes tant qu'ils ne sont pas déjà en base pour ce thème).
    expect(requeteEnvoyee.system).not.toContain("Titre Fiscal Existant");
  });

  it("n'enregistre rien dans propositions.json pour une proposition qui échoue la vérification", async () => {
    preparerRacine();
    const propositionGeneree = {
      titre: "Titre invalide",
      resume_factuel: "Résumé",
      sources: [
        { type: "primaire" as const, label: "A", url: "https://domaine-non-autorise.fr/a", nom: "Source", annee: 2026 },
        { type: "primaire" as const, label: "B", url: "https://exemple-officiel.fr/b", nom: "Source", annee: 2026 },
      ],
      chiffrage_disponible: false,
      hypotheses_calcul: "",
      statut: "complet" as const,
      date_derniere_verification: "2026-09-18",
      effets: [],
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
      sources: [{ type: "primaire" as const, label: "A", url: "https://exemple-officiel.fr/a", nom: "Source", annee: 2026 }],
      chiffrage_disponible: false,
      hypotheses_calcul: "",
      statut: "complet" as const,
      date_derniere_verification: "2026-09-18",
      effets: [],
    };
    const fraiche = {
      titre: "Titre",
      resume_factuel: "Résumé",
      sources: [{ type: "primaire" as const, label: "A", url: "https://exemple-officiel.fr/a", nom: "Source", annee: 2026 }],
      chiffrage_disponible: false,
      hypotheses_calcul: "",
      statut: "complet" as const,
      date_derniere_verification: "2026-09-19",
      effets: [],
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
      sources: [{ type: "primaire" as const, label: "A", url: "https://exemple-officiel.fr/a", nom: "Source", annee: 2026 }],
      chiffrage_disponible: false,
      hypotheses_calcul: "",
      statut: "complet" as const,
      date_derniere_verification: "2026-09-18",
      effets: [],
    };
    const fraiche = { ...existante, resume_factuel: "Nouveau résumé" };
    expect(combinaisonsDiffere([existante], [fraiche])).toBe(true);
  });

  it("retourne true si le nombre de propositions diffère", () => {
    expect(combinaisonsDiffere([], [{ titre: "Nouvelle", resume_factuel: "x", sources: [], chiffrage_disponible: false, hypotheses_calcul: "", statut: "complet", date_derniere_verification: "2026-09-18", effets: [] }])).toBe(true);
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
      { type: "primaire" as const, label: "A", url: "https://exemple-officiel.fr/a", nom: "Source", annee: 2026 },
      { type: "primaire" as const, label: "B", url: "https://exemple-officiel.fr/b", nom: "Source", annee: 2026 },
    ],
    chiffrage_disponible: false,
    hypotheses_calcul: "",
    statut: "complet" as const,
    date_derniere_verification: "2026-09-18",
    effets: [],
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

  it("ne transmet au modèle que les titres des AUTRES thèmes, jamais ceux du thème en cours de refresh", async () => {
    preparerRacine();
    const autreTheme = {
      id: "candidat-x-travail-001",
      candidat: "candidat-x",
      theme: "travail",
      titre: "Titre Travail B",
      resume_factuel: "Résumé B",
      sources: [
        { type: "primaire" as const, label: "A", url: "https://exemple-officiel.fr/c", nom: "Source", annee: 2026 },
        { type: "primaire" as const, label: "B", url: "https://exemple-officiel.fr/d", nom: "Source", annee: 2026 },
      ],
      chiffrage_disponible: false,
      hypotheses_calcul: "",
      statut: "complet" as const,
      date_derniere_verification: "2026-09-18",
      effets: [],
    };
    enregistrerPropositions("candidat-x", [existante, autreTheme], racine);
    const fraiche = { ...existante, date_derniere_verification: "2026-09-19" } as Record<string, unknown>;
    delete fraiche.id;
    delete fraiche.candidat;
    delete fraiche.theme;
    const creerMock = vi.fn().mockResolvedValue({ content: [{ type: "text", text: JSON.stringify([fraiche]) }] });
    const clientFactice = { messages: { create: creerMock } };

    // Refresh du thème "fiscalite" : existante ("Titre A") est du même thème que celui
    // en cours de refresh, autreTheme ("Titre Travail B") est d'un autre thème.
    await executerRefresh(clientFactice, META, "fiscalite", "Fiscalité", { racine });

    expect(creerMock).toHaveBeenCalledTimes(1);
    const requeteEnvoyee = creerMock.mock.calls[0][0] as { system: string };
    // Dédup cross-thème : le titre d'un autre thème doit apparaître dans la liste transmise...
    expect(requeteEnvoyee.system).toContain("Titre Travail B");
    // ... mais le titre du thème qu'on est justement en train de re-vérifier ne doit PAS
    // être signalé comme "déjà existant", sous peine de pousser le modèle à ne pas le
    // régénérer et donc de vider le refresh de son intérêt.
    expect(requeteEnvoyee.system).not.toContain("Titre A");
  });
});

// Test ajouté suite à la revue de code de la Task 8 : chargerMeta/chargerPropositions étaient
// hors du try/catch d'executerLot, donc un slug invalide ou un meta.json corrompu au milieu
// d'un lot faisait planter tout le reste du lot (contraire à la garantie de résilience de la
// spec). Ce test reproduit exactement ce scénario après correction.
describe("executerLot", () => {
  afterEach(() => {
    rmSync(racine, { recursive: true, force: true });
  });

  it("isole l'échec de chargerMeta d'une combinaison et traite quand même les combinaisons suivantes du lot", async () => {
    racine = mkdtempSync(resolve(tmpdir(), "ingestion-lot-test-"));
    const metaValide = (slug: string): CandidatMeta => ({
      slug,
      nom: slug,
      parti: "Parti",
      date_derniere_maj: "2026-09-18",
      sources_officielles: [{ type: "primaire", label: "Programme", url: "https://exemple-officiel.fr/programme", nom: "Source", annee: 2026 }],
    });
    mkdirSync(resolve(racine, "candidat-a"), { recursive: true });
    writeFileSync(resolve(racine, "candidat-a/meta.json"), JSON.stringify(metaValide("candidat-a")));
    // "candidat-b" n'a délibérément pas de meta.json : chargerMeta doit échouer (ENOENT) pour
    // cette combinaison, précisément au milieu du lot.
    mkdirSync(resolve(racine, "candidat-c"), { recursive: true });
    writeFileSync(resolve(racine, "candidat-c/meta.json"), JSON.stringify(metaValide("candidat-c")));

    const propositionGeneree = {
      titre: "Titre",
      resume_factuel: "Résumé",
      sources: [
        { type: "primaire" as const, label: "A", url: "https://exemple-officiel.fr/a", nom: "Source", annee: 2026 },
        { type: "primaire" as const, label: "B", url: "https://exemple-officiel.fr/b", nom: "Source", annee: 2026 },
      ],
      chiffrage_disponible: false,
      hypotheses_calcul: "",
      statut: "complet" as const,
      date_derniere_verification: "2026-09-18",
      effets: [],
    };
    const clientFactice = {
      messages: {
        create: async (requete: { messages: Array<{ content: string }> }) => {
          const contenu = requete.messages[0].content;
          if (contenu.startsWith("Vérifie")) {
            return { content: [{ type: "text", text: JSON.stringify([{ titre: "Titre", verdict: "PASS" }]) }] };
          }
          return { content: [{ type: "text", text: JSON.stringify([propositionGeneree]) }] };
        },
      },
    };
    const fetchFactice = async () => new Response("contenu de la page");

    await executerLot(
      clientFactice,
      [
        { slug: "candidat-a", themeId: "fiscalite", themeLibelle: "Fiscalité" },
        { slug: "candidat-b", themeId: "fiscalite", themeLibelle: "Fiscalité" },
        { slug: "candidat-c", themeId: "fiscalite", themeLibelle: "Fiscalité" },
      ],
      { racine, fetchImpl: fetchFactice },
    );

    expect(chargerPropositions("candidat-a", racine)).toHaveLength(1);
    // candidat-b : chargerMeta a échoué, donc executerCombinaison n'a jamais été atteint.
    expect(chargerPropositions("candidat-b", racine)).toEqual([]);
    // La preuve clé du correctif : candidat-c, listé APRÈS l'échec de candidat-b dans le lot,
    // est quand même traité normalement.
    expect(chargerPropositions("candidat-c", racine)).toHaveLength(1);
  });
});
