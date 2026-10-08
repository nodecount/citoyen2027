import { readFileSync } from "node:fs";
import { champsDeBase, valeursParChamp } from "../schemaBase";
import { BASE_INGESTION } from "./base";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CandidatMeta } from "../types";
import { appeler } from "./appel";
import type { Fenetre } from "./extraction";
import { detecterErreurReponse, remplirGabarit, type ClientAnthropicMinimal, type RequeteGeneration } from "./generate";
import type { PropositionGeneree } from "./schema";
import type { Verdict } from "./verify";

// Relecture ciblée : le modèle ne voit que la fiche et les passages du document (fenêtres autour des extraits
// que le code a déjà retrouvés mot pour mot). Pas d'outil, pas de page à aller chercher — quelques milliers
// de jetons, contre ~250 000 et 56 lectures ratées pour l'ancienne relecture par outil web.

const ICI = dirname(fileURLToPath(import.meta.url));
const MODELE = "claude-sonnet-5";
const MAX_TOKENS = 4000;

export interface MesureAVerifier {
  proposition: PropositionGeneree;
  fenetres: Fenetre[];
}

const SCHEMA_VERDICTS = {
  type: "array",
  items: {
    type: "object",
    properties: {
      titre: { type: "string" },
      verdict: { type: "string", enum: ["PASS", "FAIL"] },
      raison: { type: "string" },
      verdict_effets: { type: "string", enum: ["PASS", "FAIL"] },
      raison_effets: { type: "string" },
    },
    required: ["titre", "verdict", "verdict_effets"],
    additionalProperties: false,
  },
} as const;

