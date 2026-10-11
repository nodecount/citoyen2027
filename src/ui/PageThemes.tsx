import { Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { candidatsDeBase, resumesManquants, type BaseCharge } from "../data/bases";
import { lireOuverture, type Ecran } from "./router";
import { aDesInformations, type ProfilPartiel } from "../profil";
import { construireCards } from "./cards";
import { classement, combiner, ecartesParIntegrite, meilleurs, sansDonnees, soldesConvictions, soldesSituation } from "../engine/candidatIdeal";
import { anonymiserCards } from "./aveugle";
import { cleIdentites, etatPourBase, recommencer, tirerGraine, type EtatIdeal } from "./etatIdeal";
import { BandeauRevelation, CardCandidatIdeal } from "./CardCandidatIdeal";
import { versResultatAffiche } from "./resultatIdeal";
import { BlocConvictions, integritesVisibles } from "./Convictions";
import { aDesConvictions, CONVICTIONS_VIDES, lireConvictions, memoriserConvictions, type Convictions } from "./memoireConvictions";
import { etapeDeDepart, lireEtape, memoriserEtape } from "./memoireEtape";
import type { ModeAffichage } from "./memoireReponses";
import { ModaleConfirmation } from "./ModaleConfirmation";
import { BandeauPertinence, Etapes, IntroEtape, IntroMesures, NavEtape, RecapReponses, type Etape } from "./ParcoursSimulateur";
import PageQuestionsGenerales from "./PageQuestionsGenerales";
import { questionsRestantes } from "../questionnaire";
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
  // Étape de départ du parcours (tests) : par défaut, le résultat si le visiteur a déjà des réponses, sinon sa situation.
  etapeInitiale?: Etape;
}

