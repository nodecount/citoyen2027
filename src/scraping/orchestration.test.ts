import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Proposition } from "../types";
import { PanneCli, type SortieCli } from "./claude-cli";
import { chargerJournalStructuration, chargerPropositionsCandidat, ecrireCandidats } from "./ecriture";
import { executer, planifier } from "./orchestration";
import type { CandidatConverti } from "./ifrap";

let racine: string;
beforeEach(() => {
  racine = mkdtempSync(join(tmpdir(), "structuration-test-"));
});
afterEach(() => {
  rmSync(racine, { recursive: true, force: true });
});

const URL = "https://www.ifrap.org/comparateurs/presidentielles-2027";
const TEXTE = "Verser une aide de 100 € par mois aux locataires de moins de 30 ans.";
const EFFET = {
  cibles: [{ champ: "logement", valeurs: ["locataire"] }],
  dimension: "revenu_disponible",
  sens: "hausse",
  extrait: "une aide de 100 € par mois aux locataires de moins de 30 ans",
};

function proposition(id: string, theme: string, texte = TEXTE): Proposition {
  return {
    id, candidat: "x", theme, titre: texte, resume_factuel: texte, sources: [{ type: "secondaire", label: "L", url: URL, nom: "Fondation iFRAP", annee: 2026 }],
    chiffrage_disponible: false, hypotheses_calcul: "H", statut: "partiel", date_derniere_verification: "2026-09-26",
  };
}

function candidat(propositions: Proposition[]): CandidatConverti {
  return { meta: { slug: "x", nom: "Candidat X", parti: "P", sources_officielles: [], date_derniere_maj: "2026-09-26" }, propositions };
}

function sortie(structure: unknown, cout = 0.02): SortieCli {
  return { structure, coutReferenceUsd: cout, dureeMs: 1, jetonsEntree: 1, jetonsSortie: 1, brut: "" };
}

// Faux modèle : structure toutes les propositions listées dans le prompt avec l'effet d'aide, puis relit en PASS.
function modele(effet: unknown = EFFET) {
  const appels: string[] = [];
  return {
    appels,
    appeler: async (prompt: string, _s: string, schema: object) => {
      appels.push(prompt);
      const ids = [...prompt.matchAll(/"id": "([^"]+)"/g)].map((m) => m[1]);
      if ("resultats" in (schema as { properties: object }).properties) return sortie({ resultats: ids.map((id) => ({ id, effets: [effet] })) });
      return sortie({ verdicts: ids.map((id) => ({ id, verdict: "PASS" })) });
    },
  };
}

const themes = (id: string) => id;
const sansJournal = () => {};

describe("planifier", () => {
  it("regroupe par candidat × thème, isole les thèmes sans effet possible et compte ce qui est à faire", () => {
    ecrireCandidats(racine, [candidat([proposition("x-fisc-1", "finances-publiques"), proposition("x-fisc-2", "finances-publiques"), proposition("x-def-1", "defense")])]);
    const plan = planifier(racine);
    expect(plan.groupes).toHaveLength(1);
    expect(plan.groupes[0]).toMatchObject({ slug: "x", themeId: "finances-publiques", nomCandidat: "Candidat X", aFaire: true });
    expect(plan.groupes[0].entrees.map((e) => e.id)).toEqual(["x-fisc-1", "x-fisc-2"]);
    expect(plan.sansAppel).toEqual([{ slug: "x", ids: ["x-def-1"] }]);
  });

  it("découpe un gros thème en groupes de 25 propositions", () => {
    ecrireCandidats(racine, [candidat(Array.from({ length: 60 }, (_, i) => proposition(`x-${i}`, "finances-publiques", `${TEXTE} ${i}`)))]);
    expect(planifier(racine).groupes.map((g) => g.entrees.length)).toEqual([25, 25, 10]);
  });

  it("filtre par candidat et par thème", () => {
    ecrireCandidats(racine, [candidat([proposition("x-1", "finances-publiques"), proposition("x-2", "environnement")])]);
    expect(planifier(racine, { themes: ["environnement"] }).groupes.map((g) => g.themeId)).toEqual(["environnement"]);
    expect(planifier(racine, { candidats: ["absent"] }).groupes).toEqual([]);
  });
});