// Libellés exacts des critères du profil : sans eux, le relecteur juge « apprenti » plus étroit qu'« apprentis et
// alternants » alors que le formulaire dit « Apprenti(e) ou alternant(e) ».
// La liste vient de valeursParChamp (tous les critères que les effets peuvent cibler, y compris les champs dérivés
// comme `enfants_a_charge`) : le relecteur ne doit jamais croire qu'un critère valide « n'existe pas ».
export function descriptionLibellesProfil(): string {
  const schema = new Map(champsDeBase(BASE_INGESTION).map((c) => [c.id, c]));
  const lignes = Object.entries(valeursParChamp(BASE_INGESTION)).map(([champ, valeurs]) => {
    const def = schema.get(champ);
    const nom = def?.label ?? (champ === "enfants_a_charge" ? "Enfants à charge (déduit du nombre d'enfants ; trois_ou_plus = au moins trois)" : champ);
    return `- \`${champ}\` (${nom}) : ${valeurs.map((v) => `\`${v}\` = ${def?.libelles?.[v] ?? v}`).join(" ; ")}`;
  });
  lignes.push("- `autre` : critère de secours pour un public que le profil ne sait pas décrire (voir plus haut).");
  return lignes.join("\n");
}

export function construireRequeteVerificationExtraction(meta: CandidatMeta, mesures: MesureAVerifier[]): RequeteGeneration {
  const gabarit = readFileSync(resolve(ICI, "prompts/verification-extraction.md"), "utf-8");
  const donnees = mesures.map(({ proposition: p, fenetres }) => ({
    titre: p.titre,
    resume_factuel: p.resume_factuel,
    hypotheses_calcul: p.hypotheses_calcul,
    sources: p.sources.map((s) => ({ nom: s.nom, annee: s.annee })),
    effets: p.effets.map((e) => ({ cibles: e.cibles, dimension: e.dimension, sens: e.sens, extrait: e.extrait })),
    passages: fenetres.map((f) => ({ document: f.document, page: f.page, texte: f.texte })),
  }));
  const documents = (meta.documents ?? []).map((d) => ({ id: d.id, nom: d.nom, annee: d.annee, url: d.url }));
  return {
    model: MODELE,
    max_tokens: MAX_TOKENS,
    system: remplirGabarit(gabarit, { CANDIDAT: meta.nom, LIBELLES_PROFIL: descriptionLibellesProfil() }),
    tools: [],
    output_config: { format: { type: "json_schema", schema: SCHEMA_VERDICTS }, effort: "medium" },
    messages: [
      {
        role: "user",
        content:
          `Documents du corpus (identifiant, éditeur d'après l'adresse, année) :\n${JSON.stringify(documents, null, 2)}\n\n` +
          `Mesures à relire, avec leurs passages :\n${JSON.stringify(donnees, null, 2)}`,
      },
    ],
  };
}

// Nombre de relectures indépendantes : un même relecteur n'est pas stable d'un passage à l'autre (au retraitement de
// le-pen, trois mesures refusées ont été acceptées et trois acceptées refusées, sans que rien n'ait changé). Une mesure
// n'est acceptée que si TOUTES les relectures disent PASS.
export const NOMBRE_LECTURES = 2;

// Deux verdicts par mesure : `verdict` porte sur la mesure elle-même (résumé, chiffres, datation, attribution,
// neutralité) ; `effets` sur le ciblage et le sens de ses effets. Une mesure dont seuls les effets sont refusés reste
// affichable SANS effet (pas d'indicateur plutôt qu'un mauvais indicateur) : `effetsEcartes` porte alors la raison.
// Rien d'un effet refusé n'est gardé : tous les effets de la mesure sont écartés ensemble, jamais un badge fondé sur une
// moitié de mesure.
export type VerdictExtraction = Verdict & { effetsEcartes?: string };

interface VerdictLecture {
  mesure: Verdict;
  // Absent pour une mesure sans effet, ou si le relecteur n'a rien dit des effets d'une mesure qui en a.
  effets?: Verdict;
}

// Une mesure sans verdict reste absente de la carte : à l'appelant de la traiter comme un échec.
export async function verifierMesuresParPassages(
  client: ClientAnthropicMinimal,
  meta: CandidatMeta,
  mesures: MesureAVerifier[],
  lectures: number = NOMBRE_LECTURES,
): Promise<Map<string, VerdictExtraction>> {
  const verdicts = new Map<string, VerdictExtraction>();
  if (mesures.length === 0) return verdicts;

  // Séquentiel : on ménage le quota de l'abonnement, et chaque lecture reste indépendante (aucune ne voit l'autre).
  const parLecture: Array<Map<string, VerdictLecture>> = [];
  for (let i = 0; i < lectures; i += 1) parLecture.push(await uneLecture(client, meta, mesures));

  for (const { proposition } of mesures) {
    const titre = proposition.titre;
    const rendus = parLecture.map((v) => v.get(titre));
    const echec = rendus.find((v) => v?.mesure.statut === "FAIL")?.mesure;
    if (echec) {
      verdicts.set(titre, echec);
      continue;
    }
    // Sinon : au moins une lecture sans verdict pour cette mesure → pas de verdict, jamais de PASS par défaut.
    if (!rendus.every((v) => v?.mesure.statut === "PASS")) continue;

    if (proposition.effets.length === 0) {
      verdicts.set(titre, { statut: "PASS" });
      continue;
    }
    // Les effets ne sont acceptés que si TOUTES les lectures les valident explicitement.
    const refus = rendus.map((v) => v?.effets).find((e) => e?.statut === "FAIL");
    const silence = rendus.some((v) => v?.effets === undefined);
    if (refus?.statut === "FAIL") verdicts.set(titre, { statut: "PASS", effetsEcartes: refus.raison });
    else if (silence) verdicts.set(titre, { statut: "PASS", effetsEcartes: "le relecteur n'a pas rendu de verdict sur les effets" });
    else verdicts.set(titre, { statut: "PASS" });
  }
  return verdicts;
}

async function uneLecture(client: ClientAnthropicMinimal, meta: CandidatMeta, mesures: MesureAVerifier[]): Promise<Map<string, VerdictLecture>> {
  const verdicts = new Map<string, VerdictLecture>();
  const { reponse } = await appeler(client, construireRequeteVerificationExtraction(meta, mesures), {
    phase: "vérification",
    slug: meta.slug,
  });
  if (reponse.stop_reason === "max_tokens") {
    throw new Error(`verifierMesuresParPassages (${meta.slug}) : sortie tronquée (max_tokens), les verdicts sont incomplets`);
  }
  const erreur = detecterErreurReponse(reponse);
  if (erreur) throw new Error(`verifierMesuresParPassages (${meta.slug}) : ${erreur}`);

  const texte = [...reponse.content].reverse().find((b) => b.type === "text" && b.text)?.text;
  let brut: unknown;
  try {
    brut = texte ? JSON.parse(texte) : undefined;
  } catch {
    brut = undefined;
  }
  if (!Array.isArray(brut)) return verdicts;
  for (const element of brut) {
    const v = element as { titre?: unknown; verdict?: unknown; raison?: unknown; verdict_effets?: unknown; raison_effets?: unknown };
    if (typeof v.titre !== "string") continue;
    const raison = (r: unknown) => (typeof r === "string" && r ? r : "Aucune raison fournie");
    let mesure: Verdict;
    if (v.verdict === "PASS") mesure = { statut: "PASS" };
    else if (v.verdict === "FAIL") mesure = { statut: "FAIL", raison: raison(v.raison) };
    else continue;
    const lecture: VerdictLecture = { mesure };
    if (v.verdict_effets === "PASS") lecture.effets = { statut: "PASS" };
    else if (v.verdict_effets === "FAIL") lecture.effets = { statut: "FAIL", raison: raison(v.raison_effets) };
    verdicts.set(v.titre, lecture);
  }
  return verdicts;
}
