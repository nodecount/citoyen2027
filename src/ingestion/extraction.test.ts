import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VALEURS_PAR_CHAMP } from "../effets";
import type { CandidatMeta } from "../types";
import { construireCorpus } from "./corpus";
import type { TexteDocument } from "./documents";
import { SCHEMA_EXTRACTION, assemblerProposition, construireRequeteExtraction, extraireMesures, validerMesureModele, type MesureModele } from "./extraction";
import { validerPropositionGeneree } from "./schema";

const META: CandidatMeta = { slug: "test", nom: "Candidat Test", parti: "Parti Test", sources_officielles: [], date_derniere_maj: "2026-09-26" };

const LIVRET: TexteDocument = {
  id: "livret", url: "https://exemple-officiel.fr/livret.pdf", nom: "exemple-officiel.fr", annee: 2026, type: "pdf",
  texte:
    "[[page 1]]\nPréambule.\n[[page 2]]\nSuppression de la C3S, soit 5,3 milliards d'euros, dès l'entame du quinquennat.\n" +
    "[[page 3]]\nUn crédit d'impôt mensuel serait versé aux foyers les plus modestes de moins de 1 200 euros par mois.",
};
const PAGE: TexteDocument = {
  id: "page", url: "https://exemple-officiel.fr/propositions", nom: "exemple-officiel.fr", annee: 2022, type: "html",
  texte: "Le candidat défend la baisse de la TVA sur l'énergie, position ancienne toujours mise en avant.",
};
const CORPUS = construireCorpus([LIVRET, PAGE]);

function mesure(surcharge: Partial<MesureModele> = {}): MesureModele {
  return {
    titre: "Suppression de la C3S",
    resume_factuel: "Le candidat propose de supprimer la C3S ; le calendrier n'est pas précisé.",
    hypotheses_calcul: "Chiffrage du programme : 5,3 milliards d'euros.",
    chiffrage_disponible: true,
    statut: "complet",
    preuves: [{ document: "livret", extrait: "Suppression de la C3S, soit 5,3 milliards d'euros, dès l'entame du quinquennat" }],
    effets: [],
    ...surcharge,
  };
}

const THEME_A = { id: "fiscalite", libelle: "Mes impôts et taxes", description: "Impôts et taxes." };
const THEME_B = { id: "sante", libelle: "Ma santé", description: "Système de santé." };

describe("construireRequeteExtraction", () => {
  const requete = (theme = THEME_A, titres: string[] = []) => construireRequeteExtraction(META, CORPUS, theme.id, theme.libelle, theme.description, titres);

  it("n'utilise aucun outil web : un tour, sans boucle qui gonfle", () => {
    const r = requete();
    expect(r.tools).toEqual([]);
    expect(r.model).toBe("claude-sonnet-5");
  });

  it("laisse de la place au raisonnement : effort bas et limite haute, car les jetons de réflexion comptent dans max_tokens", () => {
    // Premier essai réel : 4 979 des 8 000 jetons de sortie partis en réflexion, réponse tronquée.
    const r = requete();
    expect(r.output_config.effort).toBe("low");
    expect(r.max_tokens).toBeGreaterThanOrEqual(12000);
    expect(r.max_tokens).toBeLessThanOrEqual(20000); // et un coût maximal prévisible
  });

  it("interdit de rattacher les impôts payés par les entreprises à un citoyen par déduction", () => {
    const texte = requete().system.replace(/\s+/g, " ");
    expect(texte).toContain("payés par les entreprises");
    expect(texte).toContain("ne sont pas des effets sur un citoyen");
    expect(texte).toContain("JAMAIS par déduction");
  });

  it("place le corpus dans un bloc marqué pour le cache, suivi de la question propre au thème", () => {
    const r = requete();
    const blocs = r.messages[0].content as Array<{ type: string; text?: string; cache_control?: unknown }>;
    expect(blocs).toHaveLength(2);
    expect(blocs[0].text).toContain(CORPUS.texte);
    expect(blocs[0].cache_control).toEqual({ type: "ephemeral" });
    expect(blocs[1].cache_control).toBeUndefined();
    expect(blocs[1].text).toContain("Mes impôts et taxes");
    expect(blocs[1].text).toContain("Impôts et taxes.");
  });

  it("garde un préfixe IDENTIQUE d'un thème à l'autre : condition pour que le cache serve", () => {
    const a = requete(THEME_A);
    const b = requete(THEME_B, ["Une mesure d'un autre thème"]);
    expect(a.system).toBe(b.system);
    const bloc0 = (r: typeof a) => JSON.stringify((r.messages[0].content as unknown[])[0]);
    expect(bloc0(a)).toBe(bloc0(b));
    expect(a.system).not.toContain("Mes impôts et taxes");
  });

  it("nomme le candidat, liste les champs de profil et ne laisse aucun marqueur non remplacé", () => {
    const { system } = requete();
    expect(system).toContain("Candidat Test");
    for (const champ of Object.keys(VALEURS_PAR_CHAMP)) expect(system).toContain(`\`${champ}\``);
    expect(system).not.toMatch(/\{\{[A-Z_]+\}\}/);
    const texte = system.replace(/\s+/g, " ");
    expect(texte).toContain("mot pour mot");
    expect(texte).toContain("Précision ou rien");
    expect(texte).toContain("position de <année>");
  });

  it("transmet les titres déjà écrits pour éviter les doublons, sans interpréter les motifs spéciaux", () => {
    const blocs = requete(THEME_A, ["Mesure « $& » à 5 $1"]).messages[0].content as Array<{ text?: string }>;
    expect(blocs[1].text).toContain("Mesure « $& » à 5 $1");
  });

  it("exige des preuves dans le schéma de sortie, sans minItems ni maxItems", () => {
    expect(JSON.stringify(SCHEMA_EXTRACTION)).not.toMatch(/minItems|maxItems/);
    expect(SCHEMA_EXTRACTION.items.required).toContain("preuves");
    expect(SCHEMA_EXTRACTION.items.properties).not.toHaveProperty("sources");
  });
});

