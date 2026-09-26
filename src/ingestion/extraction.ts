import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CHAMPS_CIBLES, DIMENSIONS_EFFET, SENS_EFFET, validerEffet, type CritereCible, type DimensionEffet, type Effet, type SensEffet } from "../effets";
import type { CandidatMeta, Source, StatutProposition } from "../types";
import { appeler } from "./appel";
import { verifierChiffresPresents } from "./checks";
import { fenetreAutour, localiserExtrait, type Corpus } from "./corpus";
import {
  descriptionChampsProfil,
  detecterErreurReponse,
  remplirGabarit,
  type ClientAnthropicMinimal,
  type ReponseAnthropicMinimale,
  type RequeteGeneration,
} from "./generate";
import { SOURCES_MINIMUM, type PropositionGeneree } from "./schema";
import { diagnostiquerArret } from "./trace";

// Extraction par corpus : le modèle ne lit que le texte que nous lui donnons (voir documents.ts et
// corpus.ts), en un tour et sans outil. Ce qu'il renvoie est une « mesure » avec des PREUVES ; c'est le code
// qui retrouve chaque extrait dans le texte, en déduit la page, fabrique les sources (nom et année viennent de
// nos données) et construit la proposition finale.

const ICI = dirname(fileURLToPath(import.meta.url));
const MODELE = "claude-sonnet-5";
// Les jetons de RAISONNEMENT comptent dans max_tokens : au premier essai réel, 4 979 des 8 000 jetons de sortie
// sont partis en réflexion et la réponse a été tronquée. Effort réduit (l'extraction guidée par des citations
// n'a pas besoin d'un long raisonnement) et limite relevée ; la borne garde un coût maximal prévisible.
export const MAX_TOKENS_EXTRACTION = 16000;
const EFFORT = "low";

export interface PreuveModele {
  document: string;
  extrait: string;
}

export interface EffetModele {
  cibles: CritereCible[];
  dimension: DimensionEffet;
  sens: SensEffet;
  document: string;
  extrait: string;
}

export interface MesureModele {
  titre: string;
  resume_factuel: string;
  hypotheses_calcul: string;
  chiffrage_disponible: boolean;
  statut: StatutProposition;
  preuves: PreuveModele[];
  effets: EffetModele[];
}

// Pas de minItems/maxItems : l'API n'accepte que 0 ou 1. Les contraintes fines sont vérifiées par le code.
export const SCHEMA_EXTRACTION = {
  type: "array",
  items: {
    type: "object",
    properties: {
      titre: { type: "string" },
      resume_factuel: { type: "string" },
      hypotheses_calcul: { type: "string" },
      chiffrage_disponible: { type: "boolean" },
      statut: { type: "string", enum: ["complet", "partiel", "provisoire"] },
      preuves: {
        type: "array",
        items: {
          type: "object",
          properties: { document: { type: "string" }, extrait: { type: "string" } },
          required: ["document", "extrait"],
          additionalProperties: false,
        },
      },
      effets: {
        type: "array",
        items: {
          type: "object",
          properties: {
            cibles: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  champ: { type: "string", enum: [...CHAMPS_CIBLES] },
                  valeurs: { type: "array", items: { type: "string" } },
                },
                required: ["champ", "valeurs"],
                additionalProperties: false,
              },
            },
            dimension: { type: "string", enum: [...DIMENSIONS_EFFET] },
            sens: { type: "string", enum: [...SENS_EFFET] },
            document: { type: "string" },
            extrait: { type: "string" },
          },
          required: ["cibles", "dimension", "sens", "document", "extrait"],
          additionalProperties: false,
        },
      },
    },
    required: ["titre", "resume_factuel", "hypotheses_calcul", "chiffrage_disponible", "statut", "preuves", "effets"],
    additionalProperties: false,
  },
} as const;

