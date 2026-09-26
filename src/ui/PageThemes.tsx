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
  const n = candidats.length;

  return (
    <>
      <h1>Simulateur d'impact personnel — Présidentielle 2027</h1>
      <p>
        {n} {n > 1 ? "candidats sont couverts" : "candidat est couvert"} à ce stade, toujours présentés par ordre
        alphabétique. Choisissez un thème puis un candidat pour voir ce que propose son programme, avec ses sources.
      </p>
      <p className="avertissement">{base.info.avertissement}</p>

      <div className="ma-situation">
        {personnalise ? (
          <>
            <p>
              <strong>Vos réponses sont prises en compte.</strong> Les couleurs autour des portraits indiquent, thème par
              thème, ce que les mesures changeraient pour vous. Ouvrez « Préciser ma situation pour ce thème » pour
              affiner, à votre rythme.
            </p>
            <div className="actions">
              <button type="button" onClick={onRenseigner}>
                Modifier mes réponses générales
              </button>
              <button type="button" className="secondaire" onClick={onEffacer}>
                Effacer mes réponses
              </button>
            </div>
          </>
        ) : generalSoumis ? (
          <>
            <p>
              <strong>Aucune réponse donnée : aucun indicateur.</strong> Répondez à au moins une question générale pour
              voir apparaître les indicateurs.
            </p>
            <div className="actions">
              <button type="button" onClick={onRenseigner}>
                Répondre aux questions générales
              </button>
            </div>
          </>
        ) : (
          <>
            <p>
              <strong>Aucun indicateur pour l'instant.</strong> Répondez d'abord aux questions générales (toutes
              facultatives) : après validation, un indicateur apparaît autour de chaque portrait, et vous pouvez ensuite
              préciser d'autres informations thème par thème.
            </p>
            <div className="actions">
              <button type="button" onClick={onRenseigner}>
                Répondre aux questions générales
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
        <p className="hint">
          Programmes pas encore analysés, donc absents : {enCoursAnalyse.map((meta) => meta.nom).join(", ")}.
        </p>
      )}
    </>
  );
}
