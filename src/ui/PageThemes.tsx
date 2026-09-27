import { candidatsDeBase, type BaseCharge } from "../data/bases";
import { aDesInformations, type ProfilPartiel } from "../profil";
import { construireCards } from "./cards";
import type { SurReponse } from "./Questions";
import { VueThemes } from "./VueThemes";

interface PageThemesProps {
  base: BaseCharge;
  profil: ProfilPartiel;
  // Le formulaire général a-t-il été validé ? Seule sa validation fait apparaître les indicateurs et ouvre les questions
  // propres à chaque thème.
  generalSoumis: boolean;
  onRenseigner: () => void;
  onEffacer: () => void;
  onReponse: SurReponse;
}

// Page de départ : les thèmes, et sur chacun les portraits cliquables des candidats concernés. Aucun indicateur tant que le
// formulaire général n'a pas été validé (et qu'il contient au moins une réponse).
export default function PageThemes({ base, profil, generalSoumis, onRenseigner, onEffacer, onReponse }: PageThemesProps) {
  const { avecDonnees: candidats, enCoursAnalyse } = candidatsDeBase(base);
  const personnalise = generalSoumis && aDesInformations(profil);
  const cards = construireCards(base.themes, candidats, personnalise ? profil : null);

  return (
    <>
      <h1>Les thèmes</h1>
      <p className="avertissement">{base.info.avertissement}</p>

      <div className="ma-situation">
        {personnalise ? (
          <>
            <p>
              <strong>Vos réponses sont prises en compte.</strong>
            </p>
            <div className="actions">
              <button type="button" onClick={onRenseigner}>
                Modifier mes réponses
              </button>
              <button type="button" className="secondaire" onClick={onEffacer}>
                Effacer mes réponses
              </button>
            </div>
          </>
        ) : (
          <>
            <p>
              <strong>{generalSoumis ? "Aucune réponse donnée." : "Et pour vous ?"}</strong> Répondez à quelques questions
              facultatives : chaque candidat recevra un indicateur.
            </p>
            <div className="actions">
              <button type="button" onClick={onRenseigner}>
                Répondre aux questions
              </button>
            </div>
          </>
        )}
      </div>

      <VueThemes
        cards={cards}
        profil={profil}
        personnalise={personnalise}
        questionnaire={base.questionnaire}
        questionsActives={generalSoumis}
        onReponse={onReponse}
      />

      {enCoursAnalyse.length > 0 && (
        <p className="hint">Programmes pas encore analysés : {enCoursAnalyse.map((meta) => meta.nom).join(", ")}.</p>
      )}
    </>
  );
}