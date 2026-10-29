import { sujetsDisponibles } from "../engine/positions";
import type { ProfilPartiel } from "../profil";
import { estRepondue, questionsVisibles, type Questionnaire } from "../questionnaire";
import type { ChampProfil, Proposition } from "../types";
import type { Convictions } from "./memoireConvictions";

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
