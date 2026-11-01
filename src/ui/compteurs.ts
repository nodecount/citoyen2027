import { sujetsDisponibles } from "../engine/positions";
import type { ProfilPartiel } from "../profil";
import { estRepondue, questionsVisibles, type Questionnaire } from "../questionnaire";
import type { ChampProfil, Proposition } from "../types";
import type { Convictions } from "./memoireConvictions";

// Une dizaine de secondes par question (décision du 2026-11-01) : la durée annoncée sur la page d'introduction, arrondie à la minute
// (« moins d'une minute » sous 45 secondes).
export const SECONDES_PAR_QUESTION = 10;
export function dureeEstimee(questions: number): string {
  const secondes = questions * SECONDES_PAR_QUESTION;
  if (secondes < 45) return "moins d'une minute";
  const minutes = Math.round(secondes / 60);
  return minutes <= 1 ? "environ 1 minute" : `environ ${minutes} minutes`;
}

// Nombres qui fondent le calcul du programme idéal : questions répondues (parmi celles actuellement posées) et sujets
// de convictions renseignés.
export function compterAvancement(questionnaire: Questionnaire, profil: ProfilPartiel, convictions: Convictions, propositions: Proposition[] | null): {
  visibles: ChampProfil[];
  repondues: number;
  questions: number;
  convictions: number;
  sujets: number;
} {
  const sujets = sujetsDisponibles(propositions);
  const questions = [...new Map([...questionnaire.generales, ...questionnaire.parTheme.flatMap((s) => s.questions)].map((q) => [q.id, q])).values()];
  const visibles = questionsVisibles(questions, profil);
  return {
    visibles,
    repondues: visibles.filter((q) => estRepondue(q, profil)).length,
    questions: visibles.length,
    convictions: sujets.filter((s) => convictions.positions[s.id] !== undefined).length,
    sujets: sujets.length,
  };
}
