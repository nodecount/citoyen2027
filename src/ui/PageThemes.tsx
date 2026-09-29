import { BookOpen, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { candidatsDeBase, resumesManquants, type BaseCharge } from "../data/bases";
import { lireOuverture } from "./router";
import { aDesInformations, type ProfilPartiel } from "../profil";
import { construireCards } from "./cards";
import { lireMode, memoriserMode, type ModeAffichage } from "./memoireReponses";
import { ModaleConfirmation } from "./ModaleConfirmation";
import PageQuestionsGenerales from "./PageQuestionsGenerales";
import { compterReponses } from "../questionnaire";
import type { SurReponse } from "./Questions";
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
  // Mode d'affichage de départ (par défaut : le dernier choix du visiteur, sinon « simulateur »).
  modeInitial?: ModeAffichage;
}

// Page du simulateur : les thèmes, et sur chacun les portraits cliquables des candidats concernés. Aucun indicateur
// tant que le formulaire général n'a pas été validé (et qu'il contient au moins une réponse).
export default function PageThemes({ base, profil, generalSoumis, onValider, onEffacer, onReponse, modeInitial }: PageThemesProps) {
  // « Explorer les mesures » : les programmes seuls (ni indicateur, ni légende, ni formulaire, ni questions par thème).
  // « Simuler pour moi » : tout ce qui rattache les mesures à la situation du visiteur.
  const [mode, setMode] = useState<ModeAffichage>(() => modeInitial ?? lireMode());
  useEffect(() => memoriserMode(mode), [mode]);
  const simulateur = mode === "simulateur";
  // Le formulaire général s'ouvre ici, avant les cartes de thèmes, plutôt que de rediriger vers une autre page.
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [confirmerEffacement, setConfirmerEffacement] = useState(false);
  const { avecDonnees: candidats, enCoursAnalyse } = candidatsDeBase(base);
  const manquants = resumesManquants(base, candidats);
  const personnalise = simulateur && generalSoumis && aDesInformations(profil);
  const reponsesGenerales = compterReponses(base.questionnaire.generales, profil);
  const cards = construireCards(base.themes, candidats, personnalise ? profil : null);
  // Arrivée depuis le tableau de l'accueil (ou une adresse partagée) : la carte du thème, avec ce candidat ouvert.
  const [ouverture] = useState(() => (typeof window === "undefined" ? null : lireOuverture(window.location.href)));
  useEffect(() => {
    if (ouverture) document.getElementById(`theme-${ouverture.theme}`)?.scrollIntoView({ block: "center" });
  }, [ouverture]);

  return (
    <>
      <h1>Simulateur</h1>

      <div className="bascule-mode" role="group" aria-label="Mode d'affichage">
        <button type="button" aria-pressed={!simulateur} onClick={() => setMode("exploration")}>
          <BookOpen size={18} aria-hidden="true" focusable="false" />
          Explorer les mesures
        </button>
        <button type="button" aria-pressed={simulateur} onClick={() => setMode("simulateur")}>
          <SlidersHorizontal size={18} aria-hidden="true" focusable="false" />
          Simuler pour moi
        </button>
      </div>

      {simulateur && formulaireOuvert && (
        <PageQuestionsGenerales
          integre
          questions={base.questionnaire.generales}
          profilInitial={profil}
          onValider={(p) => {
            onValider(p);
            // Le formulaire reste ouvert (on peut continuer à le compléter) : la page remonte simplement jusqu'aux premières
            // cartes de thèmes, où les indicateurs viennent d'apparaître.
            document.querySelector(".grille-themes")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          onAnnuler={() => setFormulaireOuvert(false)}
          onEffacer={personnalise ? () => setConfirmerEffacement(true) : undefined}
        />
      )}

      <ModaleConfirmation
        ouverte={confirmerEffacement}
        titre="Effacer vos réponses ?"
        message="Toutes les informations saisies (questions générales et par thème) seront effacées, et les indicateurs disparaîtront des portraits. Cette action ne peut pas être annulée."
        libelleConfirmer="Oui, tout effacer"
        onConfirmer={() => {
          setConfirmerEffacement(false);
          setFormulaireOuvert(false);
          onEffacer();
        }}
        onAnnuler={() => setConfirmerEffacement(false)}
      />

      {/* Après enregistrement : une simple ligne (pas tout le formulaire, qui prendrait la place des thèmes). « Modifier »
          rouvre le même formulaire, toujours avec son bouton d'enregistrement : on peut changer ou compléter ses réponses
          à tout moment. */}
      {personnalise && !formulaireOuvert && (
        <div className="recap-situation" role="region" aria-label="Vos réponses générales">
          <p>
            <strong>Ma situation</strong> : {reponsesGenerales.repondues} réponse{reponsesGenerales.repondues > 1 ? "s" : ""} sur {reponsesGenerales.total}
          </p>
          <button type="button" className="secondaire" onClick={() => setFormulaireOuvert(true)}>
            Modifier mes réponses
          </button>
        </div>
      )}
      {simulateur && !personnalise && !formulaireOuvert && (
        <div className="bandeau-accueil bandeau-accueil--compact">
          <p className="chapeau">
            {generalSoumis && <strong>Aucune réponse donnée. </strong>}
            Voyez ce que le programme de chaque candidat changerait pour votre situation personnelle pendant le mandat à
            venir. Pour cela,
          </p>
          <button type="button" className="bouton-en-ligne" onClick={() => setFormulaireOuvert(true)}>
            Renseignez des informations
          </button>
        </div>      )}

      <VueThemes
        cards={cards}
        profil={profil}
        personnalise={personnalise}
        sansFlux={simulateur}
        questionnaire={base.questionnaire}
        questionsActives={simulateur && generalSoumis}
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