describe("executer", () => {
  it("écrit les effets dans propositions.json, tient le journal, et marque les thèmes sans effet possible", async () => {
    ecrireCandidats(racine, [candidat([proposition("x-1", "finances-publiques"), proposition("x-2", "defense")])]);
    const m = modele();
    const resume = await executer(racine, planifier(racine), themes, m, "modele-test", {}, sansJournal);
    expect(resume).toMatchObject({ groupesFaits: 1, arret: null, appels: 2 });
    const [p1, p2] = chargerPropositionsCandidat(racine, "x");
    expect(p1.effets).toHaveLength(1);
    expect(p1.effets![0]).toMatchObject({ dimension: "revenu_disponible", sens: "hausse", source_url: URL });
    expect(p2.effets).toEqual([]); // défense : analysée, sans effet, sans appel
    const journal = chargerJournalStructuration(racine, "x");
    expect(journal[0]).toMatchObject({ theme: "finances-publiques", groupe: 0, propositions: 1, avec_effets: 1, sans_effet: 0, modele: "modele-test", appels: 2 });
  });

  it("est rejouable : un groupe à jour est ignoré, sauf avec force", async () => {
    ecrireCandidats(racine, [candidat([proposition("x-1", "finances-publiques")])]);
    await executer(racine, planifier(racine), themes, modele(), "m", {}, sansJournal);
    expect(planifier(racine).groupes[0].aFaire).toBe(false);
    const m = modele();
    await executer(racine, planifier(racine), themes, m, "m", {}, sansJournal);
    expect(m.appels).toHaveLength(0);
    expect(planifier(racine, { force: true }).groupes[0].aFaire).toBe(true);
  });

  it("refait un groupe dont le texte a changé, et une nouvelle collecte garde les effets des textes inchangés", async () => {
    ecrireCandidats(racine, [candidat([proposition("x-1", "finances-publiques"), proposition("x-2", "environnement")])]);
    await executer(racine, planifier(racine), themes, modele(), "m", {}, sansJournal);
    ecrireCandidats(racine, [candidat([proposition("x-1", "finances-publiques"), proposition("x-2", "environnement", `${TEXTE} Modifiée.`)])]);
    const apres = chargerPropositionsCandidat(racine, "x");
    expect(apres[0].effets).toHaveLength(1); // texte inchangé : effets conservés
    expect(apres[1].effets).toBeUndefined(); // texte changé : à refaire
    const plan = planifier(racine);
    expect(plan.groupes.map((g) => [g.themeId, g.aFaire])).toEqual([["finances-publiques", false], ["environnement", true]]);
  });

  it("retire les effets d'une proposition rejetée : jamais de badge fondé sur un effet non contrôlé", async () => {
    ecrireCandidats(racine, [candidat([proposition("x-1", "finances-publiques")])]);
    const m = modele({ ...EFFET, extrait: "un extrait que le texte ne contient absolument pas" });
    await executer(racine, planifier(racine), themes, m, "m", {}, sansJournal);
    expect(chargerPropositionsCandidat(racine, "x")[0].effets).toBeUndefined();
    expect(chargerJournalStructuration(racine, "x")[0].rejetees).toHaveLength(1);
  });

  it("s'arrête net sur une panne d'abonnement, sans rien perdre de ce qui est déjà fait", async () => {
    ecrireCandidats(racine, [candidat([proposition("x-1", "finances-publiques"), proposition("x-2", "environnement")])]);
    let n = 0;
    const appeler = async (prompt: string, s: string, schema: object) => {
      n += 1;
      if (n > 2) throw new PanneCli("usage limit reached");
      return modele().appeler(prompt, s, schema);
    };
    const resume = await executer(racine, planifier(racine), themes, { appeler }, "m", { concurrence: 1 }, sansJournal);
    expect(resume.arret).toBe("panne");
    expect(resume.groupesFaits).toBe(1);
    expect(chargerPropositionsCandidat(racine, "x")[0].effets).toHaveLength(1);
  });

  it("s'arrête quand le plafond de coût de référence est atteint", async () => {
    ecrireCandidats(racine, [candidat([proposition("x-1", "finances-publiques"), proposition("x-2", "environnement"), proposition("x-3", "logement")])]);
    const appeler = async (prompt: string, s: string, schema: object) => {
      const r = await modele().appeler(prompt, s, schema);
      return { ...r, coutReferenceUsd: 0.5 };
    };
    const resume = await executer(racine, planifier(racine), themes, { appeler }, "m", { concurrence: 1, plafondRefUsd: 1 }, sansJournal);
    expect(resume.arret).toBe("plafond");
    expect(resume.groupesFaits).toBe(1);
  });

  it("limite le nombre de groupes lancés (essai pilote)", async () => {
    ecrireCandidats(racine, [candidat([proposition("x-1", "finances-publiques"), proposition("x-2", "environnement")])]);
    const resume = await executer(racine, planifier(racine), themes, modele(), "m", { limiteGroupes: 1 }, sansJournal);
    expect(resume.groupesFaits).toBe(1);
    expect(JSON.parse(readFileSync(join(racine, "programmes/x/_structuration.json"), "utf-8"))).toHaveLength(1);
  });

  it("réessaie une fois après une erreur passagère, puis la consigne sans arrêter les autres groupes", async () => {
    ecrireCandidats(racine, [candidat([proposition("x-1", "finances-publiques"), proposition("x-2", "environnement")])]);
    let premier = true;
    const appeler = async (prompt: string, s: string, schema: object) => {
      if (prompt.includes("x-1")) throw new Error("incident");
      if (premier) {
        premier = false;
      }
      return modele().appeler(prompt, s, schema);
    };
    const resume = await executer(racine, planifier(racine), themes, { appeler }, "m", { concurrence: 1 }, sansJournal);
    expect(resume.erreurs).toHaveLength(1);
    expect(resume.erreurs[0].groupe).toContain("finances-publiques");
    expect(resume.groupesFaits).toBe(1);
  });
});
