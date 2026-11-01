import { Clock, Lock } from "lucide-react";
import { useContext, useEffect, useState } from "react";
import { candidatsDeBase, resumesManquants, type BaseCharge } from "../data/bases";
import { lireOuverture, type Ecran } from "./router";
import { aDesInformations, retirerReponsesMasquees, type ProfilPartiel } from "../profil";
import { construireCards } from "./cards";
import { classement, combinerParNotes, ecartesParIntegrite, meilleurs, sansDonnees, soldesConvictions, soldesSituation } from "../engine/candidatIdeal";
import { anonymiserCards } from "./aveugle";
import { compterAvancement, dureeEstimee } from "./compteurs";
import { EcranDeuxZones } from "./EcranDeuxZones";
import { cleIdentites, etatPourBase, recommencer, tirerGraine, type EtatIdeal } from "./etatIdeal";
import { apresRevelation, choisirOnglet, ONGLETS_QUESTIONS, type OngletsZones } from "./etatZones";
import { versResultatAffiche } from "./resultatIdeal";
import { BlocConvictions, integritesVisibles } from "./Convictions";
import { aDesConvictions, CONVICTIONS_VIDES, lireConvictions, memoriserConvictions, type Convictions } from "./memoireConvictions";
import type { ModeAffichage } from "./memoireReponses";
import { ModaleConfirmation } from "./ModaleConfirmation";
import { IntroEtape, IntroMesures, type Vue } from "./ParcoursSimulateur";
import { ModaleTravail } from "./ModaleTravail";
import PageQuestionsGenerales from "./PageQuestionsGenerales";
import { PropositionsBase } from "./PropositionsContexte";
import type { SurReponse } from "./Questions";
import { TableauResultat } from "./TableauResultat";
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
  // Mode d'affichage, fixé par la page : « exploration » sur /exploration, « simulateur » sur /simulateur.
  mode: ModeAffichage;
  // Changement de page (liens entre l'exploration et le simulateur).
  onNaviguer?: (ecran: Ecran) => void;
  // Convictions de départ (par défaut : celles gardées dans le navigateur).
  convictionsInitiales?: Convictions;
  // État « révélé » de départ (tests) : chaque visite recommence floutée, il n'est jamais mémorisé.
  releveInitial?: boolean;
  // Vue de départ du simulateur (tests) : par défaut le tableau de bord, toujours non révélé, quelles que soient les réponses gardées.
  vueInitiale?: Vue;
}