// Pages « Exploration » et « Simulateur » : en exploration, les thèmes et sur chacun les portraits cliquables des candidats
// concernés ; en simulateur, un parcours en quatre écrans (situation, mesures adaptées, convictions, candidat idéal).
export default function PageThemes({ base, profil, generalSoumis, onValider, onEffacer, onReponse, mode, onNaviguer, convictionsInitiales, releveInitial, etapeInitiale }: PageThemesProps) {
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
  // Le simulateur est un parcours : situation, mesures adaptées à cette situation, convictions, puis candidat idéal (card et
  // rappel des réponses). Un visiteur qui revient arrive sur l'étape où il s'était arrêté (voir memoireEtape.ts), à défaut sur
  // celle que déduisent ses réponses et convictions gardées : 1 par défaut, puis 2 ou 3.
  const [etape, setEtape] = useState<Etape>(
    () => etapeInitiale ?? (releveInitial ? "resultat" : etapeDeDepart({ memorisee: lireEtape(), aDesReponses: personnalise, aDesConvictions: aDesConvictions(convictionsInitiales ?? lireConvictions()) })),
  );
  useEffect(() => {
    if (simulateur) memoriserEtape(etape);
  }, [simulateur, etape]);
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
  // Changer de mode, c'est changer de page : la page est remontée, donc nouvelle graine et card floutée (jamais de retour sur
  // une card déjà révélée).
  const changerMode = (suivant: ModeAffichage) => onNaviguer?.(suivant);
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
  const integritesReelles = integritesVisibles({ simulateur, exemplarite: convictions.exemplarite, aveugle: false, slugs: candidats.map((c) => c.meta.slug) });
  const ecartes = ecartesParIntegrite(integritesReelles);
  const soldesSit = personnalise ? soldesSituation(cardsNommees) : [];
  const situationIdeale = personnalise ? versResultatAffiche("Selon votre situation", "thèmes", meilleurs(soldesSit), correspondance, revele, anonymisation ? soldesSituation(cards) : [], classement(soldesSit)) : null;
  // Résultat « convictions » : omis quand aucun candidat n'a de mesure sur les sujets choisis (et que personne n'est écarté) —
  // plutôt que de promettre « le meilleur programme selon vos convictions » quand il n'existe pas.
  const soldesConv = personnalise && Object.keys(choixPositions).length > 0 ? soldesConvictions(cardsNommees, choixPositions) : null;
  const meilleursConvictions = soldesConv ? meilleurs(soldesConv, ecartes) : null;
  const convictionsIdeales =
    soldesConv && meilleursConvictions && !sansDonnees(meilleursConvictions) ? versResultatAffiche("Selon vos convictions", "sujets", meilleursConvictions, correspondance, revele, anonymisation ? soldesConvictions(cards, choixPositions) : [], classement(soldesConv, ecartes)) : null;
  // Candidat idéal tous critères confondus : scores de la situation et des convictions additionnés (la situation seule quand il
  // n'y a pas de résultat « convictions »). Les écartés par l'intégrité le sont dès que le critère convictions compte.
  const soldesCumul = convictionsIdeales && soldesConv ? combiner(soldesSit, soldesConv) : soldesSit;
  const ecartesCumul = convictionsIdeales ? ecartes : new Set<string>();
  const soldesCumulAnonymes = anonymisation ? (convictionsIdeales && soldesConv ? combiner(soldesSituation(cards), soldesConvictions(cards, choixPositions)) : soldesSituation(cards)) : [];
  const idealCumule = personnalise ? versResultatAffiche("Selon votre situation et vos convictions", "thèmes", meilleurs(soldesCumul, ecartesCumul), correspondance, revele, soldesCumulAnonymes, classement(soldesCumul, ecartesCumul)) : null;
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

  // Le bandeau de révélation de la card est-il à l'écran ? Tant qu'il l'est, le tableau n'affiche pas le sien. Sans card ou sans
  // IntersectionObserver, le tableau garde son bandeau (c'est alors le seul moyen de révéler).
  const [voileCardVisible, setVoileCardVisible] = useState(true);
  const carteAffichee = situationIdeale !== null || convictionsIdeales !== null;
  useEffect(() => {
    if (revele || etape !== "resultat") return;
    const voile = document.querySelector(".carte-ideal .ideal-voile");
    if (!voile || typeof IntersectionObserver === "undefined") {
      setVoileCardVisible(false);
      return;
    }
    const observateur = new IntersectionObserver(([entree]) => setVoileCardVisible(entree.isIntersecting));
    observateur.observe(voile);
    return () => observateur.disconnect();
  }, [revele, etape, carteAffichee]);

  return (
    <>
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
      <ModaleConfirmation
        ouverte={confirmerConvictions}
        titre="Effacer vos convictions ?"
        message="Vos choix (positions et intégrité) seront effacés de ce navigateur. Cette action ne peut pas être annulée."
        libelleConfirmer="Oui, tout effacer"
        onConfirmer={() => {
          setConfirmerConvictions(false);
          invaliderIdeal();
          setConvictions(CONVICTIONS_VIDES);
        }}
        onAnnuler={() => setConfirmerConvictions(false)}
      />

      {/* Parcours : l'écran de la situation et celui des convictions restent montés, seulement masqués, pour ne perdre aucun
          brouillon en changeant d'écran. */}
      {simulateur && (
        <>
          <Etapes etape={etape} onAller={allerA} resultatAccessible={personnalise} />

          <div hidden={etape !== "situation"}>
            <NavEtape haut {...navSituation} />
            <IntroEtape etape="situation">
              <p>
                <strong>Objectif :</strong> mesurer l'effet des mesures sur sa propre situation, en donnant des informations sur votre situation.
              </p>
              <p>Toutes les questions sont facultatives, mais plus vous répondez, plus l'estimation est précise.</p>
              <p className="intro-ligne-icone">
                <Lock size={22} aria-hidden="true" focusable="false" />
                <span>Vos informations sont sécurisées : votre navigateur les garde, sans jamais les envoyer, jusqu'à ce que vous les effaciez.</span>
              </p>
            </IntroEtape>
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
                onValider(fusion);
              }}
              onAnnuler={() => {}}
            />
            <NavEtape {...navSituation} milieu={personnalise ? { libelle: "Effacer mes réponses", onClick: () => setConfirmerEffacement(true) } : undefined} />
          </div>

          <div hidden={etape !== "convictions"}>
            <NavEtape haut {...navConvictions} />
            <IntroEtape etape="convictions">
              <p>
                <strong>Objectif :</strong> tenir compte de ses idées, pas seulement de sa situation.
              </p>
              <p>Vous choisissez une position sur les sujets qui comptent pour vous. Un sujet sans choix n'influence pas le résultat.</p>
              <p className="intro-ligne-icone">
                <Lock size={22} aria-hidden="true" focusable="false" />
                <span>Vos informations sont sécurisées : votre navigateur les garde, sans jamais les envoyer, jusqu'à ce que vous les effaciez.</span>
              </p>
            </IntroEtape>
            <BlocConvictions
              convictions={convictions}
              onChange={(c) => {
                invaliderIdeal();
                setConvictions(c);
              }}
            />
            <NavEtape {...navConvictions} milieu={aDesConvictions(convictions) ? { libelle: "Effacer mes convictions", onClick: () => setConfirmerConvictions(true) } : undefined} />
          </div>
        </>
      )}

      {simulateur && etape === "resultat" && (
        <>
          <NavEtape haut {...navResultat} />
          <BandeauPertinence questionnaire={base.questionnaire} profil={profil} convictions={convictions} onCompleterSituation={() => allerA("situation")} onCompleterConvictions={() => allerA("convictions")} />
          {personnalise && (situationIdeale || convictionsIdeales) ? (
            <CardCandidatIdeal
              situation={situationIdeale}
              convictions={convictionsIdeales}
              combine={idealCumule}
              questionsRestantes={questionsRestantes(base.questionnaire, profil)}
              positionsChoisies={Object.keys(convictions.positions).length > 0}
              revele={revele}
              onReveler={() => setIdeal({ ...ideal, revele: true })}
            />
          ) : (
            <p className="recap-vide">Aucun résultat à révéler pour l'instant : répondez d'abord à au moins une question.</p>
          )}
          {personnalise && (
            // Le tableau garde les lettres tant que l'identité n'est pas révélée. Son bandeau (même texte et même bouton que la
            // card) n'apparaît que lorsque celui de la card est hors écran : jamais deux messages identiques en même temps.
            <TableauResultat
              cards={revele ? cardsNommees : cards}
              positions={choixPositions}
              bandeau={
                !revele && !voileCardVisible ? (
                  <BandeauRevelation
                    avecConvictions={convictionsIdeales !== null}
                    questionsRestantes={questionsRestantes(base.questionnaire, profil)}
                    onReveler={() => setIdeal({ ...ideal, revele: true })}
                  />
                ) : null
              }
            />
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
          <IntroMesures questionnaire={base.questionnaire} profil={profil} convictions={convictions} onCompleter={() => allerA("situation")} />
        </>
      )}
      {(!simulateur || etape === "themes") && (
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
      )}
      {simulateur && etape === "themes" && <NavEtape {...navThemes} />}
      {!aveugle && manquants.length > 0 && (
        <p className="hint">
          Résumé pas encore disponible (le détail complet des mesures reste affiché) : {manquants.map((m) => `${m.nom} (${m.themeLibelle})`).join(", ")}.
        </p>
      )}
    </>
  );
}