// Le préfixe (règles + corpus) est IDENTIQUE d'un thème à l'autre : c'est la condition pour que le cache de
// prompt serve. Tout ce qui change avec le thème (libellé, périmètre, titres déjà écrits) est dans le dernier
// bloc, qui n'est pas mis en cache.
export function construireRequeteExtraction(
  meta: CandidatMeta,
  corpus: Corpus,
  themeId: string,
  themeLibelle: string,
  themeDescription: string,
  titresExistants: string[],
): RequeteGeneration {
  const gabarit = readFileSync(resolve(ICI, "prompts/extraction.md"), "utf-8");
  const system = remplirGabarit(gabarit, {
    CANDIDAT: meta.nom,
    DATE: new Date().toISOString().slice(0, 10),
    CHAMPS_PROFIL: descriptionChampsProfil(),
  });
  const titres =
    titresExistants.length > 0
      ? titresExistants.map((t) => `  - ${t}`).join("\n")
      : "  (aucune mesure déjà écrite pour ce candidat)";

  return {
    model: MODELE,
    max_tokens: MAX_TOKENS_EXTRACTION,
    system,
    tools: [],
    output_config: { format: { type: "json_schema", schema: SCHEMA_EXTRACTION }, effort: EFFORT },
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: `CORPUS — documents officiels de ${meta.nom}\n\n${corpus.texte}`, cache_control: { type: "ephemeral" } },
          {
            type: "text",
            text:
              `Thème : « ${themeLibelle} » (id interne : ${themeId}). Périmètre : ${themeDescription}\n` +
              `Extrais toutes les mesures du corpus qui relèvent de ce périmètre, avec leurs preuves.\n` +
              `Mesures déjà écrites pour ce candidat sur d'autres thèmes (n'en fais pas de doublon ; si une mesure recoupe l'une d'elles, ` +
              `dis-le en clair dans resume_factuel) :\n${titres}`,
          },
        ],
      },
    ],
  };
}

const STATUTS: StatutProposition[] = ["complet", "partiel", "provisoire"];

function preuveValide(valeur: unknown, ids: string[]): valeur is PreuveModele {
  if (typeof valeur !== "object" || valeur === null) return false;
  const p = valeur as Record<string, unknown>;
  return typeof p.document === "string" && ids.includes(p.document) && typeof p.extrait === "string" && p.extrait.length > 0;
}

// Structure seulement : la vérité de chaque extrait est établie par assemblerProposition.
export function validerMesureModele(valeur: unknown, idsDocuments: string[]): valeur is MesureModele {
  if (typeof valeur !== "object" || valeur === null) return false;
  const m = valeur as Record<string, unknown>;
  if (typeof m.titre !== "string" || m.titre.length === 0) return false;
  if (typeof m.resume_factuel !== "string" || m.resume_factuel.length === 0) return false;
  if (typeof m.hypotheses_calcul !== "string" || typeof m.chiffrage_disponible !== "boolean") return false;
  if (!STATUTS.includes(m.statut as StatutProposition)) return false;
  if (!Array.isArray(m.preuves) || m.preuves.length < SOURCES_MINIMUM) return false;
  if (!m.preuves.every((p) => preuveValide(p, idsDocuments))) return false;
  if (!Array.isArray(m.effets)) return false;
  for (const e of m.effets) {
    if (!preuveValide(e, idsDocuments)) return false;
    const effet = e as unknown as EffetModele;
    // On réutilise les règles de validerEffet (cibles, dimension, sens, longueur de l'extrait).
    if (!validerEffet({ cibles: effet.cibles, dimension: effet.dimension, sens: effet.sens, source_url: "x", extrait: effet.extrait }, ["x"])) {
      return false;
    }
  }
  return true;
}

export interface Fenetre {
  document: string;
  page?: number;
  texte: string;
}

export type Assemblage = { ok: true; proposition: PropositionGeneree; fenetres: Fenetre[] } | { ok: false; raison: string };

function debut(extrait: string): string {
  return extrait.length > 70 ? `${extrait.slice(0, 70)}…` : extrait;
}

