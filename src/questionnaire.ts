import profilSchema from "../data/profils-schema.json";
import { questionVisible, type ProfilPartiel } from "./profil";
import type { ChampProfil, Theme } from "./types";

// Le formulaire est découpé par thème, avec un socle de questions générales : une question utile à au moins DEUX thèmes
// est « générale » (posée d'abord, une seule fois) ; utile à un seul thème, elle est posée dans ce thème, au rythme du
// visiteur. La pertinence (question → thèmes de la base) est une donnée de chaque base : data/bases/<id>/questionnaire.json.

export const CHAMPS_PROFIL: ChampProfil[] = profilSchema as ChampProfil[];

export interface SectionTheme {
  theme: Theme;
  questions: ChampProfil[];
}

export interface Questionnaire {
  generales: ChampProfil[];
  parTheme: SectionTheme[];
}

export function construireQuestionnaire(champs: ChampProfil[], pertinence: Record<string, string[]>, themes: Theme[]): Questionnaire {
  const idsThemes = new Set(themes.map((t) => t.id));
  const generales: ChampProfil[] = [];
  const parTheme = new Map<string, ChampProfil[]>();

  for (const champ of champs) {
    const concernes = [...new Set((pertinence[champ.id] ?? []).filter((id) => idsThemes.has(id)))];
    if (concernes.length >= 2) generales.push(champ);
    else if (concernes.length === 1) parTheme.set(concernes[0], [...(parTheme.get(concernes[0]) ?? []), champ]);
    // Aucun thème : la question n'est pas posée dans cette base (elle n'y servirait à rien).
  }
  return {
    generales,
    parTheme: themes.filter((t) => parTheme.has(t.id)).map((theme) => ({ theme, questions: parTheme.get(theme.id)! })),
  };
}

export function questionsDuTheme(questionnaire: Questionnaire, themeId: string): ChampProfil[] {
  return questionnaire.parTheme.find((s) => s.theme.id === themeId)?.questions ?? [];
}

// Questions actuellement visibles (les conditionnelles n'apparaissent que si leur condition est remplie).
export function questionsVisibles(questions: ChampProfil[], profil: ProfilPartiel): ChampProfil[] {
  return questions.filter((q) => questionVisible(q, profil));
}

export function estRepondue(q: ChampProfil, profil: ProfilPartiel): boolean {
  const v = profil[q.id];
  return Array.isArray(v) ? v.length > 0 : v !== undefined && v !== "";
}

// Questions déjà répondues, parmi celles actuellement visibles (pour un récapitulatif à ajuster sur place).
export function questionsRepondues(questions: ChampProfil[], profil: ProfilPartiel): ChampProfil[] {
  return questionsVisibles(questions, profil).filter((q) => estRepondue(q, profil));
}

// Décompte des réponses. Une question sensible non répondue n'est pas comptée : le visiteur n'a peut-être pas donné son
// accord pour la voir, et on ne lui présente pas un « manque » sur une question qu'il n'a pas choisi de se voir poser.
export function compterReponses(questions: ChampProfil[], profil: ProfilPartiel): { repondues: number; total: number } {
  const comptees = questionsVisibles(questions, profil).filter((q) => !q.sensible || estRepondue(q, profil));
  return { repondues: comptees.filter((q) => estRepondue(q, profil)).length, total: comptees.length };
}