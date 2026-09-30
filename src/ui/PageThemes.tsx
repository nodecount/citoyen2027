import { BookOpen, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { candidatsDeBase, resumesManquants, type BaseCharge } from "../data/bases";
import { lireOuverture } from "./router";
import { aDesInformations, type ProfilPartiel } from "../profil";
import { construireCards } from "./cards";
import { GROUPES_SOCIAUX } from "../convictions";
import { ecartesParIntegrite, meilleurs, soldesConvictions, soldesSituation, type Meilleurs } from "../engine/candidatIdeal";
import { anonymiserCards } from "./aveugle";
import { apresChangementDeMode, cleIdentites, etatPourBase, recommencer, tirerGraine, type EtatIdeal } from "./etatIdeal";
import { CardCandidatIdeal, type ResultatAffiche } from "./CardCandidatIdeal";
import { BlocConvictions, convictionsVisibles, integritesVisibles } from "./Convictions";
import { CONVICTIONS_VIDES, lireConvictions, memoriserConvictions, type Convictions } from "./memoireConvictions";
import { lireMode, memoriserMode, type ModeAffichage } from "./memoireReponses";
import { ModaleConfirmation } from "./ModaleConfirmation";
import PageQuestionsGenerales from "./PageQuestionsGenerales";
import { compterReponses, questionsRestantes } from "../questionnaire";
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
  // Convictions de départ (par défaut : celles gardées dans le navigateur).
  convictionsInitiales?: Convictions;
  // État « révélé » de départ (tests) : chaque visite recommence floutée, il n'est jamais mémorisé.
  releveInitial?: boolean;
}

