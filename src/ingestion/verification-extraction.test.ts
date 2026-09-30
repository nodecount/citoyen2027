import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CandidatMeta } from "../types";
import { construireRequeteVerificationExtraction, verifierMesuresParPassages, type MesureAVerifier } from "./verification-extraction";

const META: CandidatMeta = { slug: "test", nom: "Candidat Test", parti: "P", sources_officielles: [], date_derniere_maj: "2026-09-26" };

function item(titre: string, texte = "Suppression de la C3S, soit 5,3 milliards d'euros."): MesureAVerifier {
  return {
    proposition: {
      titre, resume_factuel: "Le candidat propose de supprimer la C3S.", hypotheses_calcul: "5,3 milliards d'euros", chiffrage_disponible: true,
      statut: "complet", date_derniere_verification: "2026-09-26", effets: [],
      sources: [{ type: "primaire", label: "l", url: "https://exemple-officiel.fr/livret.pdf#page=2", nom: "exemple-officiel.fr", annee: 2022 }],
    },
    fenetres: [{ document: "livret", page: 2, texte }],
  };
}

describe("construireRequeteVerificationExtraction", () => {
  it("n'utilise aucun outil : le relecteur ne reçoit que les passages, il n'a rien à aller chercher", () => {
    const r = construireRequeteVerificationExtraction(META, [item("M1")]);
    expect(r.tools).toEqual([]);
    expect(r.model).toBe("claude-sonnet-5");
  });

  it("transmet, pour chaque mesure, ses affirmations, l'année de ses sources et ses passages", () => {
    const contenu = String(construireRequeteVerificationExtraction(META, [item("M1")]).messages[0].content);
    expect(contenu).toContain("M1");
    expect(contenu).toContain("Suppression de la C3S, soit 5,3 milliards");
    expect(contenu).toContain("2022");
    expect(contenu).toContain("livret");
  });

  it("demande de vérifier fidélité, ciblage, sens, datation et neutralité, sans sanctionner l'absence de mention", () => {
    const texte = construireRequeteVerificationExtraction(META, [item("M1")]).system.replace(/\s+/g, " ");
    expect(texte).toContain("Candidat Test");
    expect(texte).toContain("aucun vocabulaire évaluatif");
    expect(texte).toContain("second ordre");
    expect(texte).toContain("position de <année>");
    expect(texte).toContain("ne précise pas");
    expect(texte).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });
});

