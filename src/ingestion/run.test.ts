import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { executerCombinaison, genererIdProposition } from "./run";
import { chargerAVerifier, chargerPropositions } from "./depot";
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
