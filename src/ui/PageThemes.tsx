import { BookOpen, SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { candidatsDeBase, resumesManquants, type BaseCharge } from "../data/bases";
import { lireOuverture } from "./router";
import { aDesInformations, type ProfilPartiel } from "../profil";
import { construireCards } from "./cards";
import { ecartesParIntegrite, meilleurs, sansDonnees, soldesConvictions, soldesSituation } from "../engine/candidatIdeal";
import { anonymiserCards } from "./aveugle";
import { choisirMode, cleIdentites, etatPourBase, recommencer, tirerGraine, type EtatIdeal } from "./etatIdeal";
import { CardCandidatIdeal } from "./CardCandidatIdeal";
import { versResultatAffiche } from "./resultatIdeal";
import { BlocConvictions, convictionsVisibles, integritesVisibles } from "./Convictions";
import { CONVICTIONS_VIDES, lireConvictions, memoriserConvictions, type Convictions } from "./memoireConvictions";
import { lireMode, memoriserMode, type ModeAffichage } from "./memoireReponses";
import { ModaleConfirmation } from "./ModaleConfirmation";
import { BandeauPertinence, Etapes, IntroEtape, NavEtape, RecapReponses, type Etape } from "./ParcoursSimulateur";
import PageQuestionsGenerales from "./PageQuestionsGenerales";
import { questionsRestantes } from "../questionnaire";
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
  // Étape de départ du parcours (tests) : par défaut, le résultat si le visiteur a déjà des réponses, sinon sa situation.
  etapeInitiale?: Etape;
}

