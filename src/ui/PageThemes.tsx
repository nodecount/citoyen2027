import { useEffect, useState } from "react";
import { candidatsDeBase, type BaseCharge } from "../data/bases";
import { lireOuverture } from "./router";
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
  // Arrivée depuis le tableau de l'accueil (ou une adresse partagée) : la carte du thème, avec ce candidat ouvert.
  const [ouverture] = useState(() => (typeof window === "undefined" ? null : lireOuverture(window.location.href)));
  useEffect(() => {
    if (ouverture) document.getElementById(`theme-${ouverture.theme}`)?.scrollIntoView({ block: "center" });
  }, [ouverture]);

  return (
    <>
      <h1>Les thèmes</h1>

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
              {generalSoumis && <strong>Aucune réponse donnée. </strong>}
              Voyez ce que le programme de chaque candidat changerait pour votre situation personnelle pendant le mandat
              à venir. Pour cela,{" "}
              <button type="button" className="bouton-en-ligne" onClick={onRenseigner}>
                Renseignez des informations
              </button>
            </p>
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
        ouvertInitial={ouverture ?? undefined}
      />

      {enCoursAnalyse.length > 0 && (
        <p className="hint">Programmes pas encore analysés : {enCoursAnalyse.map((meta) => meta.nom).join(", ")}.</p>
      )}
    </>
  );
}