// Pages « Exploration » et « Simulateur » : en exploration, les thèmes et sur chacun les portraits cliquables des candidats
// concernés ; en simulateur, un tableau de bord à trois blocs (situation, suggestion « Mon candidat idéal », convictions) d'où
// s'ouvrent les vues de travail (questions, mesures adaptées, convictions).
export default function PageThemes({ base, profil, generalSoumis, onValider, onEffacer, onReponse, mode, onNaviguer, convictionsInitiales, releveInitial, vueInitiale }: PageThemesProps) {
  // Arrivée depuis le tableau de l'accueil (ou une adresse partagée) : la carte du thème, avec ce candidat ouvert (page
  // Exploration, seul endroit où les identités sont visibles).
  const [ouverture] = useState(() => (typeof window === "undefined" ? null : lireOuverture(window.location.href)));
  // Exploration : les programmes seuls (ni indicateur, ni légende, ni formulaire, ni questions par thème), identités
  // visibles. Simulateur : tout ce qui rattache les mesures à la situation du visiteur, à l'aveugle.
  const simulateur = mode === "simulateur";
  // Incrémenté à chaque effacement : le formulaire repart d'un brouillon vide au lieu de garder d'anciennes réponses affichées.
  const [versionFormulaire, setVersionFormulaire] = useState(0);
  const [confirmerEffacement, setConfirmerEffacement] = useState(false);
  const [confirmerConvictions, setConfirmerConvictions] = useState(false);
  const { avecDonnees: candidats } = candidatsDeBase(base);
  const manquants = resumesManquants(base, candidats);
  const personnalise = simulateur && generalSoumis && aDesInformations(profil);
  const propositions = useContext(PropositionsBase);
  // Le simulateur s'ouvre toujours sur le tableau de bord, non révélé : on y voit d'où l'on en est et ce qui reste à remplir.
  const [vue, setVue] = useState<Vue>(vueInitiale ?? "zones");
  // État de la suggestion « candidat idéal » et graine des lettres (voir etatIdeal.ts : ce qui se réinitialise, et quand).
  const [ideal, setIdeal] = useState<EtatIdeal>(() => ({ revele: releveInitial ?? false, graine: tirerGraine() }));
  const { graine, revele } = ideal;
  // Onglets « Questions » / « Candidats » des deux blocs latéraux : « Candidats » ne s'ouvre qu'à la révélation.
  const [onglets, setOnglets] = useState<OngletsZones>(() => (releveInitial ? apresRevelation() : ONGLETS_QUESTIONS));
  const cardsNommees = construireCards(base.themes, candidats, personnalise ? profil : null);
  // Un autre jeu de candidats (changement de base) : suggestion refloutée, nouvelles lettres, onglets sur les questions, jamais le
  // gagnant révélé d'office.
  const [baseAffichee, setBaseAffichee] = useState(base.info.id);
  if (baseAffichee !== base.info.id) {
    setBaseAffichee(base.info.id);
    setIdeal(etatPourBase(ideal, baseAffichee, base.info.id));
    setOnglets(ONGLETS_QUESTIONS);
  }
  // Changer de mode, c'est changer de page : la page est remontée, donc nouvelle graine et suggestion floutée (jamais de retour sur
  // une suggestion déjà révélée).
  const changerMode = (suivant: ModeAffichage) => onNaviguer?.(suivant);
  // Simulateur À L'AVEUGLE, sans interrupteur (voir aveugle.ts) : les identités n'apparaissent qu'en « Explorer les mesures »
  // ou, plus tard, dans la suggestion une fois révélée. Lettres retirées au sort à chaque entrée en simulateur.
  const aveugle = simulateur;
  const anonymisation = aveugle ? anonymiserCards(cardsNommees, graine) : null;
  const cards = anonymisation?.cards ?? cardsNommees;
  // Convictions : bloc et panneau seulement en mode « Simuler pour moi » (elles rattachent les mesures au visiteur).
  const [convictions, setConvictions] = useState<Convictions>(() => convictionsInitiales ?? lireConvictions());
  useEffect(() => memoriserConvictions(convictions), [convictions]);
  // Faits d'intégrité : seulement si le visiteur y tient, en simulateur, et jamais à l'aveugle (un casier identifie).
  const integrites = integritesVisibles({ simulateur, exemplarite: convictions.exemplarite, aveugle, slugs: candidats.map((c) => c.meta.slug) });
  // Suggestion « candidat idéal » (voir EcranDeuxZones.tsx) : accessible dès une réponse, d'un côté ou de l'autre. Calculée sur les
  // données RÉELLES (cardsNommees) : l'anonymisation ne change que l'affichage, et l'identité n'est transmise qu'une fois révélée.
  const correspondance = anonymisation?.correspondance ?? [];
  const choixPositions = convictions.positions;
  // L'écart par intégrité se calcule sur les faits réels (jamais affichés à l'aveugle : seul le nombre d'écartés l'est).
  const integritesReelles = integritesVisibles({ simulateur, exemplarite: convictions.exemplarite, aveugle: false, slugs: candidats.map((c) => c.meta.slug) });
  const ecartes = ecartesParIntegrite(integritesReelles);
  const soldesSit = simulateur ? soldesSituation(cardsNommees) : [];
  const situationIdeale = personnalise ? versResultatAffiche("Selon votre situation", "thèmes", meilleurs(soldesSit), correspondance, revele, anonymisation ? soldesSituation(cards) : [], classement(soldesSit)) : null;
  // Résultat « convictions » : omis quand aucun candidat n'a de mesure sur les sujets choisis (et que personne n'est écarté) —
  // plutôt que de promettre « le meilleur programme selon vos convictions » quand il n'existe pas.
  const soldesConv = simulateur && Object.keys(choixPositions).length > 0 ? soldesConvictions(cardsNommees, choixPositions) : null;
  const meilleursConvictions = soldesConv ? meilleurs(soldesConv, ecartes) : null;
  const convictionsIdeales =
    soldesConv && meilleursConvictions && !sansDonnees(meilleursConvictions) ? versResultatAffiche("Selon vos convictions", "sujets", meilleursConvictions, correspondance, revele, anonymisation ? soldesConvictions(cards, choixPositions) : [], classement(soldesConv, ecartes)) : null;
  // Candidat idéal tous critères confondus : moyenne des notes de la situation et des convictions (la situation seule quand il
  // n'y a pas de résultat « convictions », les convictions seules quand il n'y a pas de situation). Les écartés par l'intégrité le
  // sont dès que le critère convictions compte.
  // Décision du 2026-11-01 : les deux critères sont d'abord notés sur 100 chacun, puis la MOYENNE des deux notes désigne le candidat
  // (et non plus l'addition des points bruts, qui laissait le critère le plus riche en mesures écraser l'autre). D'un seul côté, la
  // note de ce côté suffit.
  const deuxCriteres = personnalise && convictionsIdeales !== null && soldesConv !== null;
  const soldesCumul = deuxCriteres ? combinerParNotes(soldesSit, soldesConv!) : convictionsIdeales && soldesConv ? soldesConv : soldesSit;
  const ecartesCumul = convictionsIdeales ? ecartes : new Set<string>();
  const soldesCumulAnonymes = anonymisation
    ? deuxCriteres
      ? combinerParNotes(soldesSituation(cards), soldesConvictions(cards, choixPositions))
      : convictionsIdeales && soldesConv
        ? soldesConvictions(cards, choixPositions)
        : soldesSituation(cards)
    : [];
  const idealCumule = personnalise || convictionsIdeales ? versResultatAffiche("Selon votre situation et vos convictions", "thèmes", meilleurs(soldesCumul, ecartesCumul), correspondance, revele, soldesCumulAnonymes, classement(soldesCumul, ecartesCumul, 3, deuxCriteres ? 100 : undefined)) : null;
  const avance = compterAvancement(base.questionnaire, profil, convictions, propositions);

  const allerA = (suivante: Vue) => {
    setVue(suivante);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };
  // Suggestion refloutée avec de nouvelles lettres, onglets sur les questions : « Revenir aux questions », toute modification, tout
  // effacement.
  const reflouter = () => {
    setIdeal(recommencer());
    setOnglets(ONGLETS_QUESTIONS);
  };
  // Toute modification (réponse, conviction) invalide un résultat déjà révélé : la suggestion repasse floutée.
  const invaliderIdeal = () => {
    if (revele) reflouter();
  };
  useEffect(() => {
    if (ouverture) document.getElementById(`theme-${ouverture.theme}`)?.scrollIntoView({ block: "center" });
  }, [ouverture]);

  const retour = () => allerA("zones");
  const vueThemes = (
    <VueThemes
      key={cleIdentites(aveugle, graine)}
      convictions={CONVICTIONS_VIDES}
      anonyme={aveugle}
      onExplorer={() => {
        changerMode("exploration");
        if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
      }}
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
  );
  return (
    <>
      <ModaleConfirmation
        ouverte={confirmerEffacement}
        titre="Effacer vos réponses ?"
        message="Toutes vos réponses (votre situation et vos convictions) seront supprimées, et le candidat suggéré disparaîtra. Vous ne pourrez pas les récupérer."
        libelleConfirmer="Oui, tout effacer"
        onConfirmer={() => {
          setConfirmerEffacement(false);
          setVersionFormulaire((v) => v + 1);
          setConvictions(CONVICTIONS_VIDES); // un seul effacement pour tout ce que le visiteur a saisi
          setIdeal({ ...ideal, revele: false });
          setOnglets(ONGLETS_QUESTIONS);
          setVue("zones");
          onEffacer();
        }}
        onAnnuler={() => setConfirmerEffacement(false)}
      />
      <ModaleConfirmation
        ouverte={confirmerConvictions}
        titre="Effacer vos convictions ?"
        message="Toutes vos réponses sur vos convictions seront supprimées. Vous ne pourrez pas les récupérer."
        libelleConfirmer="Oui, tout effacer"
        onConfirmer={() => {
          setConfirmerConvictions(false);
          invaliderIdeal();
          setConvictions(CONVICTIONS_VIDES);
        }}
        onAnnuler={() => setConfirmerConvictions(false)}
      />

      {/* Vues de travail : celle de la situation et celle des convictions restent montées, seulement masquées, pour ne perdre aucun
          brouillon en revenant au tableau de bord. */}
      {simulateur && (
        <>
          <ModaleTravail ouverte={vue === "situation"} titre="Ma situation" onFermer={retour} pleinePage introAuDebut={avance.repondues === 0} intro={
            <IntroEtape etape="situation">
              <p>
                <strong>Objectif :</strong> mesurer l'effet des mesures sur sa propre situation, en donnant des informations sur votre situation.
              </p>
              <p>Toutes les questions sont facultatives, mais plus vous répondez, plus l'estimation est précise.</p>
              <p className="intro-ligne-icone">
                <Clock size={22} aria-hidden="true" focusable="false" />
                <span>
                  Durée : <strong>{dureeEstimee(avance.questions)}</strong> pour répondre à tout, à raison d'une dizaine de secondes par question.
                </span>
              </p>
              <p className="intro-ligne-icone">
                <Lock size={22} aria-hidden="true" focusable="false" />
                <span>Vos informations sont sécurisées : votre navigateur les garde, sans jamais les envoyer, jusqu'à ce que vous les effaciez.</span>
              </p>
            </IntroEtape>
          }>
            <PageQuestionsGenerales
              key={versionFormulaire}
              integre
              champs={base.champs}
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
                // Les réponses par thème reprises ci-dessus peuvent dépendre d'une réponse générale qui vient de changer (statut passé
                // de « retraité » à « salarié », ou l'inverse) : celles devenues sans objet sont retirées, jamais gardées en cachette.
                onValider(retirerReponsesMasquees(fusion, base.champs));
              }}
              onAnnuler={() => {}}
            />
          </ModaleTravail>

          <ModaleTravail ouverte={vue === "convictions"} titre="Mes convictions" onFermer={retour} pleinePage introAuDebut={avance.convictions === 0} intro={
            <IntroEtape etape="convictions">
              <p>
                <strong>Objectif :</strong> tenir compte de ses idées, pas seulement de sa situation.
              </p>
              <p>Vous choisissez une position sur les sujets qui comptent pour vous. Un sujet sans choix n'influence pas le résultat.</p>
              <p className="intro-ligne-icone">
                <Clock size={22} aria-hidden="true" focusable="false" />
                <span>
                  Durée : <strong>{dureeEstimee(avance.sujets)}</strong> pour répondre à tous les sujets, à raison d'une dizaine de secondes par sujet.
                </span>
              </p>
              <p className="intro-ligne-icone">
                <Lock size={22} aria-hidden="true" focusable="false" />
                <span>Vos informations sont sécurisées : votre navigateur les garde, sans jamais les envoyer, jusqu'à ce que vous les effaciez.</span>
              </p>
            </IntroEtape>
          }>
            <BlocConvictions
              convictions={convictions}
              onChange={(c) => {
                invaliderIdeal();
                setConvictions(c);
              }}
            />
          </ModaleTravail>
        </>
      )}

      {simulateur && (
        <>
          <EcranDeuxZones
            situation={{ repondues: avance.repondues, total: avance.questions }}
            convictions={{ repondues: avance.convictions, total: avance.sujets }}
            resultatSituation={situationIdeale}
            resultatConvictions={convictionsIdeales}
            combine={idealCumule}
            positionsChoisies={Object.keys(convictions.positions).length > 0}
            revele={revele}
            onglets={onglets}
            mesuresAccessibles={personnalise}
            peutEffacerReponses={personnalise}
            peutEffacerConvictions={aDesConvictions(convictions)}
            onReveler={() => {
              setIdeal({ ...ideal, revele: true });
              setOnglets(apresRevelation());
            }}
            onRevenir={reflouter}
            onChoisirOnglet={(zone, onglet) => setOnglets((o) => choisirOnglet(o, zone, onglet, revele))}
            onOuvrir={allerA}
            onEffacerReponses={() => setConfirmerEffacement(true)}
            onEffacerConvictions={() => setConfirmerConvictions(true)}
          />
          {personnalise && <TableauResultat cards={revele ? cardsNommees : cards} positions={choixPositions} />}
        </>
      )}

      {/* Mesures adaptées à la situation : les cards de thèmes avec leurs indicateurs, seules sur leur vue en simulateur. En
          exploration, elles restent la page elle-même. La clé referme les détails ouverts quand les lettres changent de sens
          (« Revenir aux questions », autre base, retour en simulateur). */}
      {simulateur && (
        <ModaleTravail ouverte={vue === "themes"} titre="Mesures adaptées à ma situation" onFermer={retour}>
          {vue === "themes" && (
            <>
              <IntroMesures questionnaire={base.questionnaire} profil={profil} onCompleter={() => allerA("situation")} />
              {vueThemes}
            </>
          )}
        </ModaleTravail>
      )}
      {!simulateur && vueThemes}
      {!aveugle && manquants.length > 0 && (
        <p className="hint">
          Résumé pas encore disponible (le détail complet des mesures reste affiché) : {manquants.map((m) => `${m.nom} (${m.themeLibelle})`).join(", ")}.
        </p>
      )}
    </>
  );
}