// Contrôles déterministes + assemblage : chaque extrait doit être retrouvé mot pour mot dans le texte
// extrait du document cité ; les chiffres cités doivent figurer dans les documents cités. Les sources sont
// fabriquées ici, à partir de nos documents.
export function assemblerProposition(mesure: MesureModele, corpus: Corpus, dateISO: string = new Date().toISOString().slice(0, 10)): Assemblage {
  const ordre: string[] = [];
  const premierePage = new Map<string, number | undefined>();
  const fenetres: Fenetre[] = [];

  const localiser = (genre: "preuve" | "effet", element: PreuveModele): string | null => {
    const doc = corpus.parId.get(element.document);
    if (!doc) return `${genre} : document « ${element.document} » inconnu`;
    const loc = localiserExtrait(doc, element.extrait);
    if (!loc.trouve) {
      return `${genre === "effet" ? "l'extrait d'un effet" : "l'extrait d'une preuve"} n'est pas retrouvé dans le document « ${doc.id} » : « ${debut(element.extrait)} »`;
    }
    if (!ordre.includes(doc.id)) {
      ordre.push(doc.id);
      premierePage.set(doc.id, loc.page);
    } else if (premierePage.get(doc.id) === undefined && loc.page !== undefined) {
      premierePage.set(doc.id, loc.page);
    }
    const texte = fenetreAutour(doc, loc.debut!, loc.fin!);
    if (!fenetres.some((f) => f.document === doc.id && f.texte === texte)) fenetres.push({ document: doc.id, page: loc.page, texte });
    return null;
  };

  for (const preuve of mesure.preuves) {
    const erreur = localiser("preuve", preuve);
    if (erreur) return { ok: false, raison: erreur };
  }
  for (const effet of mesure.effets) {
    const erreur = localiser("effet", effet);
    if (erreur) return { ok: false, raison: erreur };
  }

  const citees = ordre.map((id) => corpus.parId.get(id)!);
  if (!verifierChiffresPresents(mesure.hypotheses_calcul, citees.map((d) => d.texte).join("\n"))) {
    return { ok: false, raison: "un chiffre cité dans hypotheses_calcul n'apparaît dans aucun document cité" };
  }

  const urlDe = new Map<string, string>();
  const sources: Source[] = citees.map((d) => {
    const page = premierePage.get(d.id);
    const url = d.type === "pdf" && page ? `${d.url}#page=${page}` : d.url;
    urlDe.set(d.id, url);
    return { type: "primaire", label: `${d.nom} — ${d.id}`, url, nom: d.nom, annee: d.annee };
  });

  const effets: Effet[] = mesure.effets.map((e) => ({
    cibles: e.cibles,
    dimension: e.dimension,
    sens: e.sens,
    source_url: urlDe.get(e.document)!,
    extrait: e.extrait,
  }));

  return {
    ok: true,
    fenetres,
    proposition: {
      titre: mesure.titre,
      resume_factuel: mesure.resume_factuel,
      sources,
      chiffrage_disponible: mesure.chiffrage_disponible,
      hypotheses_calcul: mesure.hypotheses_calcul,
      statut: mesure.statut,
      date_derniere_verification: dateISO,
      effets,
    },
  };
}

export interface ResultatExtraction {
  mesures: MesureModele[];
  ecartees: number;
  reponse: ReponseAnthropicMinimale;
  dureeMs: number;
  cheminTrace?: string;
}

// Un `[]` explicite est le SEUL cas « aucune mesure » ; texte absent, JSON invalide, sortie tronquée ou
// refus lèvent, pour qu'un arrêt anormal ne se lise jamais comme « rien sur ce thème ».
export async function extraireMesures(
  client: ClientAnthropicMinimal,
  meta: CandidatMeta,
  corpus: Corpus,
  themeId: string,
  themeLibelle: string,
  themeDescription: string,
  titresExistants: string[],
): Promise<ResultatExtraction> {
  const requete = construireRequeteExtraction(meta, corpus, themeId, themeLibelle, themeDescription, titresExistants);
  const contexte = `extraireMesures (${meta.slug} × ${themeId})`;
  const { reponse, dureeMs, cheminTrace } = await appeler(client, requete, { phase: "extraction", slug: meta.slug, themeId });

  if (reponse.stop_reason === "max_tokens") {
    throw new Error(`${contexte} : ${diagnostiquerArret(reponse.stop_reason, requete.max_tokens).texte}. Rien n'est enregistré.`);
  }
  const erreur = detecterErreurReponse(reponse);
  if (erreur) throw new Error(`${contexte} : ${erreur}`);

  const texte = [...reponse.content].reverse().find((b) => b.type === "text" && b.text)?.text;
  if (!texte) {
    throw new Error(`${contexte} : aucune réponse textuelle (arrêt : ${diagnostiquerArret(reponse.stop_reason, requete.max_tokens).texte})`);
  }
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch {
    throw new Error(`${contexte} : la réponse n'est pas du JSON valide : « ${texte.slice(0, 200)} »`);
  }
  if (!Array.isArray(brut)) throw new Error(`${contexte} : la réponse est du JSON mais pas un tableau : « ${texte.slice(0, 200)} »`);

  const ids = [...corpus.parId.keys()];
  const mesures = brut.filter((m): m is MesureModele => validerMesureModele(m, ids));
  const ecartees = brut.length - mesures.length;
  if (ecartees > 0) console.warn(`[extraction] ${contexte} : ${ecartees} mesure(s) écartée(s), structure ou effets invalides (voir la trace)`);
  return { mesures, ecartees, reponse, dureeMs, cheminTrace };
}
