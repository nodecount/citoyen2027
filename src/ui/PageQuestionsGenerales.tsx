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
  // en cartes compactes, actions en tête (toujours à portée), bouton « Fermer ».
  integre?: boolean;
  // Efface toutes les réponses (proposé seulement quand il y en a déjà d'enregistrées).
  onEffacer?: () => void;
}

// Les questions générales : utiles à plusieurs thèmes, posées d'abord et une seule fois. Les réponses sont un BROUILLON
// tant que le visiteur n'a pas enregistré : c'est l'enregistrement qui fait apparaître (ou met à jour) les indicateurs
// sur les portraits. Le visiteur peut y revenir à tout moment pour changer ou compléter ses réponses ; ensuite, chaque
// thème permet de préciser d'autres informations, à son rythme.
export default function PageQuestionsGenerales({ questions, profilInitial, onValider, onAnnuler, integre = false, onEffacer }: PageQuestionsGeneralesProps) {
  const [brouillon, setBrouillon] = useState<ProfilPartiel>(profilInitial);
  const { repondues, total } = compterReponses(questions, brouillon);

  function repondre(champ: ChampProfil, brut: string | string[]) {
    setBrouillon((precedent) => mettreAJourReponse(precedent, champ, brut, CHAMPS_PROFIL));
  }

  function valider(event: FormEvent) {
    event.preventDefault();
    onValider(brouillon);
  }

  const progression = `${repondues} réponse${repondues > 1 ? "s" : ""} sur ${total} question${total > 1 ? "s" : ""}`;
  const actions = (
    <div className="actions">
      <button type="submit">Enregistrer et voir les indicateurs</button>
      <button type="button" className="secondaire" onClick={onAnnuler}>
        {integre ? "Fermer" : "Retour aux thèmes"}
      </button>
      {onEffacer && (
        <button type="button" className="secondaire" onClick={onEffacer}>
          Effacer mes réponses
        </button>
      )}
    </div>
  );

  return (
    <form onSubmit={valider} className={`questionnaire${integre ? " questionnaire--integre" : ""}`} id={integre ? "formulaire-general" : undefined}>
      {integre ? (
        <div className="questionnaire-entete">
          <h2>Ma situation</h2>
          <p className="progression" aria-live="polite">
            {progression}
          </p>
          {actions}
        </div>
      ) : (
        <h1>Ma situation</h1>
      )}
      <p className="hint">
        Ces questions générales servent à plusieurs thèmes. Elles sont toutes facultatives : répondez à celles que vous
        voulez. Vos réponses restent dans votre navigateur : elles ne sont jamais envoyées, et gardées pour votre prochaine visite tant que vous ne les effacez pas. Une question laissée
        sans réponse n'est jamais comptée comme « non ». Une fois enregistrées, les indicateurs apparaissent autour des
        portraits, et vous pourrez préciser d'autres informations thème par thème.
      </p>
      {!integre && (
        <p className="progression" aria-live="polite">
          {progression}
        </p>
      )}
      <SectionQuestions questions={questions} profil={brouillon} onReponse={repondre} idPrefixe={integre ? "general-ouvert" : "general"} carte={integre} />
      {!integre && actions}
    </form>
  );
}
