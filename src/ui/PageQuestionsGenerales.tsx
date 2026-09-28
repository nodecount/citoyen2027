import { useState, type FormEvent } from "react";
import { CHAMPS_PROFIL, compterReponses } from "../questionnaire";
import { mettreAJourReponse, type ProfilPartiel } from "../profil";
import type { ChampProfil } from "../types";
import { SectionQuestions } from "./Questions";

interface PageQuestionsGeneralesProps {
  questions: ChampProfil[];
  profilInitial: ProfilPartiel;
  onValider: (profil: ProfilPartiel) => void;
  onAnnuler: () => void;
  // Formulaire ouvert au-dessus des thèmes (page du simulateur) plutôt que page à part : titre de section, questions
  // en cartes avec icône, bouton « Fermer ».
  integre?: boolean;
}

// Les questions générales : utiles à plusieurs thèmes, posées d'abord et une seule fois. Les réponses sont un BROUILLON
// tant que le visiteur n'a pas validé : c'est la validation de ce formulaire qui fait apparaître les indicateurs sur les
// portraits. Ensuite, chaque thème permet de préciser d'autres informations, au rythme du visiteur.
export default function PageQuestionsGenerales({ questions, profilInitial, onValider, onAnnuler, integre = false }: PageQuestionsGeneralesProps) {
  const [brouillon, setBrouillon] = useState<ProfilPartiel>(profilInitial);
  const { repondues, total } = compterReponses(questions, brouillon);

  function repondre(champ: ChampProfil, brut: string | string[]) {
    setBrouillon((precedent) => mettreAJourReponse(precedent, champ, brut, CHAMPS_PROFIL));
  }

  function valider(event: FormEvent) {
    event.preventDefault();
    onValider(brouillon);
  }

  return (
    <form onSubmit={valider} className={`questionnaire${integre ? " questionnaire--integre" : ""}`} id={integre ? "formulaire-general" : undefined}>
      {integre ? <h2>Ma situation</h2> : <h1>Ma situation</h1>}
      <p className="hint">
        Ces questions générales servent à plusieurs thèmes. Elles sont toutes facultatives : répondez à celles que vous
        voulez. Vos réponses restent dans votre navigateur, elles ne sont ni envoyées ni conservées. Une question laissée
        sans réponse n'est jamais comptée comme « non ». Une fois validées, les indicateurs apparaissent autour des
        portraits, et vous pourrez préciser d'autres informations thème par thème.
      </p>
      <p className="progression" aria-live="polite">
        {`${repondues} réponse${repondues > 1 ? "s" : ""} sur ${total} question${total > 1 ? "s" : ""}`}
      </p>
      <SectionQuestions questions={questions} profil={brouillon} onReponse={repondre} idPrefixe={integre ? "general-ouvert" : "general"} carte={integre} />
      <div className="actions">
        <button type="submit">Valider et voir les indicateurs</button>
        <button type="button" className="secondaire" onClick={onAnnuler}>
          {integre ? "Fermer" : "Retour aux thèmes"}
        </button>
      </div>
    </form>
  );
}