describe("validerMesureModele", () => {
  const ids = ["livret", "page"];
  it("accepte une mesure complète, avec ou sans effets", () => {
    expect(validerMesureModele(mesure(), ids)).toBe(true);
  });
  it("refuse une mesure sans preuve, ou dont la preuve cite un document inconnu", () => {
    expect(validerMesureModele(mesure({ preuves: [] }), ids)).toBe(false);
    expect(validerMesureModele(mesure({ preuves: [{ document: "inconnu", extrait: "x".repeat(30) }] }), ids)).toBe(false);
  });
  it("refuse un effet à cibles invalides ou à document inconnu", () => {
    const effet = { cibles: [{ champ: "tranche_revenus", valeurs: ["tres_riche"] }], dimension: "revenu_disponible" as const, sens: "baisse" as const, document: "livret", extrait: "x".repeat(30) };
    expect(validerMesureModele(mesure({ effets: [effet] }), ids)).toBe(false);
    expect(validerMesureModele(mesure({ effets: [{ ...effet, cibles: [], document: "inconnu" }] }), ids)).toBe(false);
  });
  it("refuse une valeur qui n'est pas un objet ou qui manque d'un champ", () => {
    expect(validerMesureModele(null, ids)).toBe(false);
    const { titre: _t, ...sansTitre } = mesure();
    expect(validerMesureModele(sansTitre, ids)).toBe(false);
  });
});

