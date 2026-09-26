import { candidatsDeBase, type BaseCharge } from "../data/bases";
import { aDesInformations, type ProfilPartiel } from "../profil";
import { construireCards } from "./cards";
import { VueThemes } from "./VueThemes";

interface PageThemesProps {
  base: BaseCharge;
  profil: ProfilPartiel;
  onRenseigner: () => void;
  onEffacer: () => void;
}

// Page de départ : les thèmes, et sur chacun les portraits cliquables des candidats concernés. Aucun formulaire à
// remplir avant, aucun indicateur tant que le visiteur n'a rien dit de sa situation.
export default function PageThemes({ base, profil, onRenseigner, onEffacer }: PageThemesProps) {
  const { avecDonnees: candidats, enCoursAnalyse } = candidatsDeBase(base);
  const personnalise = aDesInformations(profil);
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
              <strong>Vos réponses sont prises en compte.</strong> Un indicateur apparaît sous les portraits quand les
              mesures et vos réponses permettent de conclure.
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
              <strong>Aucun indicateur pour l'instant.</strong> Indiquez ce que vous voulez de votre situation
              (questions facultatives) : chaque portrait recevra alors un indicateur, qui s'affinera avec vos réponses.
            </p>
            <div className="actions">
              <button type="button" onClick={onRenseigner}>
                Renseigner ma situation
              </button>
            </div>
          </>
        )}
      </div>

      <VueThemes cards={cards} profil={profil} personnalise={personnalise} />

      {enCoursAnalyse.length > 0 && (
        <p className="hint">
          Programmes pas encore analysés, donc absents : {enCoursAnalyse.map((meta) => meta.nom).join(", ")}.
        </p>
      )}
    </>
  );
}
