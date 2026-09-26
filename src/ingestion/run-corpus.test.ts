import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import type { CandidatMeta } from "../types";
import { definirBudget } from "./appel";
import { Budget, TARIFS_PAR_MODELE } from "./budget";
import { chargerAVerifier, chargerJournal, chargerPropositions, enregistrerJournal } from "./depot";
import { chargerCorpus, executerCandidatCorpus, formaterPlan, planifier } from "./run-corpus";

const PHRASE = "Le programme prévoit la suppression de la C3S, soit 5,3 milliards d'euros, dès l'entame du quinquennat.";
const PAGE_HTML = `<html><body><p>Introduction.</p><p>${PHRASE}</p></body></html>`;

const META: CandidatMeta = {
  slug: "candidat-x", nom: "Candidat X", parti: "Parti X", sources_officielles: [], date_derniere_maj: "2026-09-26",
  documents: [{ id: "programme", url: "https://exemple-officiel.fr/programme", nom: "exemple-officiel.fr", annee: 2026 }],
};
const THEME = { id: "fiscalite", libelle: "Mes impôts et taxes", description: "Impôts et taxes." };
const THEME_SANTE = { id: "sante", libelle: "Ma santé", description: "Santé." };

let racine: string;
let cache: string;
beforeEach(() => {
  racine = mkdtempSync(resolve(tmpdir(), "run-corpus-"));
  cache = mkdtempSync(resolve(tmpdir(), "run-corpus-cache-"));
  mkdirSync(resolve(racine, "candidat-x"), { recursive: true });
  writeFileSync(resolve(racine, "candidat-x/meta.json"), JSON.stringify(META));
});
afterEach(() => {
  definirBudget(undefined);
  rmSync(racine, { recursive: true, force: true });
  rmSync(cache, { recursive: true, force: true });
});

const fetchOk = async () => new Response(PAGE_HTML, { status: 200, headers: { "content-type": "text/html" } });
const options = (surcharge = {}) => ({ racine, dossierCache: cache, fetchImpl: fetchOk, ...surcharge });

function mesure(surcharge: Record<string, unknown> = {}) {
  return {
    titre: "Suppression de la C3S",
    resume_factuel: "Le candidat propose de supprimer la C3S ; le calendrier n'est pas précisé.",
    hypotheses_calcul: "Chiffrage du programme : 5,3 milliards d'euros.",
    chiffrage_disponible: true, statut: "complet",
    preuves: [{ document: "programme", extrait: "suppression de la C3S, soit 5,3 milliards d'euros, dès l'entame du quinquennat" }],
    effets: [],
    ...surcharge,
  };
}
const texte = (v: unknown) => ({ content: [{ type: "text", text: JSON.stringify(v) }], stop_reason: "end_turn", usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 4000 } });
const verdicts = (v: unknown) => texte(v);

let espions: Array<ReturnType<typeof vi.spyOn>>;
beforeEach(() => {
  espions = [vi.spyOn(console, "log").mockImplementation(() => {}), vi.spyOn(console, "warn").mockImplementation(() => {}), vi.spyOn(console, "error").mockImplementation(() => {})];
});
afterEach(() => espions.forEach((e) => e.mockRestore()));

describe("chargerCorpus", () => {
  it("refuse un candidat sans documents déclarés : rien à lire", async () => {
    await expect(chargerCorpus({ ...META, documents: undefined }, options())).rejects.toThrow("documents");
  });

  it("charge les documents lisibles et liste ceux qui échouent, avec la raison", async () => {
    const meta = { ...META, documents: [...META.documents!, { id: "mort", url: "https://exemple-officiel.fr/mort", nom: "x", annee: 2026 }] };
    const fetchImpl = async (url: string | URL | Request) => (String(url).endsWith("/mort") ? new Response("", { status: 404 }) : fetchOk());
    const r = await chargerCorpus(meta, options({ fetchImpl }));
    expect(r.corpus.documents.map((d) => d.id)).toEqual(["programme"]);
    expect(r.echecs).toHaveLength(1);
    expect(r.echecs[0].cible).toContain("/mort");
    expect(r.echecs[0].code).toContain("404");
  });

  it("lève si aucun document n'est lisible", async () => {
    await expect(chargerCorpus(META, options({ fetchImpl: async () => new Response("", { status: 500 }) }))).rejects.toThrow("lisible");
  });
});