describe("assemblerProposition", () => {
  it("fabrique la proposition : sources tirées de NOS documents (nom, année), page trouvée par le code", () => {
    const r = assemblerProposition(mesure(), CORPUS, "2026-09-26");
    if (!r.ok) throw new Error(r.raison);
    expect(r.proposition.sources).toHaveLength(1);
    expect(r.proposition.sources[0]).toMatchObject({ type: "primaire", nom: "exemple-officiel.fr", annee: 2026, url: "https://exemple-officiel.fr/livret.pdf#page=2" });
    expect(r.proposition.date_derniere_verification).toBe("2026-09-26");
    expect(validerPropositionGeneree(r.proposition)).toBe(true);
  });

  it("date une position ancienne avec l'année du document, sans que le modèle la dicte", () => {
    const m = mesure({ preuves: [{ document: "page", extrait: "défend la baisse de la TVA sur l'énergie, position ancienne" }], hypotheses_calcul: "", chiffrage_disponible: false });
    const r = assemblerProposition(m, CORPUS, "2026-09-26");
    if (!r.ok) throw new Error(r.raison);
    expect(r.proposition.sources[0].annee).toBe(2022);
    expect(r.proposition.sources[0].url).toBe("https://exemple-officiel.fr/propositions");
  });

  it("rejette une mesure dont l'extrait n'est pas dans le document cité, en le disant", () => {
    const r = assemblerProposition(mesure({ preuves: [{ document: "livret", extrait: "Une phrase que le programme ne contient absolument pas" }] }), CORPUS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.raison).toContain("extrait");
  });

  it("rejette un chiffre de hypotheses_calcul absent des documents cités", () => {
    const r = assemblerProposition(mesure({ hypotheses_calcul: "Chiffrage de 99 milliards d'euros." }), CORPUS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.raison).toContain("chiffre");
  });

  it("cite deux documents comme deux sources, dans l'ordre de première apparition", () => {
    const m = mesure({
      hypotheses_calcul: "",
      preuves: [
        { document: "page", extrait: "défend la baisse de la TVA sur l'énergie, position ancienne" },
        { document: "livret", extrait: "Suppression de la C3S, soit 5,3 milliards d'euros, dès l'entame" },
      ],
    });
    const r = assemblerProposition(m, CORPUS);
    if (!r.ok) throw new Error(r.raison);
    expect(r.proposition.sources.map((s) => s.annee)).toEqual([2022, 2026]);
  });

  it("vérifie aussi l'extrait de chaque effet et rattache l'effet à la source de son document", () => {
    const effet = { cibles: [{ champ: "tranche_revenus", valeurs: ["moins_1200"] }], dimension: "revenu_disponible" as const, sens: "hausse" as const, document: "livret", extrait: "crédit d'impôt mensuel serait versé aux foyers les plus modestes" };
    const ok = assemblerProposition(mesure({ effets: [effet] }), CORPUS);
    if (!ok.ok) throw new Error(ok.raison);
    expect(ok.proposition.effets[0].source_url).toBe(ok.proposition.sources[0].url);
    expect(ok.proposition.effets[0].extrait).toBe(effet.extrait);
    const ko = assemblerProposition(mesure({ effets: [{ ...effet, extrait: "un extrait d'effet complètement inventé par le modèle" }] }), CORPUS);
    expect(ko.ok).toBe(false);
    if (!ko.ok) expect(ko.raison).toContain("effet");
  });

  it("renvoie des fenêtres de contexte autour de chaque extrait, pour la relecture ciblée", () => {
    const r = assemblerProposition(mesure(), CORPUS);
    if (!r.ok) throw new Error(r.raison);
    expect(r.fenetres).toHaveLength(1);
    expect(r.fenetres[0]).toMatchObject({ document: "livret", page: 2 });
    expect(r.fenetres[0].texte).toContain("Suppression de la C3S");
  });
});

describe("extraireMesures", () => {
  let espions: Array<ReturnType<typeof vi.spyOn>>;
  beforeEach(() => {
    espions = [vi.spyOn(console, "log").mockImplementation(() => {}), vi.spyOn(console, "warn").mockImplementation(() => {})];
  });
  afterEach(() => espions.forEach((e) => e.mockRestore()));

  const client = (reponse: unknown) => ({ messages: { create: vi.fn().mockResolvedValue(reponse) } });
  const texte = (v: unknown) => ({ content: [{ type: "text", text: typeof v === "string" ? v : JSON.stringify(v) }], stop_reason: "end_turn", usage: { input_tokens: 10, output_tokens: 5 } });
  const appel = (c: ReturnType<typeof client>) => extraireMesures(c, META, CORPUS, THEME_A.id, THEME_A.libelle, THEME_A.description, []);

  it("renvoie les mesures valides et compte les écartées", async () => {
    const r = await appel(client(texte([mesure(), { titre: "incomplète" }])));
    expect(r.mesures).toHaveLength(1);
    expect(r.ecartees).toBe(1);
  });

  it("un [] explicite est « aucune mesure » ; tout le reste lève", async () => {
    expect((await appel(client(texte([])))).mesures).toEqual([]);
    await expect(appel(client({ content: [], stop_reason: "end_turn" }))).rejects.toThrow("aucune réponse textuelle");
    await expect(appel(client(texte("pas du JSON")))).rejects.toThrow("JSON");
    await expect(appel(client(texte({ pas: "un tableau" })))).rejects.toThrow("tableau");
    await expect(appel(client({ ...texte([]), stop_reason: "max_tokens" }))).rejects.toThrow("TRONQUÉE");
  });
});
