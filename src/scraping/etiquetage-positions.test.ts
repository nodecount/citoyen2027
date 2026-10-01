import { describe, expect, it } from "vitest";
import {
  appliquerVerdictsPositions,
  construireRequetePositions,
  controlerReponsePositions,
  descriptionSujets,
  empreintePromptsPositions,
  etiqueterGroupe,
  schemaEtiquetage,
} from "./etiquetage-positions";
import type { EntreeStructuration } from "./structuration";
import { SUJETS_CONVICTION } from "../positions";

const entree = (id: string, texte: string): EntreeStructuration => ({ id, texte, url: "https://exemple.fr/" + id });
const A = entree("a", "Sortir progressivement du nucléaire d'ici 2050 et fermer les réacteurs les plus anciens.");
const B = entree("b", "Relever l'âge légal de départ à la retraite à 65 ans.");
const C = entree("c", "Organiser une conférence annuelle.");

describe("catalogue donné au modèle", () => {
  it("le prompt reçoit tous les sujets, positions et définitions, générés depuis le catalogue", () => {
    const { systeme } = construireRequetePositions("Candidat X", [A]);
    for (const s of SUJETS_CONVICTION) {
      expect(systeme).toContain(`\`${s.id}\``);
      for (const p of s.positions) {
        expect(systeme).toContain(`\`${p.id}\``);
        expect(systeme).toContain(p.definition);
      }
    }
    expect(systeme).not.toContain("{{");
    expect(descriptionSujets()).toContain("Écologie et énergie");
  });
  it("le schéma de réponse n'accepte que des sujets et positions du catalogue", () => {
    const item = schemaEtiquetage().properties.resultats.items.properties.positions.items.properties;
    expect(item.sujet.enum).toEqual(SUJETS_CONVICTION.map((s) => s.id));
    expect(item.position.enum).toContain("sortir_nucleaire");
    expect(item.position.enum).not.toContain("pas_d_avis");
  });
  it("l'empreinte des prompts est stable", () => {
    expect(empreintePromptsPositions()).toBe(empreintePromptsPositions());
  });
});

describe("controlerReponsePositions", () => {
  const bonne = { sujet: "ecologie", position: "sortir_nucleaire", extrait: "Sortir progressivement du nucléaire d'ici 2050" };
  it("accepte une étiquette dont l'extrait est retrouvé mot pour mot", () => {
    const r = controlerReponsePositions({ resultats: [{ id: "a", positions: [bonne] }] }, [A]);
    expect(r.get("a")).toEqual({ statut: "etiquetee", positions: [{ ...bonne, source_url: "https://exemple.fr/a" }] });
  });
  it("rejette un extrait paraphrasé ou inventé", () => {
    const r = controlerReponsePositions({ resultats: [{ id: "a", positions: [{ ...bonne, extrait: "Le candidat veut abandonner complètement l'atome" }] }] }, [A]);
    expect(r.get("a")).toMatchObject({ statut: "rejetee" });
    expect((r.get("a") as { raison: string }).raison).toContain("pas retrouvé");
  });
  it("rejette une position qui n'appartient pas au sujet indiqué", () => {
    const r = controlerReponsePositions({ resultats: [{ id: "a", positions: [{ ...bonne, sujet: "ia" }] }] }, [A]);
    expect(r.get("a")).toMatchObject({ statut: "rejetee" });
  });
  it("rejette deux positions sur un même sujet", () => {
    const r = controlerReponsePositions(
      { resultats: [{ id: "a", positions: [bonne, { sujet: "ecologie", position: "garder_nucleaire", extrait: "fermer les réacteurs les plus anciens" }] }] },
      [A],
    );
    expect((r.get("a") as { raison: string }).raison).toContain("même sujet");
  });
  it("une proposition sans étiquette est valide (réponse fréquente) ; une oubliée est rejetée ; un identifiant inventé est ignoré", () => {
    const r = controlerReponsePositions({ resultats: [{ id: "c", positions: [] }, { id: "zzz", positions: [bonne] }] }, [C, B]);
    expect(r.get("c")).toEqual({ statut: "etiquetee", positions: [] });
    expect(r.get("b")).toMatchObject({ statut: "rejetee" });
    expect(r.has("zzz")).toBe(false);
  });
  it("réponse en double : rejetée ; réponse mal formée : erreur explicite", () => {
    const r = controlerReponsePositions({ resultats: [{ id: "c", positions: [] }, { id: "c", positions: [] }] }, [C]);
    expect(r.get("c")).toMatchObject({ statut: "rejetee" });
    expect(() => controlerReponsePositions({}, [C])).toThrow();
  });
});

