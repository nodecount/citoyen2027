import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { localiserExtrait } from "../ingestion/corpus";
import { remplirGabarit } from "../ingestion/generate";
import { SUJETS_CONVICTION, trouverPosition, type PositionMesure } from "../positions";
import type { SortieCli } from "./claude-cli";
import { decouperEnGroupes, SCHEMA_VERIFICATION, TAILLE_GROUPE, type EntreeStructuration, type OutilsAppel } from "./structuration";

// Étiquetage des mesures par position (écologie, IA, Europe…) : un modèle (commande claude, sans API) dit quelle position
// chaque mesure défend ; le CODE vérifie que le sujet et la position existent au catalogue (src/positions.ts), que l'extrait
// est retrouvé mot pour mot dans le texte de la mesure, et un second appel relit. Une mesure dont une étiquette est refusée
// perd TOUTES ses étiquettes : mieux vaut pas d'étiquette qu'une étiquette fausse. Même esprit que structuration.ts.

const ICI = dirname(fileURLToPath(import.meta.url));
const LONGUEUR_MIN_TEXTE = 15;

export type ResultatEtiquetage = { statut: "etiquetee"; positions: PositionMesure[] } | { statut: "rejetee"; raison: string };

function positionsPossibles(): string[] {
  return [...new Set(SUJETS_CONVICTION.flatMap((s) => s.positions.map((p) => p.id)))];
}

export function schemaEtiquetage() {
  return {
    type: "object",
    properties: {
      resultats: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            positions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  sujet: { type: "string", enum: SUJETS_CONVICTION.map((s) => s.id) },
                  position: { type: "string", enum: positionsPossibles() },
                  extrait: { type: "string" },
                },
                required: ["sujet", "position", "extrait"],
                additionalProperties: false,
              },
            },
          },
          required: ["id", "positions"],
          additionalProperties: false,
        },
      },
    },
    required: ["resultats"],
    additionalProperties: false,
  } as const;
}

// Le catalogue tel que le lit le modèle : identifiants, libellés et DÉFINITIONS exactes (générées, jamais recopiées à la main).
export function descriptionSujets(): string {
  return SUJETS_CONVICTION.map((s) => `### ${s.libelle} — \`${s.id}\`\n${s.positions.map((p) => `- \`${p.id}\` (« ${p.libelle} ») : ${p.definition}.`).join("\n")}`).join("\n\n");
}

function lirePrompt(nom: string): string {
  return readFileSync(resolve(ICI, "prompts", nom), "utf-8");
}

// Change quand un prompt ou le catalogue change : les groupes déjà faits sont alors à refaire ; sinon ils sont ignorés.
export function empreintePromptsPositions(): string {
  return createHash("sha256").update(lirePrompt("positions.md")).update(lirePrompt("verification-positions.md")).update(descriptionSujets()).digest("hex").slice(0, 16);
}

export function empreinteGroupePositions(entrees: EntreeStructuration[]): string {
  const h = createHash("sha256").update(empreintePromptsPositions());
  for (const e of entrees) h.update(`\n${e.id}\n${e.texte}`);
  return h.digest("hex").slice(0, 16);
}

export { decouperEnGroupes, TAILLE_GROUPE };

function listeNumerotee(entrees: EntreeStructuration[]): string {
  return JSON.stringify(entrees.map((e) => ({ id: e.id, texte: e.texte })), null, 1);
}

export function construireRequetePositions(candidat: string, entrees: EntreeStructuration[]): { systeme: string; prompt: string } {
  const systeme = remplirGabarit(lirePrompt("positions.md"), { CANDIDAT: candidat, SUJETS: descriptionSujets() });
  return { systeme, prompt: `Propositions à étiqueter (${entrees.length}) :\n${listeNumerotee(entrees)}` };
}

export function construireRequeteVerificationPositions(
  candidat: string,
  entrees: EntreeStructuration[],
  positionsParId: Map<string, PositionMesure[]>,
): { systeme: string; prompt: string } {
  const systeme = remplirGabarit(lirePrompt("verification-positions.md"), { CANDIDAT: candidat, SUJETS: descriptionSujets() });
  const aRelire = entrees
    .filter((e) => (positionsParId.get(e.id) ?? []).length > 0)
    .map((e) => ({ id: e.id, texte: e.texte, positions: (positionsParId.get(e.id) ?? []).map(({ sujet, position, extrait }) => ({ sujet, position, extrait })) }));
  return { systeme, prompt: `Propositions et étiquettes à relire (${aRelire.length}) :\n${JSON.stringify(aRelire, null, 1)}` };
}

function debut(texte: string): string {
  return texte.length > 60 ? `${texte.slice(0, 60)}…` : texte;
}

// Contrôles déterministes : identifiants connus et non dupliqués, sujet et position du catalogue (la position doit appartenir
// au sujet), un seul choix par sujet, extrait retrouvé mot pour mot dans LE texte de la proposition. Non conforme : rejetée.
export function controlerReponsePositions(structure: unknown, entrees: EntreeStructuration[]): Map<string, ResultatEtiquetage> {
  const resultats = new Map<string, ResultatEtiquetage>();
  const parId = new Map(entrees.map((e) => [e.id, e]));
  const liste = (structure as { resultats?: unknown })?.resultats;
  if (!Array.isArray(liste)) throw new Error("Réponse inattendue : pas de tableau « resultats ».");

  const vus = new Set<string>();
  for (const brut of liste) {
    const id = (brut as { id?: unknown })?.id;
    if (typeof id !== "string" || !parId.has(id)) continue; // identifiant inventé : ignoré, la mesure réelle restera « sans réponse »
    if (vus.has(id)) {
      resultats.set(id, { statut: "rejetee", raison: "réponse en double pour cette proposition" });
      continue;
    }
    vus.add(id);
    const entree = parId.get(id)!;
    const brutes = (brut as { positions?: unknown }).positions;
    if (!Array.isArray(brutes)) {
      resultats.set(id, { statut: "rejetee", raison: "positions absentes ou mal formées" });
      continue;
    }
    const document = { id: entree.id, url: entree.url, nom: "source", annee: 0, type: "html" as const, texte: entree.texte };
    const positions: PositionMesure[] = [];
    const sujetsVus = new Set<string>();
    let raison: string | null = null;
    for (const b of brutes) {
      const { sujet, position, extrait } = (b ?? {}) as { sujet?: unknown; position?: unknown; extrait?: unknown };
      if (typeof sujet !== "string" || typeof position !== "string" || !trouverPosition(sujet, position)) {
        raison = "une étiquette cite un sujet ou une position qui n'existe pas (ou qui n'est pas de ce sujet)";
        break;
      }
      if (sujetsVus.has(sujet)) {
        raison = `deux positions pour le même sujet (${sujet})`;
        break;
      }
      sujetsVus.add(sujet);
      if (typeof extrait !== "string" || extrait.trim().length < 15 || extrait.length > 600) {
        raison = "l'extrait d'une étiquette est absent ou de longueur invalide";
        break;
      }
      if (!localiserExtrait(document, extrait).trouve) {
        raison = `l'extrait d'une étiquette n'est pas retrouvé dans le texte : « ${debut(extrait)} »`;
        break;
      }
      positions.push({ sujet, position, source_url: entree.url, extrait });
    }
    resultats.set(id, raison ? { statut: "rejetee", raison } : { statut: "etiquetee", positions });
  }
  for (const e of entrees) if (!resultats.has(e.id)) resultats.set(e.id, { statut: "rejetee", raison: "aucune réponse du modèle pour cette proposition" });
  return resultats;
}

