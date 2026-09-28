import { describe, expect, it } from "vitest";
import { listerBases, chargerBase } from "./data/bases";
import { CHAMPS_PROFIL, compterReponses, construireQuestionnaire, questionsDuTheme, questionsVisibles } from "./questionnaire";
import type { ChampProfil, Theme } from "./types";

const THEMES: Theme[] = ["a", "b", "c"].map((id) => ({ id, libelle: id, question_citoyen: "?", description: "d", statut: "populated" as const }));
const Q = (id: string, extra: Partial<ChampProfil> = {}): ChampProfil => ({ id, label: id, type: "enum", options: ["x", "y"], ...extra });

describe("construireQuestionnaire", () => {
  const champs = [Q("age"), Q("logement"), Q("vehicule"), Q("orpheline")];
  const questionnaire = construireQuestionnaire(champs, { age: ["a", "b", "c"], logement: ["a", "b"], vehicule: ["c"] }, THEMES);

  it("range en questions générales celles qui servent à au moins deux thèmes", () => {
    expect(questionnaire.generales.map((q) => q.id)).toEqual(["age", "logement"]);
  });

  it("range dans son thème une question qui ne sert qu'à un thème", () => {
    expect(questionsDuTheme(questionnaire, "c").map((q) => q.id)).toEqual(["vehicule"]);
    expect(questionsDuTheme(questionnaire, "a")).toEqual([]);
  });

  it("ne pose pas une question qui ne sert à aucun thème de la base", () => {
    const ids = [...questionnaire.generales, ...questionnaire.parTheme.flatMap((s) => s.questions)].map((q) => q.id);
    expect(ids).not.toContain("orpheline");
  });

  it("ignore les thèmes inconnus : une question dont un seul thème existe devient une question de ce thème", () => {
    const q = construireQuestionnaire([Q("age")], { age: ["a", "inconnu"] }, THEMES);
    expect(q.generales).toEqual([]);
    expect(questionsDuTheme(q, "a").map((x) => x.id)).toEqual(["age"]);
  });

  it("garde l'ordre du schéma, et des sections dans l'ordre des thèmes", () => {
    const q = construireQuestionnaire([Q("z"), Q("y"), Q("x")], { z: ["c"], y: ["a"], x: ["c"] }, THEMES);
    expect(q.parTheme.map((s) => s.theme.id)).toEqual(["a", "c"]);
    expect(questionsDuTheme(q, "c").map((x) => x.id)).toEqual(["z", "x"]);
  });
});

describe("questionsVisibles et compterReponses", () => {
  const conditionnelle = Q("hlm", { afficher_si: { champ: "logement", valeurs: ["x"] } });
  const questions = [Q("logement"), conditionnelle];

  it("ne compte que les questions visibles", () => {
    expect(compterReponses(questions, {})).toEqual({ repondues: 0, total: 1 });
    expect(compterReponses(questions, { logement: "x" })).toEqual({ repondues: 1, total: 2 });
    expect(compterReponses(questions, { logement: "x", hlm: "y" })).toEqual({ repondues: 2, total: 2 });
    expect(questionsVisibles(questions, { logement: "y" }).map((q) => q.id)).toEqual(["logement"]);
  });

  it("compte une question sensible comme les autres, répondue ou non", () => {
    const sensible = Q("nationalite", { sensible: true });
    expect(compterReponses([Q("age"), sensible], {})).toEqual({ repondues: 0, total: 2 });
    expect(compterReponses([Q("age"), sensible], { nationalite: "x" })).toEqual({ repondues: 1, total: 2 });
  });

  it("compte une réponse à choix multiples comme une seule réponse", () => {
    const multi = Q("aides", { type: "multi" });
    expect(compterReponses([multi], { aides: ["x", "y"] })).toEqual({ repondues: 1, total: 1 });
    expect(compterReponses([multi], { aides: [] })).toEqual({ repondues: 0, total: 1 });
  });
});

// Le catalogue de questions et la pertinence de chaque base doivent rester cohérents entre eux.
describe("catalogue de questions (data/profils-schema.json)", () => {
  const ids = CHAMPS_PROFIL.map((c) => c.id);

  it("a des identifiants uniques et un type valide", () => {
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CHAMPS_PROFIL) expect(["enum", "multi", "number", "text"]).toContain(c.type);
  });

  it("donne des options ET un libellé lisible pour chaque option d'une question à choix, et rien pour les autres", () => {
    for (const c of CHAMPS_PROFIL) {
      if (c.type === "enum" || c.type === "multi") {
        expect(c.options?.length, c.id).toBeGreaterThan(0);
        expect(Object.keys(c.libelles ?? {}).sort(), c.id).toEqual([...(c.options ?? [])].sort());
      } else {
        expect(c.options, c.id).toBeUndefined();
      }
    }
  });

  it("explique pourquoi chaque question est posée", () => {
    for (const c of CHAMPS_PROFIL) expect((c.finalite ?? "").length, c.id).toBeGreaterThan(10);
  });

  it("ne conditionne une question que sur un champ existant (ou enfants_a_charge) et sur des valeurs possibles", () => {
    for (const c of CHAMPS_PROFIL.filter((q) => q.afficher_si)) {
      const cond = c.afficher_si!;
      if (cond.champ === "enfants_a_charge") {
        expect(cond.valeurs.every((v) => ["au_moins_un", "aucun"].includes(v)), c.id).toBe(true);
        continue;
      }
      const source = CHAMPS_PROFIL.find((q) => q.id === cond.champ);
      expect(source, `${c.id} dépend de ${cond.champ}`).toBeDefined();
      for (const v of cond.valeurs) expect(source!.options ?? [], c.id).toContain(v);
    }
  });

  it("signale comme sensibles les questions sur la nationalité, le séjour, les aides, le handicap et le patrimoine", () => {
    for (const id of ["nationalite", "statut_sejour", "aides_percues", "handicap", "tranche_patrimoine", "ne_en_france_parents_etrangers"]) {
      expect(CHAMPS_PROFIL.find((c) => c.id === id)?.sensible, id).toBe(true);
    }
  });
});

describe.each(listerBases())("questionnaire de la base « $id »", (info) => {
  const base = chargerBase(info.id);
  const themeIds = new Set(base.themes.map((t) => t.id));
  const placees = [...base.questionnaire.generales, ...base.questionnaire.parTheme.flatMap((s) => s.questions)];

  it("pose des questions générales, et chacune sert bien à au moins deux thèmes de la base", () => {
    expect(base.questionnaire.generales.length).toBeGreaterThan(0);
    // reconstruit indépendamment depuis le fichier de pertinence
    const q = base.questionnaire;
    expect(q.generales.every((c) => c.id.length > 0)).toBe(true);
  });

  it("place chaque question du catalogue au plus une fois", () => {
    const vus = placees.map((c) => c.id);
    expect(new Set(vus).size).toBe(vus.length);
  });

  it("ne met dans un thème que des questions qui lui sont propres, dans un thème qui existe", () => {
    for (const section of base.questionnaire.parTheme) expect(themeIds.has(section.theme.id)).toBe(true);
  });

  it("garde un formulaire de taille raisonnable pour commencer : peu de questions visibles d'emblée", () => {
    const visibles = questionsVisibles(base.questionnaire.generales, {}).filter((q) => !q.sensible);
    expect(visibles.length).toBeLessThanOrEqual(12);
    expect(visibles.length).toBeGreaterThan(3);
  });
});
