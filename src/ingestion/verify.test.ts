import { describe, expect, it, vi } from "vitest";
import { construireRequeteVerification, verifier, verifierControlesDeterministes } from "./verify";
import type { CandidatMeta } from "../types";
import type { PropositionGeneree } from "./schema";

const META: CandidatMeta = {
  slug: "test",
  nom: "Candidat Test",
  parti: "Parti Test",
  date_derniere_maj: "2026-09-18",
  sources_officielles: [{ type: "primaire", label: "Programme", url: "https://exemple-officiel.fr/programme" }],
};

const META_DOMAINE_INVALIDE: CandidatMeta = {
  slug: "test-invalide",
  nom: "Candidat Invalide",
  parti: "Parti Test",
  date_derniere_maj: "2026-09-18",
  sources_officielles: [{ type: "primaire", label: "Programme", url: "pas-une-url" }],
};

function proposition(overrides: Partial<PropositionGeneree> = {}): PropositionGeneree {
  return {
    titre: "Titre",
    resume_factuel: "Résumé",
    sources: [{ type: "primaire", label: "A", url: "https://exemple-officiel.fr/a" }],
    chiffrage_disponible: true,
    hypotheses_calcul: "Coût de 1000 euros",
    statut: "complet",
    date_derniere_verification: "2026-09-18",
    effets: [],
    ...overrides,
  };
}

describe("verifierControlesDeterministes", () => {
  it("échoue si une source est hors domaine autorisé", async () => {
    const p = proposition({ sources: [{ type: "primaire", label: "A", url: "https://autre-site.fr/a" }] });
    const verdict = await verifierControlesDeterministes(p, ["exemple-officiel.fr"]);
    expect(verdict.statut).toBe("FAIL");
  });

  it("échoue si une source est inaccessible", async () => {
    const fetchFactice = async () => new Response("", { status: 404 });
    const verdict = await verifierControlesDeterministes(proposition(), ["exemple-officiel.fr"], fetchFactice);
    expect(verdict.statut).toBe("FAIL");
  });

  it("échoue si un chiffre cité n'apparaît dans aucune source", async () => {
    const fetchFactice = async () => new Response("Texte sans rapport avec le chiffre cité.");
    const verdict = await verifierControlesDeterministes(proposition(), ["exemple-officiel.fr"], fetchFactice);
    expect(verdict.statut).toBe("FAIL");
  });

  it("passe si le domaine, la disponibilité et le chiffre sont corrects", async () => {
    const fetchFactice = async () => new Response("Le dispositif coûte 1000 euros par an.");
    const verdict = await verifierControlesDeterministes(proposition(), ["exemple-officiel.fr"], fetchFactice);
    expect(verdict.statut).toBe("PASS");
  });
});

describe("verifier", () => {
  it("n'appelle jamais le modèle pour une proposition qui échoue les contrôles déterministes", async () => {
    const fetchFactice = async () => new Response("", { status: 404 });
    const create = vi.fn();
    const resultats = await verifier({ messages: { create } }, META, [proposition()], fetchFactice);
    expect(create).not.toHaveBeenCalled();
    expect(resultats.get("Titre")?.statut).toBe("FAIL");
  });

  it("soumet au modèle uniquement les propositions qui passent les contrôles déterministes", async () => {
    const fetchFactice = async () => new Response("Le dispositif coûte 1000 euros par an.");
    const create = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify([{ titre: "Titre", verdict: "PASS" }]) }],
    });
    const resultats = await verifier({ messages: { create } }, META, [proposition()], fetchFactice);
    expect(create).toHaveBeenCalledOnce();
    expect(resultats.get("Titre")?.statut).toBe("PASS");
  });

  it("ne lève pas d'exception si la réponse du modèle n'est pas un JSON valide", async () => {
    const fetchFactice = async () => new Response("Le dispositif coûte 1000 euros par an.");
    const create = vi.fn().mockResolvedValue({ content: [{ type: "text", text: "pas du JSON {{{" }] });
    const resultats = await verifier({ messages: { create } }, META, [proposition()], fetchFactice);
    expect(resultats.get("Titre")).toBeUndefined();
  });

  it("rejette si stop_reason vaut refusal, au lieu de retourner silencieusement un résultat vide", async () => {
    const fetchFactice = async () => new Response("Le dispositif coûte 1000 euros par an.");
    const create = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "[]" }],
      stop_reason: "refusal",
    });
    await expect(verifier({ messages: { create } }, META, [proposition()], fetchFactice)).rejects.toThrow();
  });

  it("rejette si un bloc web_fetch_tool_result contient une erreur d'outil serveur", async () => {
    const fetchFactice = async () => new Response("Le dispositif coûte 1000 euros par an.");
    const create = vi.fn().mockResolvedValue({
      content: [{ type: "web_fetch_tool_result", content: { error_code: "max_uses_exceeded" } }],
    });
    await expect(verifier({ messages: { create } }, META, [proposition()], fetchFactice)).rejects.toThrow();
  });

  it("ignore les éléments malformés de la réponse de vérification sémantique sans lever d'exception", async () => {
    const fetchFactice = async () => new Response("Le dispositif coûte 1000 euros par an.");
    const create = vi.fn().mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify([{ titre: "Titre", verdict: "PASS" }, null, { titre: 42, verdict: "FAIL" }]),
        },
      ],
    });
    const resultats = await verifier({ messages: { create } }, META, [proposition()], fetchFactice);
    expect(resultats.size).toBe(1);
    expect(resultats.get("Titre")?.statut).toBe("PASS");
  });
});

describe("construireRequeteVerification", () => {
  it("lève une exception si aucun domaine officiel exploitable n'est disponible", () => {
    expect(() => construireRequeteVerification(META_DOMAINE_INVALIDE, [proposition()])).toThrow();
  });
});
