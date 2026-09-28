import { useEffect, useState } from "react";
import { candidatsDeBase, resumesManquants, type BaseCharge } from "../data/bases";
import { lireOuverture } from "./router";
import { aDesInformations, type ProfilPartiel } from "../profil";
import { construireCards } from "./cards";
import PageQuestionsGenerales from "./PageQuestionsGenerales";
import { SectionQuestions, type SurReponse } from "./Questions";
import { VueThemes } from "./VueThemes";

interface PageThemesProps {
  base: BaseCharge;
  profil: ProfilPartiel;
  // Le formulaire général a-t-il été validé ? Seule sa validation fait apparaître les indicateurs et ouvre les questions
  // propres à chaque thème.
  generalSoumis: boolean;
  // Validation du formulaire général ouvert au-dessus des thèmes (les réponses sont alors appliquées).
  onValider: (profil: ProfilPartiel) => void;
  onEffacer: () => void;
  onReponse: SurReponse;
}

// Page du simulateur : les thèmes, et sur chacun les portraits cliquables des candidats concernés. Aucun indicateur
// tant que le formulaire général n'a pas été validé (et qu'il contient au moins une réponse).
export default function PageThemes({ base, profil, generalSoumis, onValider, onEffacer, onReponse }: PageThemesProps) {
  // Le formulaire général s'ouvre ici, avant les cartes de thèmes, plutôt que de rediriger vers une autre page.
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const { avecDonnees: candidats, enCoursAnalyse } = candidatsDeBase(base);
  const manquants = resumesManquants(base, candidats);
  const personnalise = generalSoumis && aDesInformations(profil);
  const cards = construireCards(base.themes, candidats, personnalise ? profil : null);
  // Arrivée depuis le tableau de l'accueil (ou une adresse partagée) : la carte du thème, avec ce candidat ouvert.
  const [ouverture] = useState(() => (typeof window === "undefined" ? null : lireOuverture(window.location.href)));
  useEffect(() => {
    if (ouverture) document.getElementById(`theme-${ouverture.theme}`)?.scrollIntoView({ block: "center" });
  }, [ouverture]);

  return (
    <>
      <h1>Simulateur</h1>

      {formulaireOuvert && (
        <PageQuestionsGenerales
          integre
          questions={base.questionnaire.generales}
          profilInitial={profil}
          onValider={(p) => {
            onValider(p);
            setFormulaireOuvert(false);
          }}
          onAnnuler={() => setFormulaireOuvert(false)}
        />
      )}

      {/* Après validation : le même formulaire en cartes (icônes, « pourquoi cette question ? »), modifiable en direct,
          plutôt qu'un second style de formulaire. */}
      {personnalise && (
        <section className="questionnaire questionnaire--integre" aria-label="Vos réponses générales">
          <h2>Vos réponses générales</h2>
          <SectionQuestions carte questions={base.questionnaire.generales} profil={profil} onReponse={onReponse} idPrefixe="generales-simulateur" />
          <div className="actions">
            <button type="button" className="secondaire" onClick={onEffacer}>
              Effacer mes réponses
            </button>
          </div>
        </section>
      )}

      {!personnalise && !formulaireOuvert && (
        <div className="bandeau-accueil bandeau-accueil--compact">
          <p className="chapeau">
            {generalSoumis && <strong>Aucune réponse donnée. </strong>}
            Voyez ce que le programme de chaque candidat changerait pour votre situation personnelle pendant le mandat à
            venir. Pour cela,{" "}
            <button type="button" className="bouton-en-ligne" onClick={() => setFormulaireOuvert(true)}>
              Renseignez des informations
            </button>
          </p>
        </div>
      )}

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
      {manquants.length > 0 && (
        <p className="hint">
          Résumé pas encore disponible (le détail complet des mesures reste affiché) : {manquants.map((m) => `${m.nom} (${m.themeLibelle})`).join(", ")}.
        </p>
      )}
    </>
  );
}