describe("planifier", () => {
  it("estime le coût attendu et le pire cas, avec l'écriture de cache seulement au premier thème", async () => {
    const corpus = await chargerCorpus(META, options());
    const plan = planifier(META, corpus, [THEME, THEME_SANTE], TARIFS_PAR_MODELE["claude-sonnet-5"], { racine });
    expect(plan.themes).toHaveLength(2);
    expect(plan.themes[0].estimationUsd).toBeGreaterThan(0);
    expect(plan.attenduUsd).toBeLessThan(plan.pireCasUsd);
    expect(plan.corpusJetons).toBeGreaterThan(0);
  });

  it("n'inclut pas dans l'estimation les thèmes à jour (même empreinte de documents)", async () => {
    const corpus = await chargerCorpus(META, options());
    enregistrerJournal("candidat-x", { theme: "fiscalite", date: "2026-09-25", resultat: "aucune_mesure", nombre_propositions: 0, arret: "end_turn", duree_ms: 1, jetons_entree: 1, jetons_sortie: 1, urls_lues: [], urls_echouees: [], requetes: [], empreinte_corpus: corpus.corpus.empreinte }, racine);
    const plan = planifier(META, corpus, [THEME, THEME_SANTE], TARIFS_PAR_MODELE["claude-sonnet-5"], { racine });
    expect(plan.themes.find((t) => t.themeId === "fiscalite")?.deja).toBe(true);
    expect(plan.themes.find((t) => t.themeId === "sante")?.deja).toBe(false);
    const seul = planifier(META, corpus, [THEME_SANTE], TARIFS_PAR_MODELE["claude-sonnet-5"], { racine });
    expect(plan.attenduUsd).toBeCloseTo(seul.attenduUsd, 6);
  });
});

