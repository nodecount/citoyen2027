import { Eye, ListChecks, Lock } from "lucide-react";
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
      <ul className="aide-formulaire">
        <li>
          <ListChecks aria-hidden="true" />
          <span>
            Les questions sont toutes <strong>facultatives</strong> : répondez à celles que vous voulez. Une question sans
            réponse n'est jamais comptée comme « non ».
          </span>
        </li>
        <li>
          <Lock aria-hidden="true" />
          <span>
            Vos réponses restent <strong>dans votre navigateur</strong> : jamais envoyées, gardées pour votre prochaine
            visite tant que vous ne les effacez pas.
          </span>
        </li>
        <li>
          <Eye aria-hidden="true" />
          <span>
            Une fois enregistrées, les indicateurs apparaissent autour des portraits ; vous pourrez préciser d'autres
            informations thème par thème.
          </span>
        </li>
      </ul>      {!integre && (
        <p className="progression" aria-live="polite">
          {progression}
        </p>
      )}
      <SectionQuestions questions={questions} profil={brouillon} onReponse={repondre} idPrefixe={integre ? "general-ouvert" : "general"} carte={integre} />
      {!integre && actions}
    </form>
  );
}
