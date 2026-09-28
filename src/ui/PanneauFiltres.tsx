import { questionsRepondues, type Questionnaire } from "../questionnaire";
import type { ProfilPartiel } from "../profil";
import { ChampQuestion, type SurReponse } from "./Questions";

interface PanneauFiltresProps {
  questionnaire: Questionnaire;
  profil: ProfilPartiel;
  onReponse: SurReponse;
}

// Récapitulatif, thème par thème, des réponses données aux questions propres à un thème (pas les questions générales,
// déjà récapitulées en haut de la page) : le visiteur les retrouve d'un coup d'œil et les ajuste sur place, sans rouvrir
// chaque carte. Un thème sans réponse n'y figure pas ; le panneau entier disparaît tant qu'aucune réponse par thème
// n'a été donnée.
export function PanneauFiltres({ questionnaire, profil, onReponse }: PanneauFiltresProps) {
  const sections = questionnaire.parTheme
    .map((section) => ({ theme: section.theme, questions: questionsRepondues(section.questions, profil) }))
    .filter((section) => section.questions.length > 0);

  if (sections.length === 0) return null;

  return (
    <aside className="panneau-filtres" aria-label="Vos réponses par thème">
      <p className="panneau-filtres-titre">Vos réponses par thème</p>
      {sections.map(({ theme, questions }) => (
        <fieldset key={theme.id} className="panneau-filtres-theme">
          <legend>{theme.libelle}</legend>
          {questions.map((champ) => (
            <ChampQuestion key={champ.id} champ={champ} profil={profil} onReponse={onReponse} idPrefixe={`filtre-${theme.id}`} />
          ))}
        </fieldset>
      ))}
    </aside>
  );
}