export function appliquerVerdictsPositions(resultats: Map<string, ResultatEtiquetage>, verdicts: unknown): Map<string, ResultatEtiquetage> {
  const liste = (verdicts as { verdicts?: unknown })?.verdicts;
  if (!Array.isArray(liste)) throw new Error("Réponse de relecture inattendue : pas de tableau « verdicts ».");
  const parId = new Map<string, { verdict?: string; raison?: string }>();
  for (const v of liste) if (typeof (v as { id?: unknown })?.id === "string") parId.set((v as { id: string }).id, v as { verdict?: string; raison?: string });

  const final = new Map<string, ResultatEtiquetage>();
  for (const [id, resultat] of resultats) {
    if (resultat.statut !== "etiquetee" || resultat.positions.length === 0) {
      final.set(id, resultat); // rien à relire : aucune étiquette, ou déjà rejetée
      continue;
    }
    const verdict = parId.get(id);
    if (verdict?.verdict === "PASS") final.set(id, resultat);
    else final.set(id, { statut: "rejetee", raison: verdict?.verdict === "FAIL" ? `relecture : ${verdict.raison ?? "refusé sans raison"}` : "relecture : aucun verdict reçu" });
  }
  return final;
}

export interface RapportGroupePositions {
  resultats: Map<string, ResultatEtiquetage>;
  coutReferenceUsd: number;
  appels: number;
}

// Un groupe = un candidat, au plus TAILLE_GROUPE propositions (tous thèmes confondus : un sujet comme l'Europe ou l'IA traverse
// les thèmes). Deux appels : étiquetage, puis relecture des seules propositions étiquetées.
export async function etiqueterGroupe(candidat: string, entrees: EntreeStructuration[], outils: OutilsAppel): Promise<RapportGroupePositions> {
  const courtes = entrees.filter((e) => e.texte.trim().length < LONGUEUR_MIN_TEXTE);
  const aTraiter = entrees.filter((e) => e.texte.trim().length >= LONGUEUR_MIN_TEXTE);
  const resultats = new Map<string, ResultatEtiquetage>(courtes.map((e) => [e.id, { statut: "etiquetee", positions: [] }]));
  if (aTraiter.length === 0) return { resultats, coutReferenceUsd: 0, appels: 0 };

  const requete = construireRequetePositions(candidat, aTraiter);
  const premiere: SortieCli = await outils.appeler(requete.prompt, requete.systeme, schemaEtiquetage());
  const controles = controlerReponsePositions(premiere.structure, aTraiter);
  let cout = premiere.coutReferenceUsd;
  let appels = 1;

  let finaux = controles;
  const positionsParId = new Map<string, PositionMesure[]>();
  for (const [id, r] of controles) if (r.statut === "etiquetee") positionsParId.set(id, r.positions);
  if ([...positionsParId.values()].some((p) => p.length > 0)) {
    const relecture = construireRequeteVerificationPositions(candidat, aTraiter, positionsParId);
    const seconde = await outils.appeler(relecture.prompt, relecture.systeme, SCHEMA_VERIFICATION);
    cout += seconde.coutReferenceUsd;
    appels += 1;
    finaux = appliquerVerdictsPositions(controles, seconde.structure);
  }
  for (const [id, r] of finaux) resultats.set(id, r);
  return { resultats, coutReferenceUsd: cout, appels };
}