// Page du simulateur : les thèmes, et sur chacun les portraits cliquables des candidats concernés. Aucun indicateur
// tant que le formulaire général n'a pas été validé (et qu'il contient au moins une réponse).
export default function PageThemes({ base, profil, generalSoumis, onValider, onEffacer, onReponse, modeInitial, convictionsInitiales, releveInitial }: PageThemesProps) {
  // Arrivée depuis le tableau de l'accueil (ou une adresse partagée) : la carte du thème, avec ce candidat ouvert. Ce lien
  // nomme un candidat : on l'ouvre donc en « Explorer les mesures », seul mode où les identités sont visibles.
  const [ouverture] = useState(() => (typeof window === "undefined" ? null : lireOuverture(window.location.href)));
  // « Explorer les mesures » : les programmes seuls (ni indicateur, ni légende, ni formulaire, ni questions par thème),
  // identités visibles. « Simuler pour moi » : tout ce qui rattache les mesures à la situation du visiteur, à l'aveugle.
  const [mode, setMode] = useState<ModeAffichage>(() => modeInitial ?? (ouverture ? "exploration" : lireMode()));
  useEffect(() => memoriserMode(mode), [mode]);
  const simulateur = mode === "simulateur";
  // Le formulaire général s'ouvre ici, avant les cartes de thèmes, plutôt que de rediriger vers une autre page.
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [confirmerEffacement, setConfirmerEffacement] = useState(false);
  const { avecDonnees: candidats, enCoursAnalyse } = candidatsDeBase(base);
  const manquants = resumesManquants(base, candidats);
  const personnalise = simulateur && generalSoumis && aDesInformations(profil);
  const reponsesGenerales = compterReponses(base.questionnaire.generales, profil);
  const cardsNommees = construireCards(base.themes, candidats, personnalise ? profil : null);
  // Simulateur À L'AVEUGLE, sans interrupteur (voir aveugle.ts) : les identités n'apparaissent qu'en « Explorer les mesures »
  // ou, plus tard, dans la card « candidat idéal » une fois révélée. Lettres retirées au sort à chaque entrée en simulateur.
  const aveugle = simulateur;
  // État de la card « candidat idéal » et graine des lettres (voir etatIdeal.ts : ce qui se réinitialise, et quand).
  const [ideal, setIdeal] = useState<EtatIdeal>(() => ({ revele: releveInitial ?? false, graine: tirerGraine() }));
  const { graine, revele } = ideal;
  // Un autre jeu de candidats (changement de base) : card refloutée, nouvelles lettres, jamais le gagnant révélé d'office.
  const [baseAffichee, setBaseAffichee] = useState(base.info.id);
  if (baseAffichee !== base.info.id) {
    setBaseAffichee(base.info.id);
    setIdeal(etatPourBase(ideal, baseAffichee, base.info.id));
  }
  // Quitter ou entrer en simulateur repart de zéro : jamais de retour sur une card déjà révélée.
  const changerMode = (suivant: ModeAffichage) => {
    setIdeal(apresChangementDeMode(ideal, mode, suivant));
    setMode(suivant);
  };
  const anonymisation = aveugle ? anonymiserCards(cardsNommees, graine) : null;
  const cards = anonymisation?.cards ?? cardsNommees;
  // Convictions : bloc et panneau seulement en mode « Simuler pour moi » (elles rattachent les mesures au visiteur).
  const [convictions, setConvictions] = useState<Convictions>(() => convictionsInitiales ?? lireConvictions());
  useEffect(() => memoriserConvictions(convictions), [convictions]);
  // Faits d'intégrité : seulement si le visiteur y tient, en simulateur, et jamais à l'aveugle (un casier identifie).
  const integrites = integritesVisibles({ simulateur, exemplarite: convictions.exemplarite, aveugle, slugs: candidats.map((c) => c.meta.slug) });
  // Card « candidat idéal » (voir CardCandidatIdeal.tsx) : seulement quand des indicateurs existent. Calculée sur les
  // données RÉELLES (cardsNommees) : l'anonymisation ne change que l'affichage, et l'identité n'est transmise à la card
  // qu'une fois révélée.
  const correspondance = anonymisation?.correspondance ?? [];
  const versAffiche = (titre: string, unite: ResultatAffiche["unite"], m: Meilleurs | null): ResultatAffiche | null =>
    m && {
      titre,
      unite,
      solde: m.solde,
      departageable: m.departageable,
      ecartes: m.ecartes,
      gagnants: m.gagnants.map((g) => {
        const c = correspondance.find((x) => x.slug === g.slug);
        return {
          lettre: c?.lettre ?? "?",
          identite: revele && c ? { slug: c.slug, nom: c.nom, parti: c.parti } : null,
          ameliorants: g.ameliorants,
          degradants: g.degradants,
          analyses: g.analyses,
        };
      }),
    };
  const groupesChoisis = GROUPES_SOCIAUX.filter((g) => convictions.groupes.includes(g.id));
  // L'écart par intégrité se calcule sur les faits réels (jamais affichés à l'aveugle : seul le nombre d'écartés l'est).
  const ecartes = ecartesParIntegrite(integritesVisibles({ simulateur, exemplarite: convictions.exemplarite, aveugle: false, slugs: candidats.map((c) => c.meta.slug) }));
  const situationIdeale = personnalise ? versAffiche("Selon votre situation", "thèmes", meilleurs(soldesSituation(cardsNommees))) : null;
  const convictionsIdeales =
    personnalise && groupesChoisis.length > 0 ? versAffiche("Selon vos convictions", "constats", meilleurs(soldesConvictions(cardsNommees, groupesChoisis), ecartes)) : null;
  const relancerLaSimulation = () => setIdeal(recommencer());
  // Une fois le candidat idéal révélé, le formulaire disparaît (réponses et convictions gardées, « Recommencer » le rouvre).
  const formulaireVisible = simulateur && !revele;
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
        <button type="button" aria-pressed={simulateur} onClick={() => changerMode("simulateur")}>
          <SlidersHorizontal size={18} aria-hidden="true" focusable="false" />
          Simuler pour moi
        </button>
      </div>

      {formulaireVisible && formulaireOuvert && (
        <PageQuestionsGenerales
          integre
          questions={base.questionnaire.generales}
          profilInitial={profil}
          sectionsThemes={generalSoumis ? base.questionnaire.parTheme : []}
          profilThemes={profil}
          onReponseTheme={onReponse}
          onValider={(p) => {
            // Les réponses par thème s'appliquent tout de suite : on les reprend du profil courant, pas du brouillon.
            const fusion: ProfilPartiel = { ...p };
            for (const { questions } of base.questionnaire.parTheme) {
              for (const q of questions) {
                if (profil[q.id] === undefined) delete fusion[q.id];
                else fusion[q.id] = profil[q.id];
              }
            }
            onValider(fusion);
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
        message="Toutes les informations saisies (questions générales, par thème et convictions) seront effacées, et les indicateurs disparaîtront des portraits. Cette action ne peut pas être annulée."
        libelleConfirmer="Oui, tout effacer"
        onConfirmer={() => {
          setConfirmerEffacement(false);
          setFormulaireOuvert(false);
          setConvictions(CONVICTIONS_VIDES); // un seul effacement pour tout ce que le visiteur a saisi
          setIdeal({ ...ideal, revele: false });
          onEffacer();
        }}
        onAnnuler={() => setConfirmerEffacement(false)}
      />

      {/* Après enregistrement : une simple ligne (pas tout le formulaire, qui prendrait la place des thèmes). « Modifier »
          rouvre le même formulaire, toujours avec son bouton d'enregistrement : on peut changer ou compléter ses réponses
          à tout moment. */}
      {personnalise && formulaireVisible && !formulaireOuvert && (
        <div className="recap-situation" role="region" aria-label="Vos réponses générales">
          <p>
            <strong>Ma situation</strong> : {reponsesGenerales.repondues} réponse{reponsesGenerales.repondues > 1 ? "s" : ""} sur {reponsesGenerales.total}
          </p>
          <button type="button" className="secondaire" onClick={() => setFormulaireOuvert(true)}>
            Modifier mes réponses
          </button>
        </div>
      )}
      {formulaireVisible && !personnalise && !formulaireOuvert && (
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

      {formulaireVisible && <BlocConvictions convictions={convictions} onChange={setConvictions} />}

      {personnalise && (situationIdeale || convictionsIdeales) && (
        <CardCandidatIdeal
          situation={situationIdeale}
          convictions={convictionsIdeales}
          questionsRestantes={questionsRestantes(base.questionnaire, profil)}
          revele={revele}
          onReveler={() => setIdeal({ ...ideal, revele: true })}
          onRecommencer={relancerLaSimulation}
        />
      )}

      {/* La clé referme les détails ouverts quand les lettres changent de sens (« Recommencer », autre base, retour en simulateur). */}
      <VueThemes
        key={cleIdentites(aveugle, graine)}
        convictions={convictionsVisibles(simulateur, convictions)}
        integrites={integrites}
        cards={cards}
        profil={profil}
        personnalise={personnalise}
        sansFlux={simulateur}
        actionProfil={
          personnalise
            ? undefined
            : simulateur
              ? {
                  type: "renseigner",
                  onClick: () => {
                    setFormulaireOuvert(true);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  },
                }
              : { type: "simuler", onClick: () => changerMode("simulateur") }
        }
        questionnaire={base.questionnaire}
        questionsActives={simulateur && generalSoumis}
        onReponse={onReponse}
        ouvertInitial={(!aveugle && ouverture) || undefined}
      />
      {!aveugle && enCoursAnalyse.length > 0 && (
        <p className="hint">Programmes pas encore analysés : {enCoursAnalyse.map((meta) => meta.nom).join(", ")}.</p>
      )}
      {!aveugle && manquants.length > 0 && (
        <p className="hint">
          Résumé pas encore disponible (le détail complet des mesures reste affiché) : {manquants.map((m) => `${m.nom} (${m.themeLibelle})`).join(", ")}.
        </p>
      )}
    </>
  );
}