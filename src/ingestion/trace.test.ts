import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { diagnostiquerArret, ecrireTraceBrute } from "./trace";

describe("diagnostiquerArret", () => {
  it("nomme chaque cause d'arrêt en clair, et signale ce qui n'est pas une fin normale", () => {
    expect(diagnostiquerArret("end_turn", 16000).normal).toBe(true);
    const tronque = diagnostiquerArret("max_tokens", 16000);
    expect(tronque.normal).toBe(false);
    expect(tronque.texte).toContain("max_tokens");
    expect(tronque.texte).toContain("16000");
    expect(diagnostiquerArret("pause_turn", 16000).texte).toContain("boucle d'outils");
    expect(diagnostiquerArret("refusal", 16000).normal).toBe(false);
    expect(diagnostiquerArret(undefined, 16000).normal).toBe(false);
    expect(diagnostiquerArret(null, 16000).texte).toContain("inconnu");
  });
});

describe("ecrireTraceBrute", () => {
  let dossier: string;
  afterEach(() => rmSync(dossier, { recursive: true, force: true }));

  it("écrit la requête et la réponse complètes dans un fichier nommé par phase, candidat et thème", () => {
    dossier = mkdtempSync(resolve(tmpdir(), "trace-test-"));
    const chemin = ecrireTraceBrute(
      {
        phase: "generation",
        slug: "attal",
        themeId: "fiscalite",
        requete: { model: "claude-sonnet-5", system: "S" },
        reponse: { content: [{ type: "text", text: "[]" }], stop_reason: "end_turn" },
        dureeMs: 1234,
      },
      dossier,
    );
    expect(chemin).toBeDefined();
    const fichiers = readdirSync(dossier);
    expect(fichiers).toHaveLength(1);
    expect(fichiers[0]).toMatch(/generation-attal-fiscalite\.json$/);
    const contenu = JSON.parse(readFileSync(chemin!, "utf-8"));
    expect(contenu.requete.model).toBe("claude-sonnet-5");
    expect(contenu.reponse.stop_reason).toBe("end_turn");
    expect(contenu.duree_ms).toBe(1234);
  });

  it("garde aussi l'erreur quand l'appel a échoué, sans réponse", () => {
    dossier = mkdtempSync(resolve(tmpdir(), "trace-test-"));
    const chemin = ecrireTraceBrute(
      { phase: "verification", slug: "attal", requete: {}, erreur: "Request timed out", dureeMs: 600000 },
      dossier,
    );
    const contenu = JSON.parse(readFileSync(chemin!, "utf-8"));
    expect(contenu.erreur).toBe("Request timed out");
    expect(contenu.reponse).toBeUndefined();
  });

  it("ne lève jamais : une trace impossible à écrire ne doit pas faire perdre un appel déjà payé", () => {
    dossier = mkdtempSync(resolve(tmpdir(), "trace-test-"));
    // Le « dossier » est un fichier existant : mkdir échoue.
    const fichier = resolve(dossier, "fichier");
    ecrireTraceBrute({ phase: "generation", slug: "a", requete: {}, dureeMs: 1 }, dossier);
    expect(() =>
      ecrireTraceBrute({ phase: "generation", slug: "a", requete: {}, dureeMs: 1 }, resolve(dossier, readdirSync(dossier)[0], "sous")),
    ).not.toThrow();
    expect(fichier).toBeDefined();
  });
});