// Page du simulateur : en « Explorer les mesures », les thèmes et sur chacun les portraits cliquables des candidats concernés ;
// en « Simuler pour moi », un parcours en quatre écrans (situation, mesures adaptées, convictions, candidat idéal).
export default function PageThemes({ base, profil, generalSoumis, onValider, onEffacer, onReponse, modeInitial, convictionsInitiales, releveInitial, etapeInitiale }: PageThemesProps) {
  // Arrivée depuis le tableau de l'accueil (ou une adresse partagée) : la carte du thème, avec ce candidat ouvert. Ce lien
  // nomme un candidat : on l'ouvre donc en « Explorer les mesures », seul mode où les identités sont visibles.
  const [ouverture] = useState(() => (typeof window === "undefined" ? null : lireOuverture(window.location.href)));
  // « Explorer les mesures » : les programmes seuls (ni indicateur, ni légende, ni formulaire, ni questions par thème),
  // identités visibles. « Simuler pour moi » : tout ce qui rattache les mesures à la situation du visiteur, à l'aveugle.
  const [mode, setMode] = useState<ModeAffichage>(() => modeInitial ?? (ouverture ? "exploration" : lireMode()));
  const simulateur = mode === "simulateur";
  // Incrémenté à chaque effacement : le formulaire repart d'un brouillon vide au lieu de garder d'anciennes réponses affichées.
  const [versionFormulaire, setVersionFormulaire] = useState(0);
  const [confirmerEffacement, setConfirmerEffacement] = useState(false);
  const { avecDonnees: candidats, enCoursAnalyse } = candidatsDeBase(base);
  const manquants = resumesManquants(base, candidats);
  const personnalise = simulateur && generalSoumis && aDesInformations(profil);
  // Le simulateur est un parcours : situation, mesures adaptées à cette situation, convictions, puis candidat idéal (card et
  // rappel des réponses). Un visiteur qui revient avec des réponses gardées arrive directement sur son résultat.
  const [etape, setEtape] = useState<Etape>(() => etapeInitiale ?? (releveInitial || personnalise ? "resultat" : "situation"));
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
  // Le mode n'est mémorisé que s'il est choisi par un clic (voir choisirMode) : un mode imposé par un lien n'est pas retenu.
  const changerMode = (suivant: ModeAffichage) => {
    setIdeal(choisirMode(ideal, mode, suivant, memoriserMode));
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
  const choixPositions = convictions.positions;
  // L'écart par intégrité se calcule sur les faits réels (jamais affichés à l'aveugle : seul le nombre d'écartés l'est).
  const ecartes = ecartesParIntegrite(integritesVisibles({ simulateur, exemplarite: convictions.exemplarite, aveugle: false, slugs: candidats.map((c) => c.meta.slug) }));
  const situationIdeale = personnalise ? versResultatAffiche("Selon votre situation", "thèmes", meilleurs(soldesSituation(cardsNommees)), correspondance, revele) : null;
  // Résultat « convictions » : omis quand aucun candidat n'a de mesure sur les sujets choisis (et que personne n'est écarté) —
  // plutôt que de promettre « le meilleur programme selon vos convictions » quand il n'existe pas.
  const meilleursConvictions = personnalise && Object.keys(choixPositions).length > 0 ? meilleurs(soldesConvictions(cardsNommees, choixPositions), ecartes) : null;
  const convictionsIdeales =
    meilleursConvictions && !sansDonnees(meilleursConvictions) ? versResultatAffiche("Selon vos convictions", "sujets", meilleursConvictions, correspondance, revele) : null;
  // « Recommencer » : on revient à la première étape, réponses gardées, et la card repasse floutée (nouvelles lettres).
  const relancerLaSimulation = () => setIdeal(recommencer());
  const allerA = (suivante: Etape) => {
    setEtape(suivante);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };
  // Navigation affichée en haut ET en bas de chaque écran : jamais besoin de défiler pour avancer ou revenir.
  const navSituation = { suivant: { libelle: "Voir les mesures adaptées à ma situation", onClick: () => allerA("themes") } };
  const navThemes = { precedent: { libelle: "Ma situation", onClick: () => allerA("situation") }, suivant: { libelle: "Suivant : mes convictions", onClick: () => allerA("convictions") } };
  const navConvictions = { precedent: { libelle: "Mesures adaptées à ma situation", onClick: () => allerA("themes") }, suivant: { libelle: "Voir mon candidat idéal", onClick: () => allerA("resultat") } };
  const navResultat = { precedent: { libelle: "Mes convictions", onClick: () => allerA("convictions") } };
  const recommencerLeParcours = () => {
    relancerLaSimulation();
    allerA("situation");
  };
  // Toute modification (réponse, conviction) invalide un résultat déjà révélé : la card repasse floutée.
  const invaliderIdeal = () => {
    if (revele) relancerLaSimulation();
  };
  useEffect(() => {
    if (ouverture) document.getElementById(`theme-${ouverture.theme}`)?.scrollIntoView({ block: "center" });
  }, [ouverture]);

  // Dès que la bascule sort de l'écran, elle se range sur le côté (icônes seules) ; son emplacement garde sa hauteur pour
  // que la page ne saute pas.
  const emplacement = useRef<HTMLDivElement>(null);
  const [hauteurBascule, setHauteurBascule] = useState(0);
  const [aCote, setACote] = useState(false);
  useEffect(() => {
    const maj = () => {
      const el = emplacement.current;
      if (!el) return;
      const { bottom } = el.getBoundingClientRect();
      if (bottom < 80 && !aCote) setHauteurBascule(el.offsetHeight);
      setACote(bottom < 80);
    };
    maj();
    window.addEventListener("scroll", maj, { passive: true });
    return () => window.removeEventListener("scroll", maj);
  }, [aCote]);

  return (
    <>
      <div ref={emplacement} className="bascule-emplacement" style={aCote ? { minHeight: hauteurBascule } : undefined}>
        <div className={aCote ? "bascule-mode bascule-mode--cote" : "bascule-mode"} role="group" aria-label="Mode d'affichage">
          <button type="button" aria-pressed={!simulateur} title="Explorer les mesures" onClick={() => changerMode("exploration")}>
            <BookOpen size={26} aria-hidden="true" focusable="false" />
            <span className="bascule-libelle">Explorer les mesures</span>
          </button>
          <button type="button" aria-pressed={simulateur} title="Simuler pour moi" onClick={() => changerMode("simulateur")}>
            <SlidersHorizontal size={26} aria-hidden="true" focusable="false" />
            <span className="bascule-libelle">Simuler pour moi</span>
          </button>
        </div>
      </div>

      <ModaleConfirmation
        ouverte={confirmerEffacement}
        titre="Effacer vos réponses ?"
        message="Toutes les informations saisies (questions générales, par thème et convictions) seront effacées, et les indicateurs disparaîtront des portraits. Cette action ne peut pas être annulée."
        libelleConfirmer="Oui, tout effacer"
        onConfirmer={() => {
          setConfirmerEffacement(false);
          setVersionFormulaire((v) => v + 1);
          setConvictions(CONVICTIONS_VIDES); // un seul effacement pour tout ce que le visiteur a saisi
          setIdeal({ ...ideal, revele: false });
          setEtape("situation");
          onEffacer();
        }}
        onAnnuler={() => setConfirmerEffacement(false)}
      />

      {/* Parcours : l'écran de la situation et celui des convictions restent montés, seulement masqués, pour ne perdre aucun
          brouillon en changeant d'écran. */}
      {simulateur && (
        <>
          <Etapes etape={etape} onAller={allerA} resultatAccessible={personnalise} />

          <div hidden={etape !== "situation"}>
            <NavEtape haut {...navSituation} />
            <IntroEtape etape="situation">
              <strong>Objectif :</strong> mesurer l'effet des mesures sur sa propre situation. Indiquer son âge, ses revenus, sa famille… Réponses facultatives, gardées dans le navigateur jusqu'à leur effacement.
            </IntroEtape>
            <PageQuestionsGenerales
              key={versionFormulaire}
              integre
              questions={base.questionnaire.generales}
              profilInitial={profil}
              sectionsThemes={generalSoumis ? base.questionnaire.parTheme : []}
              profilThemes={profil}
              onReponseTheme={(champ, brut) => {
                invaliderIdeal();
                onReponse(champ, brut);
              }}
              onValider={(p) => {
                // Les réponses par thème s'appliquent tout de suite : on les reprend du profil courant, pas du brouillon.
                const fusion: ProfilPartiel = { ...p };
                for (const { questions } of base.questionnaire.parTheme) {
                  for (const q of questions) {
                    if (profil[q.id] === undefined) delete fusion[q.id];
                    else fusion[q.id] = profil[q.id];
                  }
                }
                invaliderIdeal();
                onValider(fusion);
              }}
              onAnnuler={() => {}}
              onEffacer={personnalise ? () => setConfirmerEffacement(true) : undefined}
            />
            <NavEtape {...navSituation} />
          </div>

          <div hidden={etape !== "convictions"}>
            <NavEtape haut {...navConvictions} />
            <IntroEtape etape="convictions">
              <strong>Objectif :</strong> tenir compte de ses idées, pas seulement de sa situation. Choisir une position sur les sujets qui comptent ; sujet sans choix = aucune influence sur le résultat. Choix facultatifs, gardés dans le navigateur jusqu'à leur effacement.
            </IntroEtape>
            <BlocConvictions
              convictions={convictions}
              onChange={(c) => {
                invaliderIdeal();
                setConvictions(c);
              }}
            />
            <NavEtape {...navConvictions} />
          </div>
        </>
      )}

      {simulateur && etape === "resultat" && (
        <>
          <NavEtape haut {...navResultat} />
          <BandeauPertinence questionnaire={base.questionnaire} profil={profil} convictions={convictions} />
          {personnalise && (situationIdeale || convictionsIdeales) ? (
            <CardCandidatIdeal
              situation={situationIdeale}
              convictions={convictionsIdeales}
              questionsRestantes={questionsRestantes(base.questionnaire, profil)}
              positionsChoisies={Object.keys(convictions.positions).length > 0}
              revele={revele}
              onReveler={() => setIdeal({ ...ideal, revele: true })}
              onRecommencer={recommencerLeParcours}
            />
          ) : (
            <p className="recap-vide">Aucun résultat à révéler pour l'instant : répondez d'abord à au moins une question.</p>
          )}
          <RecapReponses questionnaire={base.questionnaire} profil={profil} convictions={convictions} onRecommencer={recommencerLeParcours} />
          <NavEtape {...navResultat} />
        </>
      )}

      {/* Mesures adaptées à la situation : les cards de thèmes avec leurs indicateurs, seules sur leur écran en simulateur. En
          exploration, elles restent la page elle-même. La clé referme les détails ouverts quand les lettres changent de sens
          (« Recommencer », autre base, retour en simulateur). */}
      {simulateur && etape === "themes" && (
        <>
          <NavEtape haut {...navThemes} />
          <IntroEtape etape="themes">
            <strong>Objectif :</strong> repérer, thème par thème, les mesures qui touchent sa situation et leur effet. Candidats <strong>anonymisés</strong> pour éviter les biais : lettres (Candidat A, B…) identiques d'un thème à l'autre.
          </IntroEtape>
        </>
      )}
      {(!simulateur || etape === "themes") && (
        <VueThemes
          key={cleIdentites(aveugle, graine)}
          convictions={convictionsVisibles(simulateur, convictions)}
          integrites={integrites}
          cards={cards}
          profil={profil}
          personnalise={personnalise}
          actionProfil={
            personnalise
              ? undefined
              : simulateur
                ? { type: "renseigner", onClick: () => allerA("situation") }
                : {
                    type: "simuler",
                    onClick: () => {
                      changerMode("simulateur");
                      allerA("situation");
                    },
                  }
          }
          questionnaire={base.questionnaire}
          questionsActives={simulateur && generalSoumis}
          onReponse={onReponse}
          ouvertInitial={(!aveugle && ouverture) || undefined}
        />
      )}
      {simulateur && etape === "themes" && <NavEtape {...navThemes} />}
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