describe("appliquerVerdictsPositions", () => {
  const etiquetee = { statut: "etiquetee" as const, positions: [{ sujet: "ecologie", position: "sortir_nucleaire", source_url: "u", extrait: "e".repeat(20) }] };
  it("PASS garde l'étiquette ; FAIL ou verdict absent la retire avec la raison", () => {
    const entrees = new Map([["a", etiquetee], ["b", etiquetee], ["c", etiquetee]]);
    const final = appliquerVerdictsPositions(entrees, { verdicts: [{ id: "a", verdict: "PASS" }, { id: "b", verdict: "FAIL", raison: "sens inversé" }] });
    expect(final.get("a")).toEqual(etiquetee);
    expect(final.get("b")).toEqual({ statut: "rejetee", raison: "relecture : sens inversé" });
    expect(final.get("c")).toMatchObject({ statut: "rejetee" });
  });
  it("ne relit pas ce qui n'a pas d'étiquette", () => {
    const final = appliquerVerdictsPositions(new Map([["c", { statut: "etiquetee" as const, positions: [] }]]), { verdicts: [] });
    expect(final.get("c")).toEqual({ statut: "etiquetee", positions: [] });
  });
});

describe("etiqueterGroupe", () => {
  const sortie = (structure: unknown) => ({ structure, coutReferenceUsd: 0.01 }) as never;
  it("deux appels : étiquetage puis relecture ; une étiquette refusée à la relecture disparaît", async () => {
    let appels = 0;
    const outils = {
      appeler: async (_p: string, _s: string, schema: object) => {
        appels += 1;
        if ("properties" in schema && (schema as { properties: Record<string, unknown> }).properties.verdicts) {
          return sortie({ verdicts: [{ id: "a", verdict: "PASS" }, { id: "b", verdict: "FAIL", raison: "interprétation" }] });
        }
        return sortie({
          resultats: [
            { id: "a", positions: [{ sujet: "ecologie", position: "sortir_nucleaire", extrait: "Sortir progressivement du nucléaire d'ici 2050" }] },
            { id: "b", positions: [{ sujet: "travail", position: "travailler_plus", extrait: "Relever l'âge légal de départ à la retraite à 65 ans" }] },
            { id: "c", positions: [] },
          ],
        });
      },
    };
    const rapport = await etiqueterGroupe("X", [A, B, C], outils);
    expect(appels).toBe(2);
    expect(rapport.appels).toBe(2);
    expect(rapport.resultats.get("a")).toMatchObject({ statut: "etiquetee" });
    expect(rapport.resultats.get("b")).toMatchObject({ statut: "rejetee" });
    expect(rapport.resultats.get("c")).toEqual({ statut: "etiquetee", positions: [] });
  });
  it("aucune étiquette : pas de relecture (un seul appel)", async () => {
    let appels = 0;
    const outils = { appeler: async () => (appels += 1, sortie({ resultats: [{ id: "c", positions: [] }] })) };
    const rapport = await etiqueterGroupe("X", [C], outils);
    expect(appels).toBe(1);
    expect(rapport.appels).toBe(1);
  });
  it("textes trop courts : sans appel", async () => {
    const outils = { appeler: async () => { throw new Error("ne doit pas être appelé"); } };
    const rapport = await etiqueterGroupe("X", [entree("t", "court")], outils);
    expect(rapport.appels).toBe(0);
  });
});