describe("informations de contexte de la relecture", () => {
  it("donne les libellés exacts des critères du profil (apprenti = apprenti ou alternant)", () => {
    const { system } = construireRequeteVerificationExtraction(META, [item("M1")]);
    expect(system).toContain("`apprenti` = Apprenti(e) ou alternant(e)");
    // Les champs dérivés (non posés tels quels dans le formulaire) sont des critères valides eux aussi.
    expect(system).toContain("`enfants_a_charge`");
    expect(system).toContain("`autre`");
  });

  it("sanctionne un critère voisin plus large que le public réel (règle commune à tous les candidats)", () => {
    const { system } = construireRequeteVerificationExtraction(META, [item("M1")]);
    expect(system).toContain("Critère voisin = FAIL");
    expect(system).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it("liste les documents du corpus (éditeur, année) pour juger l'attribution au parti", () => {
    const meta: CandidatMeta = {
      ...META,
      documents: [{ id: "22-mesures", url: "https://parti.example/22-mesures", nom: "parti.example (22 mesures 2022)", annee: 2022 }],
    };
    const contenu = String(construireRequeteVerificationExtraction(meta, [item("M1")]).messages[0].content);
    expect(contenu).toContain("https://parti.example/22-mesures");
    expect(contenu.indexOf("parti.example")).toBeLessThan(contenu.indexOf("M1")); // documents d'abord, puis les mesures
  });
});

describe("verifierMesuresParPassages", () => {
  let espions: Array<ReturnType<typeof vi.spyOn>>;
  beforeEach(() => {
    espions = [vi.spyOn(console, "log").mockImplementation(() => {})];
  });
  afterEach(() => espions.forEach((e) => e.mockRestore()));
  const client = (reponse: unknown) => ({ messages: { create: vi.fn().mockResolvedValue(reponse) } });

  it("renvoie un verdict par titre, avec la raison d'un échec", async () => {
    const c = client({
      content: [{ type: "text", text: JSON.stringify([{ titre: "M1", verdict: "PASS" }, { titre: "M2", verdict: "FAIL", raison: "effet trop large" }]) }],
      stop_reason: "end_turn",
    });
    const verdicts = await verifierMesuresParPassages(c, META, [item("M1"), item("M2")]);
    expect(verdicts.get("M1")).toEqual({ statut: "PASS" });
    expect(verdicts.get("M2")).toEqual({ statut: "FAIL", raison: "effet trop large" });
  });

  it("n'accepte une mesure que si toutes les relectures disent PASS (relecteur non stable)", async () => {
    const lecture = (verdict: string) => ({ content: [{ type: "text", text: JSON.stringify([{ titre: "M1", verdict, raison: "trop large" }]) }], stop_reason: "end_turn" });
    const c = { messages: { create: vi.fn().mockResolvedValueOnce(lecture("PASS")).mockResolvedValueOnce(lecture("FAIL")) } };
    const verdicts = await verifierMesuresParPassages(c, META, [item("M1")]);
    expect(c.messages.create).toHaveBeenCalledTimes(2);
    expect(verdicts.get("M1")).toEqual({ statut: "FAIL", raison: "trop large" });
  });

  it("une lecture sans verdict pour une mesure suffit à ne pas l'accepter", async () => {
    const pass = { content: [{ type: "text", text: JSON.stringify([{ titre: "M1", verdict: "PASS" }]) }], stop_reason: "end_turn" };
    const vide = { content: [{ type: "text", text: "[]" }], stop_reason: "end_turn" };
    const c = { messages: { create: vi.fn().mockResolvedValueOnce(pass).mockResolvedValueOnce(vide) } };
    expect((await verifierMesuresParPassages(c, META, [item("M1")])).has("M1")).toBe(false);
  });

  describe("verdict sur les effets, distinct de celui sur la mesure", () => {
    const avecEffet = (titre: string): MesureAVerifier => {
      const m = item(titre);
      m.proposition.effets = [{ cibles: [], dimension: "revenu_disponible", sens: "hausse", source_url: "u", extrait: "suppression de la C3S, soit 5,3 milliards" }];
      return m;
    };
    const lecture = (o: Record<string, unknown>) => ({ content: [{ type: "text", text: JSON.stringify([{ titre: "M1", ...o }]) }], stop_reason: "end_turn" });

    it("mesure PASS et effets FAIL : mesure gardée, effets écartés avec la raison", async () => {
      const c = client(lecture({ verdict: "PASS", verdict_effets: "FAIL", raison_effets: "cible trop large" }));
      expect((await verifierMesuresParPassages(c, META, [avecEffet("M1")])).get("M1")).toEqual({ statut: "PASS", effetsEcartes: "cible trop large" });
    });

    it("effets refusés par UNE SEULE lecture : écartés (toutes les lectures doivent les valider)", async () => {
      const c = { messages: { create: vi.fn().mockResolvedValueOnce(lecture({ verdict: "PASS", verdict_effets: "PASS" })).mockResolvedValueOnce(lecture({ verdict: "PASS", verdict_effets: "FAIL", raison_effets: "sens douteux" })) } };
      expect((await verifierMesuresParPassages(c, META, [avecEffet("M1")])).get("M1")).toMatchObject({ statut: "PASS", effetsEcartes: "sens douteux" });
    });

    it("relecteur silencieux sur les effets d'une mesure qui en a : effets écartés, jamais validés par défaut", async () => {
      const c = client(lecture({ verdict: "PASS" }));
      expect((await verifierMesuresParPassages(c, META, [avecEffet("M1")])).get("M1")).toMatchObject({ statut: "PASS", effetsEcartes: expect.stringContaining("pas rendu") });
    });

    it("mesure FAIL : la mesure est refusée, même si les effets sont PASS", async () => {
      const c = client(lecture({ verdict: "FAIL", raison: "mécanisme inventé", verdict_effets: "PASS" }));
      expect((await verifierMesuresParPassages(c, META, [avecEffet("M1")])).get("M1")).toEqual({ statut: "FAIL", raison: "mécanisme inventé" });
    });

    it("mesure et effets PASS : acceptée telle quelle, sans marque", async () => {
      const c = client(lecture({ verdict: "PASS", verdict_effets: "PASS" }));
      expect((await verifierMesuresParPassages(c, META, [avecEffet("M1")])).get("M1")).toEqual({ statut: "PASS" });
    });
  });

  it("ne renvoie rien pour une mesure sans verdict : jamais de PASS par défaut", async () => {
    const c = client({ content: [{ type: "text", text: JSON.stringify([{ titre: "M1", verdict: "PASS" }]) }], stop_reason: "end_turn" });
    const verdicts = await verifierMesuresParPassages(c, META, [item("M1"), item("M2")]);
    expect(verdicts.has("M2")).toBe(false);
  });

  it("n'appelle pas le modèle quand il n'y a rien à vérifier", async () => {
    const c = client({ content: [], stop_reason: "end_turn" });
    expect((await verifierMesuresParPassages(c, META, [])).size).toBe(0);
    expect(c.messages.create).not.toHaveBeenCalled();
  });

  it("lève si la sortie est tronquée : des verdicts incomplets ne valent pas des PASS", async () => {
    const c = client({ content: [{ type: "text", text: "[]" }], stop_reason: "max_tokens" });
    await expect(verifierMesuresParPassages(c, META, [item("M1")])).rejects.toThrow("tronquée");
  });
});
