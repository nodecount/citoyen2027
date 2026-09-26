import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  executerCombinaison,
  executerLot,
  executerSynthese,
  executerSyntheses,
  genererIdProposition,
  combinaisonsDiffere,
  executerRefresh,
  tirerEchantillon,
} from "./run";
import {
  chargerAVerifier,
  chargerJournal,
  chargerPropositions,
  chargerSyntheses,
  chargerSynthesesAVerifier,
  enregistrerJournal,
  enregistrerPropositions,
  enregistrerSynthese,
  enregistrerSyntheseAVerifier,
} from "./depot";
import type { CandidatMeta, Proposition } from "../types";

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
        create: async (requete: { messages: Array<{ content: string | unknown[] }> }) => {
          const contenu = String(requete.messages[0].content);
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

describe("executerSynthese", () => {
  afterEach(() => {
    rmSync(racine, { recursive: true, force: true });
  });

  const TEXTE =
    "Le programme prévoit une contribution supplémentaire sur les hauts revenus, dont le seuil n'est pas précisé. " +
    "Cette mesure vise les foyers de la tranche de revenus la plus élevée et réduirait leur revenu disponible.";

  function prop(id: string, theme: string, statut: Proposition["statut"] = "complet"): Proposition {
    return {
      id,
      candidat: "candidat-x",
      theme,
      titre: `Mesure ${id}`,
      resume_factuel: "Résumé",
      sources: [
        { type: "primaire", label: "A", url: "https://exemple-officiel.fr/a", nom: "Source", annee: 2026 },
        { type: "primaire", label: "B", url: "https://exemple-officiel.fr/b", nom: "Source", annee: 2026 },
      ],
      chiffrage_disponible: false,
      hypotheses_calcul: "",
      statut,
      date_derniere_verification: "2026-09-24",
      effets: [],
    };
  }

  const reponseSynthese = (ids: string[], texte = TEXTE) => ({
    content: [{ type: "text", text: JSON.stringify({ texte, propositions_utilisees: ids }) }],
  });
  const reponseVerdict = (verdict: "PASS" | "FAIL", raison?: string) => ({
    content: [{ type: "text", text: JSON.stringify(raison ? { verdict, raison } : { verdict }) }],
  });

  function clientAvec(...reponses: unknown[]) {
    const create = vi.fn();
    for (const reponse of reponses) create.mockResolvedValueOnce(reponse);
    return { messages: { create } };
  }

  it("génère, fait relire et enregistre la synthèse d'un thème couvert, avec toutes les mesures affichables", async () => {
    preparerRacine();
    enregistrerPropositions("candidat-x", [prop("candidat-x-fisc-001", "fiscalite"), prop("candidat-x-fisc-002", "fiscalite")], racine);
    const client = clientAvec(reponseSynthese(["candidat-x-fisc-001", "candidat-x-fisc-002"]), reponseVerdict("PASS"));

    const resultat = await executerSynthese(client, META, "fiscalite", "Mes impôts et taxes", { racine });

    expect(resultat).toBe("enregistree");
    const syntheses = chargerSyntheses("candidat-x", racine);
    expect(syntheses).toHaveLength(1);
    expect(syntheses[0].theme).toBe("fiscalite");
    expect(syntheses[0].texte).toBe(TEXTE);
    expect(syntheses[0].propositions).toEqual(["candidat-x-fisc-001", "candidat-x-fisc-002"]);
    expect(syntheses[0].date_derniere_verification).toBe(new Date().toISOString().slice(0, 10));
  });

  it("ne fait rien, sans appeler l'API, si le candidat n'a aucune mesure affichable sur le thème", async () => {
    preparerRacine();
    enregistrerPropositions("candidat-x", [prop("candidat-x-fisc-001", "fiscalite", "provisoire"), prop("candidat-x-sante-001", "sante")], racine);
    const client = clientAvec();
    expect(await executerSynthese(client, META, "fiscalite", "Mes impôts et taxes", { racine })).toBe("aucune_proposition");
    expect(client.messages.create).not.toHaveBeenCalled();
    expect(chargerSyntheses("candidat-x", racine)).toEqual([]);
  });

  it("ne régénère pas une synthèse déjà à jour (mêmes mesures), sauf avec force", async () => {
    preparerRacine();
    enregistrerPropositions("candidat-x", [prop("candidat-x-fisc-001", "fiscalite")], racine);
    enregistrerSynthese("candidat-x", { theme: "fiscalite", texte: "Ancien texte.", propositions: ["candidat-x-fisc-001"], date_derniere_verification: "2026-09-20" }, racine);

    const inactif = clientAvec();
    expect(await executerSynthese(inactif, META, "fiscalite", "Mes impôts et taxes", { racine })).toBe("deja_a_jour");
    expect(inactif.messages.create).not.toHaveBeenCalled();

    const client = clientAvec(reponseSynthese(["candidat-x-fisc-001"]), reponseVerdict("PASS"));
    expect(await executerSynthese(client, META, "fiscalite", "Mes impôts et taxes", { racine, force: true })).toBe("enregistree");
    expect(chargerSyntheses("candidat-x", racine)[0].texte).toBe(TEXTE);
  });

  it("régénère quand l'ensemble des mesures du thème a changé", async () => {
    preparerRacine();
    enregistrerPropositions("candidat-x", [prop("candidat-x-fisc-001", "fiscalite"), prop("candidat-x-fisc-002", "fiscalite")], racine);
    enregistrerSynthese("candidat-x", { theme: "fiscalite", texte: "Ancien texte.", propositions: ["candidat-x-fisc-001"], date_derniere_verification: "2026-09-20" }, racine);
    const client = clientAvec(reponseSynthese(["candidat-x-fisc-001", "candidat-x-fisc-002"]), reponseVerdict("PASS"));
    expect(await executerSynthese(client, META, "fiscalite", "Mes impôts et taxes", { racine })).toBe("enregistree");
  });

  it("met en attente une synthèse refusée par le relecteur, sans toucher à synthese.json", async () => {
    preparerRacine();
    enregistrerPropositions("candidat-x", [prop("candidat-x-fisc-001", "fiscalite")], racine);
    const client = clientAvec(reponseSynthese(["candidat-x-fisc-001"]), reponseVerdict("FAIL", "affirmation non étayée"));

    expect(await executerSynthese(client, META, "fiscalite", "Mes impôts et taxes", { racine })).toBe("a_verifier");
    expect(chargerSyntheses("candidat-x", racine)).toEqual([]);
    const enAttente = chargerSynthesesAVerifier("candidat-x", racine);
    expect(enAttente).toHaveLength(1);
    expect(enAttente[0].raison).toBe("affirmation non étayée");
    expect(enAttente[0].texte).toBe(TEXTE);
  });

  it("met en attente une synthèse qui échoue les contrôles déterministes, sans appeler le relecteur", async () => {
    preparerRacine();
    enregistrerPropositions("candidat-x", [prop("candidat-x-fisc-001", "fiscalite"), prop("candidat-x-fisc-002", "fiscalite")], racine);
    // Deux tentatives (l'erreur est renvoyée au modèle une fois), toutes deux incomplètes ; aucun relecteur.
    const client = clientAvec(reponseSynthese(["candidat-x-fisc-001"]), reponseSynthese(["candidat-x-fisc-001"]));

    expect(await executerSynthese(client, META, "fiscalite", "Mes impôts et taxes", { racine })).toBe("a_verifier");
    expect(client.messages.create).toHaveBeenCalledTimes(2);
    const enAttente = chargerSynthesesAVerifier("candidat-x", racine)[0];
    expect(enAttente.raison).toContain("candidat-x-fisc-002");
    // Le texte refusé est conservé pour la relecture humaine (il était perdu : entrée vide).
    expect(enAttente.texte).toBe(TEXTE);
  });

  it("efface l'ancienne entrée en attente d'un thème quand une nouvelle synthèse est enregistrée", async () => {
    preparerRacine();
    enregistrerPropositions("candidat-x", [prop("candidat-x-fisc-001", "fiscalite")], racine);
    enregistrerSyntheseAVerifier("candidat-x", { theme: "fiscalite", texte: "Refusée.", propositions: [], raison: "ancienne raison" }, racine);
    const client = clientAvec(reponseSynthese(["candidat-x-fisc-001"]), reponseVerdict("PASS"));

    await executerSynthese(client, META, "fiscalite", "Mes impôts et taxes", { racine });
    expect(chargerSynthesesAVerifier("candidat-x", racine)).toEqual([]);
  });
});

describe("executerSyntheses", () => {
  afterEach(() => {
    rmSync(racine, { recursive: true, force: true });
  });

  it("isole l'échec d'un thème : les suivants sont traités quand même", async () => {
    preparerRacine();
    const propositions: Proposition[] = ["fiscalite", "sante"].map((theme, i) => ({
      id: `candidat-x-${theme}-001`,
      candidat: "candidat-x",
      theme,
      titre: `Mesure ${i}`,
      resume_factuel: "Résumé",
      sources: [
        { type: "primaire", label: "A", url: "https://exemple-officiel.fr/a", nom: "Source", annee: 2026 },
        { type: "primaire", label: "B", url: "https://exemple-officiel.fr/b", nom: "Source", annee: 2026 },
      ],
      chiffrage_disponible: false,
      hypotheses_calcul: "",
      statut: "complet",
      date_derniere_verification: "2026-09-24",
      effets: [],
    }));
    enregistrerPropositions("candidat-x", propositions, racine);
    const texte =
      "Le programme prévoit plusieurs mesures sur ce thème et laisse non précisés leur calendrier et leur financement. " +
      "Elles s'adressent à l'ensemble des citoyens concernés et modifieraient directement leurs démarches quotidiennes.";
    const create = vi
      .fn()
      .mockRejectedValueOnce(new Error("panne réseau")) // thème 1 : génération
      .mockResolvedValueOnce({ content: [{ type: "text", text: JSON.stringify({ texte, propositions_utilisees: ["candidat-x-sante-001"] }) }] })
      .mockResolvedValueOnce({ content: [{ type: "text", text: JSON.stringify({ verdict: "PASS" }) }] });
    const erreurs = vi.spyOn(console, "error").mockImplementation(() => {});

    await executerSyntheses(
      { messages: { create } },
      [
        { slug: "candidat-x", themeId: "fiscalite", themeLibelle: "Mes impôts et taxes" },
        { slug: "candidat-x", themeId: "sante", themeLibelle: "Ma santé" },
      ],
      { racine },
    );

    expect(erreurs).toHaveBeenCalled();
    erreurs.mockRestore();
    expect(chargerSyntheses("candidat-x", racine).map((s) => s.theme)).toEqual(["sante"]);
  });
});

describe("journal de recherche", () => {
  afterEach(() => {
    rmSync(racine, { recursive: true, force: true });
  });

  const reponseVide = {
    content: [
      { type: "server_tool_use", id: "f1", name: "web_fetch", input: { url: "https://exemple-officiel.fr/programme" } },
      { type: "web_fetch_tool_result", tool_use_id: "f1", content: { type: "web_fetch_result" } },
      { type: "server_tool_use", id: "f2", name: "web_fetch", input: { url: "https://exemple-officiel.fr/absent" } },
      { type: "web_fetch_tool_result", tool_use_id: "f2", content: { error_code: "url_not_accessible" } },
      { type: "text", text: "[]" },
    ],
    stop_reason: "end_turn",
    usage: { input_tokens: 1500000, output_tokens: 3000 },
  };

  it("garde une trace d'une recherche qui ne trouve aucune mesure : arrêt, jetons, pages lues et échouées", async () => {
    preparerRacine();
    const create = vi.fn().mockResolvedValueOnce(reponseVide);
    await executerCombinaison({ messages: { create } }, META, { slug: "candidat-x", themeId: "fiscalite", themeLibelle: "Fiscalité" }, [], { racine });

    expect(create).toHaveBeenCalledTimes(1); // aucune vérification à faire : rien à vérifier
    expect(chargerPropositions("candidat-x", racine)).toEqual([]);
    const journal = chargerJournal("candidat-x", racine);
    expect(journal).toHaveLength(1);
    expect(journal[0]).toMatchObject({
      theme: "fiscalite",
      resultat: "aucune_mesure",
      arret: "end_turn",
      jetons_entree: 1500000,
      jetons_sortie: 3000,
      urls_lues: ["https://exemple-officiel.fr/programme"],
      urls_echouees: [{ cible: "https://exemple-officiel.fr/absent", code: "url_not_accessible" }],
    });
    expect(journal[0].date).toBe(new Date().toISOString().slice(0, 10));
  });

  it("ne relance pas une combinaison déjà cherchée sans résultat (elle coûterait de nouveau), sauf avec force", async () => {
    preparerRacine();
    enregistrerJournal("candidat-x", {
      theme: "fiscalite", date: "2026-09-25", resultat: "aucune_mesure", nombre_propositions: 0, arret: "end_turn",
      duree_ms: 1000, jetons_entree: 1, jetons_sortie: 1, urls_lues: [], urls_echouees: [], requetes: [],
    }, racine);

    const inactif = vi.fn();
    await executerLot({ messages: { create: inactif } }, [{ slug: "candidat-x", themeId: "fiscalite", themeLibelle: "Fiscalité" }], { racine });
    expect(inactif).not.toHaveBeenCalled();

    const create = vi.fn().mockResolvedValueOnce(reponseVide);
    await executerLot({ messages: { create } }, [{ slug: "candidat-x", themeId: "fiscalite", themeLibelle: "Fiscalité" }], { racine, force: true });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("enregistre aussi une recherche fructueuse dans le journal, avant même la vérification", async () => {
    preparerRacine();
    const proposition = {
      titre: "Titre", resume_factuel: "Résumé",
      sources: [
        { type: "primaire", label: "A", url: "https://exemple-officiel.fr/a", nom: "Source", annee: 2026 },
        { type: "primaire", label: "B", url: "https://exemple-officiel.fr/b", nom: "Source", annee: 2026 },
      ],
      chiffrage_disponible: false, hypotheses_calcul: "", statut: "complet", date_derniere_verification: "2026-09-25", effets: [],
    };
    const create = vi
      .fn()
      .mockResolvedValueOnce({ content: [{ type: "text", text: JSON.stringify([proposition]) }], stop_reason: "end_turn" })
      .mockRejectedValueOnce(new Error("panne pendant la vérification"));
    await expect(
      executerCombinaison({ messages: { create } }, META, { slug: "candidat-x", themeId: "fiscalite", themeLibelle: "Fiscalité" }, [], { racine, fetchImpl: async () => new Response("contenu de la page") }),
    ).rejects.toThrow("panne");
    expect(chargerJournal("candidat-x", racine)[0]).toMatchObject({ theme: "fiscalite", resultat: "propositions_generees", nombre_propositions: 1 });
  });
});