describe("executerCandidatCorpus", () => {
  it("extrait, vérifie et enregistre : sources tirées de nos documents, journal et synthèse", async () => {
    const create = vi.fn().mockResolvedValueOnce(texte([mesure()])).mockResolvedValueOnce(verdicts([{ titre: "Suppression de la C3S", verdict: "PASS" }]));
    const synthese = vi.fn().mockResolvedValue("enregistree");
    await executerCandidatCorpus({ messages: { create } }, META, [THEME], options({ synthese }));

    const props = chargerPropositions("candidat-x", racine);
    expect(props).toHaveLength(1);
    expect(props[0]).toMatchObject({ id: "candidat-x-fisc-001", candidat: "candidat-x", theme: "fiscalite", statut: "complet" });
    expect(props[0].sources[0]).toMatchObject({ nom: "exemple-officiel.fr", annee: 2026, url: "https://exemple-officiel.fr/programme" });
    expect(chargerJournal("candidat-x", racine)[0]).toMatchObject({ theme: "fiscalite", resultat: "propositions_generees", nombre_propositions: 1 });
    expect(synthese).toHaveBeenCalledTimes(1);
  });

  it("met en attente une mesure dont l'extrait n'est pas dans le document, sans même appeler le relecteur", async () => {
    const create = vi.fn().mockResolvedValueOnce(texte([mesure({ preuves: [{ document: "programme", extrait: "Une phrase que le programme ne contient absolument pas" }] })]));
    await executerCandidatCorpus({ messages: { create } }, META, [THEME], options({ synthese: vi.fn() }));
    expect(create).toHaveBeenCalledTimes(1);
    expect(chargerPropositions("candidat-x", racine)).toEqual([]);
    const enAttente = chargerAVerifier("candidat-x", racine);
    expect(enAttente).toHaveLength(1);
    expect(enAttente[0].raison).toContain("extrait");
  });

  it("met en attente une mesure refusée par le relecteur, avec sa raison", async () => {
    const create = vi.fn().mockResolvedValueOnce(texte([mesure()])).mockResolvedValueOnce(verdicts([{ titre: "Suppression de la C3S", verdict: "FAIL", raison: "portée élargie" }]));
    await executerCandidatCorpus({ messages: { create } }, META, [THEME], options({ synthese: vi.fn() }));
    expect(chargerPropositions("candidat-x", racine)).toEqual([]);
    expect(chargerAVerifier("candidat-x", racine)[0].raison).toBe("portée élargie");
  });

  it("traite l'absence de verdict comme un échec, jamais comme un PASS", async () => {
    const create = vi.fn().mockResolvedValueOnce(texte([mesure()])).mockResolvedValueOnce(verdicts([]));
    await executerCandidatCorpus({ messages: { create } }, META, [THEME], options({ synthese: vi.fn() }));
    expect(chargerPropositions("candidat-x", racine)).toEqual([]);
    expect(chargerAVerifier("candidat-x", racine)[0].raison).toContain("verdict");
  });

  it("garde une trace d'un thème sans mesure et ne le refait pas sans --force", async () => {
    const create = vi.fn().mockResolvedValue(texte([]));
    await executerCandidatCorpus({ messages: { create } }, META, [THEME], options({ synthese: vi.fn() }));
    expect(chargerJournal("candidat-x", racine)[0]).toMatchObject({ theme: "fiscalite", resultat: "aucune_mesure" });
    expect(create).toHaveBeenCalledTimes(1);

    await executerCandidatCorpus({ messages: { create } }, META, [THEME], options({ synthese: vi.fn() }));
    expect(create).toHaveBeenCalledTimes(1);
    await executerCandidatCorpus({ messages: { create } }, META, [THEME], options({ synthese: vi.fn(), force: true }));
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("s'arrête au premier dépassement de budget et ne traite pas les thèmes suivants", async () => {
    definirBudget(new Budget(0.0001, TARIFS_PAR_MODELE["claude-sonnet-5"], 1));
    const create = vi.fn().mockResolvedValue(texte([]));
    const resume = await executerCandidatCorpus({ messages: { create } }, META, [THEME, THEME_SANTE], options({ synthese: vi.fn() }));
    expect(create).not.toHaveBeenCalled();
    expect(resume.arretBudget).toBe(true);
    expect(resume.themes).toEqual([]);
  });

  it("isole l'échec d'un thème : le suivant est traité quand même", async () => {
    const create = vi.fn().mockRejectedValueOnce(new Error("panne réseau")).mockResolvedValueOnce(texte([]));
    const resume = await executerCandidatCorpus({ messages: { create } }, META, [THEME, THEME_SANTE], options({ synthese: vi.fn() }));
    expect(resume.themes.map((t) => t.themeId)).toEqual(["fiscalite", "sante"]);
    expect(resume.themes[0].erreur).toContain("panne");
    expect(chargerJournal("candidat-x", racine).map((e) => e.theme)).toEqual(["sante"]);
  });
});

describe("formaterPlan", () => {
  it("affiche documents, volume, coût attendu et pire cas en euros, et le plafond", async () => {
    const corpus = await chargerCorpus(META, options());
    const plan = planifier(META, corpus, [THEME], TARIFS_PAR_MODELE["claude-sonnet-5"], { racine });
    const texte = formaterPlan(plan, 0.9, 2);
    expect(texte).toContain("candidat-x");
    expect(texte).toContain("programme");
    expect(texte).toContain("attendu");
    expect(texte).toContain("pire cas");
    expect(texte).toContain("plafond 2.00 €");
    expect(texte).toContain("fiscalite");
  });

  it("signale les thèmes à jour et les documents non lus", async () => {
    const meta = { ...META, documents: [...META.documents!, { id: "mort", url: "https://exemple-officiel.fr/mort", nom: "x", annee: 2026 }] };
    const fetchImpl = async (url: string | URL | Request) => (String(url).endsWith("/mort") ? new Response("", { status: 404 }) : fetchOk());
    const corpus = await chargerCorpus(meta, options({ fetchImpl }));
    enregistrerJournal("candidat-x", { theme: "fiscalite", date: "2026-09-25", resultat: "aucune_mesure", nombre_propositions: 0, arret: "end_turn", duree_ms: 1, jetons_entree: 1, jetons_sortie: 1, urls_lues: [], urls_echouees: [], requetes: [], empreinte_corpus: corpus.corpus.empreinte }, racine);
    const texte = formaterPlan(planifier(meta, corpus, [THEME], TARIFS_PAR_MODELE["claude-sonnet-5"], { racine }), 0.9, 2);
    expect(texte).toContain("à jour");
    expect(texte).toContain("non lu");
    expect(texte).toContain("/mort");
  });
});

describe("mise à jour : rejouable quand les programmes changent", () => {
  const html = (phrase: string) => `<html><body><p>Introduction.</p><p>${phrase}</p></body></html>`;
  const fetchDe = (phrase: string) => async () => new Response(html(phrase), { status: 200, headers: { "content-type": "text/html" } });
  const reponses = (n: number) => {
    const create = vi.fn();
    for (let i = 0; i < n; i += 1) {
      create.mockResolvedValueOnce(texte([mesure()])).mockResolvedValueOnce(verdicts([{ titre: "Suppression de la C3S", verdict: "PASS" }]));
    }
    return create;
  };

  it("ne refait rien, gratuitement, quand les documents n'ont pas changé depuis la dernière extraction", async () => {
    const create = reponses(2);
    await executerCandidatCorpus({ messages: { create } }, META, [THEME], options({ synthese: vi.fn() }));
    expect(create).toHaveBeenCalledTimes(2);

    // Trois mois plus tard : on retélécharge (actualiser), le texte est identique.
    await executerCandidatCorpus({ messages: { create } }, META, [THEME], options({ synthese: vi.fn(), actualiser: true }));
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("refait le thème quand un document a changé, et REMPLACE les mesures au lieu de les dupliquer", async () => {
    const create = reponses(2);
    const synthese = vi.fn();
    await executerCandidatCorpus({ messages: { create } }, META, [THEME], options({ synthese }));
    expect(chargerPropositions("candidat-x", racine)).toHaveLength(1);

    const misAJour = PHRASE + " Une nouvelle mesure a été ajoutée au programme.";
    await executerCandidatCorpus({ messages: { create } }, META, [THEME], options({ synthese, actualiser: true, fetchImpl: fetchDe(misAJour) }));

    expect(create).toHaveBeenCalledTimes(4);
    const props = chargerPropositions("candidat-x", racine);
    expect(props).toHaveLength(1); // remplacée, pas ajoutée
    expect(props[0].id).toBe("candidat-x-fisc-001");
    // La synthèse est régénérée de force : mêmes identifiants, contenu possiblement différent.
    expect(synthese).toHaveBeenLastCalledWith(expect.anything(), META, "fiscalite", "Mes impôts et taxes", expect.objectContaining({ force: true }));
  });

  it("remplace aussi les entrées « à vérifier » du thème au lieu de les empiler, et laisse les autres thèmes intacts", async () => {
    const create = vi.fn()
      .mockResolvedValueOnce(texte([mesure({ preuves: [{ document: "programme", extrait: "Une phrase que le programme ne contient absolument pas" }] })]))
      .mockResolvedValueOnce(texte([mesure()]))
      .mockResolvedValueOnce(verdicts([{ titre: "Suppression de la C3S", verdict: "PASS" }]));
    await executerCandidatCorpus({ messages: { create } }, META, [THEME], options({ synthese: vi.fn() }));
    expect(chargerAVerifier("candidat-x", racine)).toHaveLength(1);

    await executerCandidatCorpus({ messages: { create } }, META, [THEME], options({ synthese: vi.fn(), actualiser: true, fetchImpl: fetchDe(PHRASE + " Ajout.") }));
    expect(chargerAVerifier("candidat-x", racine)).toEqual([]);
    expect(chargerPropositions("candidat-x", racine)).toHaveLength(1);
  });

  it("garde les mesures des autres thèmes quand un thème est refait", async () => {
    const create = vi.fn()
      .mockResolvedValueOnce(texte([mesure()])).mockResolvedValueOnce(verdicts([{ titre: "Suppression de la C3S", verdict: "PASS" }]))
      .mockResolvedValueOnce(texte([mesure({ titre: "Mesure santé" })])).mockResolvedValueOnce(verdicts([{ titre: "Mesure santé", verdict: "PASS" }]));
    await executerCandidatCorpus({ messages: { create } }, META, [THEME, THEME_SANTE], options({ synthese: vi.fn() }));
    expect(chargerPropositions("candidat-x", racine).map((p) => p.theme).sort()).toEqual(["fiscalite", "sante"]);

    const create2 = vi.fn().mockResolvedValueOnce(texte([mesure()])).mockResolvedValueOnce(verdicts([{ titre: "Suppression de la C3S", verdict: "PASS" }]));
    await executerCandidatCorpus({ messages: { create: create2 } }, META, [THEME], options({ synthese: vi.fn(), force: true }));
    expect(chargerPropositions("candidat-x", racine).map((p) => p.theme).sort()).toEqual(["fiscalite", "sante"]);
    expect(chargerPropositions("candidat-x", racine)).toHaveLength(2);
  });

  it("considère comme obsolète une recherche antérieure à l'empreinte (données historiques) : elle est refaite", async () => {
    enregistrerJournal("candidat-x", { theme: "fiscalite", date: "2026-09-25", resultat: "aucune_mesure", nombre_propositions: 0, arret: "end_turn", duree_ms: 1, jetons_entree: 1, jetons_sortie: 1, urls_lues: [], urls_echouees: [], requetes: [] }, racine);
    const create = vi.fn().mockResolvedValue(texte([]));
    await executerCandidatCorpus({ messages: { create } }, META, [THEME], options({ synthese: vi.fn() }));
    expect(create).toHaveBeenCalledTimes(1);
    expect(chargerJournal("candidat-x", racine)[0].empreinte_corpus).toMatch(/^[0-9a-f]{16}$/);
  });

  it("le plan distingue à jour, obsolète et à faire, et nomme les documents modifiés", async () => {
    const create = reponses(1);
    await executerCandidatCorpus({ messages: { create } }, META, [THEME], options({ synthese: vi.fn() }));

    const modifie = await chargerCorpus(META, options({ actualiser: true, fetchImpl: fetchDe(PHRASE + " Modif.") }));
    const plan = planifier(META, modifie, [THEME, THEME_SANTE], TARIFS_PAR_MODELE["claude-sonnet-5"], { racine });
    expect(plan.themes.find((t) => t.themeId === "fiscalite")?.etat).toBe("obsolete");
    expect(plan.themes.find((t) => t.themeId === "sante")?.etat).toBe("a_faire");
    expect(plan.documentsModifies).toEqual(["programme"]);
    expect(formaterPlan(plan, 0.9, 2)).toContain("obsolète");

    const identique = await chargerCorpus(META, options({ actualiser: true }));
    const plan2 = planifier(META, identique, [THEME], TARIFS_PAR_MODELE["claude-sonnet-5"], { racine });
    expect(plan2.themes[0].etat).toBe("a_jour");
    expect(plan2.documentsModifies).toEqual([]);
  });
});

describe("reprise après arrêt : une extraction payée n'est jamais refaite", () => {
  it("réutilise l'extraction sauvegardée quand un arrêt (budget, panne) est survenu après elle", async () => {
    // 1re passe : l'extraction réussit, la relecture tombe en panne.
    const create1 = vi.fn().mockResolvedValueOnce(texte([mesure()])).mockRejectedValueOnce(new Error("panne pendant la relecture"));
    const r1 = await executerCandidatCorpus({ messages: { create: create1 } }, META, [THEME], options({ synthese: vi.fn() }));
    expect(r1.themes[0].erreur).toContain("panne");
    expect(chargerPropositions("candidat-x", racine)).toEqual([]);
    expect(create1).toHaveBeenCalledTimes(2);

    // 2e passe : seule la relecture est refaite ; l'extraction (payante) vient du cache.
    const create2 = vi.fn().mockResolvedValueOnce(verdicts([{ titre: "Suppression de la C3S", verdict: "PASS" }]));
    await executerCandidatCorpus({ messages: { create: create2 } }, META, [THEME], options({ synthese: vi.fn() }));
    expect(create2).toHaveBeenCalledTimes(1);
    expect(String(create2.mock.calls[0][0].messages[0].content)).not.toContain("CORPUS"); // c'est bien la relecture
    expect(chargerPropositions("candidat-x", racine)).toHaveLength(1);
  });

  it("ne réutilise pas une extraction faite sur d'autres documents", async () => {
    const create1 = vi.fn().mockResolvedValueOnce(texte([mesure()])).mockRejectedValueOnce(new Error("panne"));
    await executerCandidatCorpus({ messages: { create: create1 } }, META, [THEME], options({ synthese: vi.fn() }));

    const modifie = async () => new Response(html2(PHRASE + " Ajout au programme."), { status: 200, headers: { "content-type": "text/html" } });
    const create2 = vi.fn().mockResolvedValueOnce(texte([mesure()])).mockResolvedValueOnce(verdicts([{ titre: "Suppression de la C3S", verdict: "PASS" }]));
    await executerCandidatCorpus({ messages: { create: create2 } }, META, [THEME], options({ synthese: vi.fn(), actualiser: true, fetchImpl: modifie }));
    expect(create2).toHaveBeenCalledTimes(2); // extraction refaite : les documents ont changé
  });

  it("--force ignore le cache d'extraction", async () => {
    const create1 = vi.fn().mockResolvedValueOnce(texte([mesure()])).mockRejectedValueOnce(new Error("panne"));
    await executerCandidatCorpus({ messages: { create: create1 } }, META, [THEME], options({ synthese: vi.fn() }));
    const create2 = vi.fn().mockResolvedValueOnce(texte([mesure()])).mockResolvedValueOnce(verdicts([{ titre: "Suppression de la C3S", verdict: "PASS" }]));
    await executerCandidatCorpus({ messages: { create: create2 } }, META, [THEME], options({ synthese: vi.fn(), force: true }));
    expect(create2).toHaveBeenCalledTimes(2);
  });

  it("après un rejet, un nouveau passage refait seulement la relecture (quelques centimes), jamais l'extraction", async () => {
    const create = vi.fn().mockResolvedValueOnce(texte([mesure()])).mockResolvedValueOnce(verdicts([{ titre: "Suppression de la C3S", verdict: "FAIL", raison: "portée élargie" }]));
    await executerCandidatCorpus({ messages: { create } }, META, [THEME], options({ synthese: vi.fn() }));
    const create2 = vi.fn().mockResolvedValueOnce(verdicts([{ titre: "Suppression de la C3S", verdict: "PASS" }]));
    await executerCandidatCorpus({ messages: { create: create2 } }, META, [THEME], options({ synthese: vi.fn(), force: false }));
    expect(create2).toHaveBeenCalledTimes(1);
    expect(String(create2.mock.calls[0][0].messages[0].content)).not.toContain("CORPUS");
    expect(chargerPropositions("candidat-x", racine)).toHaveLength(1);
  });
});

const html2 = (phrase: string) => `<html><body><p>Introduction.</p><p>${phrase}</p></body></html>`;

describe("l'empreinte n'est enregistrée qu'une fois le thème réellement terminé", () => {
  it("un arrêt pendant la relecture laisse le thème à refaire, même si d'anciennes mesures existent", async () => {
    const modifie = async () => new Response(html2(PHRASE + " Ajout au programme."), { status: 200, headers: { "content-type": "text/html" } });

    // 1. thème terminé sur la version initiale des documents
    const create1 = vi.fn().mockResolvedValueOnce(texte([mesure()])).mockResolvedValueOnce(verdicts([{ titre: "Suppression de la C3S", verdict: "PASS" }]));
    await executerCandidatCorpus({ messages: { create: create1 } }, META, [THEME], options({ synthese: vi.fn() }));
    expect(chargerPropositions("candidat-x", racine)).toHaveLength(1);

    // 2. documents modifiés : l'extraction réussit, la relecture tombe en panne (ou le budget l'interdit)
    const create2 = vi.fn().mockResolvedValueOnce(texte([mesure()])).mockRejectedValueOnce(new Error("panne pendant la relecture"));
    await executerCandidatCorpus({ messages: { create: create2 } }, META, [THEME], options({ synthese: vi.fn(), actualiser: true, fetchImpl: modifie }));
    expect(chargerJournal("candidat-x", racine)[0].empreinte_corpus).toBeUndefined();

    // 3. nouveau passage sur les mêmes documents modifiés : il ne doit PAS être ignoré ; l'extraction vient du cache
    const create3 = vi.fn().mockResolvedValueOnce(verdicts([{ titre: "Suppression de la C3S", verdict: "PASS" }]));
    await executerCandidatCorpus({ messages: { create: create3 } }, META, [THEME], options({ synthese: vi.fn(), fetchImpl: modifie, actualiser: true }));
    expect(create3).toHaveBeenCalledTimes(1);
    expect(chargerJournal("candidat-x", racine)[0].empreinte_corpus).toMatch(/^[0-9a-f]{16}$/);
  });
});
