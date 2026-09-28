import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Info, X } from "lucide-react";
import { flushSync } from "react-dom";
import { libelleCitation } from "../citations";
import { evaluerProposition } from "../engine";
import type { NiveauProjection, Projection } from "../engine/projection";
import { compterReponses, questionsDuTheme, type Questionnaire } from "../questionnaire";
import type { ProfilPartiel } from "../profil";
import type { ChampProfil, Proposition, Remarque, ResumeTheme } from "../types";
import type { CardTheme, LigneCandidat } from "./cards";
import { FluxCandidats } from "./FluxCandidats";
import { IconeTheme } from "./icones";
import { Pastille } from "./Pastille";
import { NIVEAUX, decrireEffet } from "./projection";
import { SectionQuestions, type SurReponse } from "./Questions";

const ORDRE_LEGENDE: NiveauProjection[] = ["ameliorant", "mixte", "non_concerne", "degradant"];

function BadgeNiveau({ niveau }: { niveau: NiveauProjection }) {
  const { libelle, symbole, sens } = NIVEAUX[niveau];
  return (
    <span className={`niveau niveau--${niveau.replace("_", "-")}`} title={sens}>
      <span aria-hidden="true">{symbole}</span> {libelle}
    </span>
  );
}

function ListeSources({ sources }: { sources: Array<{ texte: string; url: string }> }) {
  return (
    <>
      {sources.map((source, index) => (
        <span key={source.url}>
          {index > 0 && ", "}
          <a href={source.url} target="_blank" rel="noopener noreferrer">
            {source.texte}
          </a>
        </span>
      ))}
    </>
  );
}

function MesureAnalysee({ proposition, profil, remarques = [] }: { proposition: Proposition; profil: ProfilPartiel; remarques?: Remarque[] }) {
  // Une règle propre à une mesure ne s'applique que si le visiteur a répondu aux questions dont elle dépend
  // (voir evaluerProposition) : sinon explication générale, jamais « non concerné » sur une réponse manquante.
  const impact = evaluerProposition(profil, proposition);
  const laConcernant = remarques.filter((r) => r.mesures.includes(proposition.id));
  // Chaque mesure est repliée : son titre suffit pour parcourir la liste ; on la déplie pour le détail et la source.
  return (
    <li>
      <details className="mesure">
        <summary>{proposition.titre}</summary>
        <div className="mesure-corps">
          {impact.explication !== proposition.titre && <p>{impact.explication}</p>}
          {impact.niveau === "chiffre_personnalise" && impact.montant_estime !== undefined && (
            <p>Estimation pour votre profil : {impact.montant_estime} €/an</p>
          )}
          {!impact.concerne && (
            <p>
              <em>Cette mesure ne s'applique pas à votre profil.</em>
            </p>
          )}
          {/* Remarque de relecture sur le résumé du thème (voir Remarque) : jamais dans le calcul, seulement ici, à
              côté de la mesure qu'elle désigne. */}
          {laConcernant.map((r, index) => (
            <p className="remarque" key={index}>
              <strong>Remarque :</strong> {r.texte}
            </p>
          ))}
          <p className="sources">
            Source :{" "}
            <ListeSources sources={proposition.sources.map((s) => ({ texte: libelleCitation(s), url: s.url }))} />
          </p>
        </div>
      </details>
    </li>
  );
}

// Sur un vrai « mixte » (favorable ET défavorable, jamais le « mixte à préciser »), répartit les mesures du thème
// entre celles retenues comme favorables et celles retenues comme défavorables, d'après les effets que l'indicateur a
// effectivement retenus (voir `Projection.effetsRetenus`). Une mesure aux effets contradictoires peut figurer dans
// les deux listes ; une mesure sans effet retenu (exclue, ou sans effet déterminé) ne figure dans aucune des deux.
function grouperParPolarite(projection: Projection, propositions: Proposition[]): { favorables: Proposition[]; defavorables: Proposition[] } {
  const idsFavorables = new Set(projection.effetsRetenus.filter((e) => e.polarite === "favorable").map((e) => e.propositionId));
  const idsDefavorables = new Set(projection.effetsRetenus.filter((e) => e.polarite === "defavorable").map((e) => e.propositionId));
  return {
    favorables: propositions.filter((p) => idsFavorables.has(p.id)),
    defavorables: propositions.filter((p) => idsDefavorables.has(p.id)),
  };
}

// Un groupe de mesures sous un petit titre coloré (vert « favorables », rouge « défavorables » : les couleurs déjà
// utilisées pour ces sens partout ailleurs sur la page). Chaque mesure garde son affichage habituel (titre dépliable,
// explication, source). Rien n'est affiché si le groupe est vide.
function GroupeMesures({
  titre,
  sens,
  propositions,
  profil,
  remarques,
}: {
  titre: string;
  sens: "favorable" | "defavorable" | "neutre";
  propositions: Proposition[];
  profil: ProfilPartiel;
  remarques?: Remarque[];
}) {
  if (propositions.length === 0) return null;
  return (
    <div className={`groupe-mesures groupe-mesures--${sens}`}>
      <p className="groupe-mesures-titre">{titre}</p>
      <ul className="liste-mesures">
        {propositions.map((proposition) => (
          <MesureAnalysee key={proposition.id} proposition={proposition} profil={profil} remarques={remarques} />
        ))}
      </ul>
    </div>
  );
}

// Résumé en 40 à 60 mots : chaque mot clé porte un numéro renvoyant à ses mesures (voir CitationsResume, dans
// l'onglet Mesures).
function Resume({ resume }: { resume: ResumeTheme }) {
  let numero = 0;
  return (
    <p className="resume">
      {resume.segments.map((segment, index) => {
        if (segment.mesures.length === 0) return <span key={index}>{segment.texte}</span>;
        numero += 1;
        return (
          <span key={index} className="mot-cle">
            {segment.texte}
            <sup>{numero}</sup>
          </span>
        );
      })}
    </p>
  );
}

// `titre` n'est mis entre guillemets que lorsqu'il reprend vraiment la source mot pour mot (voir `titre_litteral` sur
// Proposition) : jamais sur une reformulation neutre, qui ne doit jamais se faire passer pour une citation.
export function texteMesure(p: Proposition): string {
  return p.titre_litteral ? `« ${p.titre} »` : p.titre;
}

// Un spoiler par mot clé du résumé, numéroté comme son renvoi : à l'intérieur, les mesures qu'il recouvre, citées
// (entre guillemets quand c'en est une), avec leurs sources.
export function CitationsResume({ resume, propositions }: { resume: ResumeTheme; propositions: Proposition[] }) {
  const parId = new Map(propositions.map((p) => [p.id, p]));
  const motsCles = resume.segments.filter((s) => s.mesures.length > 0);
  return (
    <ol className="citations-resume">
      {motsCles.map((segment, index) => (
        <li key={index}>
          <details className="citation-reference">
            <summary>
              {index + 1}. {segment.texte}
            </summary>
            <ul className="citation-reference-corps">
              {segment.mesures
                .map((id) => parId.get(id))
                .filter((p): p is Proposition => p !== undefined)
                .map((p) => (
                  <li key={p.id}>
                    {texteMesure(p)}{" "}
                    <span className="sources">
                      (<ListeSources sources={p.sources.map((s) => ({ texte: libelleCitation(s), url: s.url }))} />)
                    </span>
                  </li>
                ))}
            </ul>
          </details>
        </li>
      ))}
    </ol>
  );
}

// Le détail d'un candidat sur un thème, ouvert depuis son portrait : programme d'abord (synthèse, sources, mesures),
// puis — seulement si le visiteur a donné des informations — ce que cela change pour lui.
function DetailCandidat({ ligne, profil, id, onFermer }: { ligne: LigneCandidat; profil: ProfilPartiel; id: string; onFermer?: () => void }) {
  const { meta, projection, synthese, resume, sources, messagesSansBadge, messagesIncertitude, messagesEffetsExclus, propositions, remarques } = ligne;
  const niveau = projection?.niveau ?? null;
  // Avec un résumé : deux vues, le résumé (par défaut) et ses références citées (« Mesures »). Sans résumé ni
  // synthèse, le détail complet des mesures directement, seul.
  const aUnTexte = Boolean(resume || synthese);
  const [vue, setVue] = useState<"resume" | "citations">("resume");
  const vueActive = aUnTexte ? vue : "detail";
  const nombre = propositions.length;
  // Un vrai « mixte » (jamais le « mixte à préciser », qui n'a pas encore de sens établi par mesure) : le détail
  // répartit ses mesures en favorables et défavorables plutôt que de les lister toutes ensemble.
  const estMixteReel = niveau === "mixte" && projection !== null && !projection.incertain;
  const { favorables, defavorables } = estMixteReel && projection ? grouperParPolarite(projection, propositions) : { favorables: [], defavorables: [] };
  const autres = estMixteReel ? propositions.filter((p) => !favorables.includes(p) && !defavorables.includes(p)) : [];

  return (
    <div className="detail" id={id} role="region" aria-label={`Détail : ${meta.nom}`}>
      {onFermer && (
        <button type="button" className="bouton-icone detail-fermer" aria-label={`Fermer : ${meta.nom}`} onClick={onFermer}>
          <X size={20} aria-hidden="true" />
        </button>
      )}
      {/* Portrait agrandi, sorti d'un tiers au-dessus du cadre — un rappel du candidat qu'on vient d'ouvrir. */}
      <div className="detail-profil">
        <span className="detail-avatar">
          <Pastille slug={meta.slug} nom={meta.nom} />
          <span className="portrait-compte" aria-hidden="true">
            {nombre}
          </span>
          <span className="cache-visuel">
            {nombre} mesure{nombre > 1 ? "s" : ""} sur ce thème
          </span>
        </span>
        <h3 className="detail-titre">{meta.nom}</h3>
        {resume && (
          <div className="onglets-detail" role="group" aria-label="Affichage">
            <button type="button" aria-pressed={vueActive === "resume"} onClick={() => setVue("resume")}>
              Résumé
            </button>
            <button type="button" aria-pressed={vueActive === "citations"} onClick={() => setVue("citations")}>
              {nombre > 1 ? `Détail des ${nombre} mesures` : "Détail de la mesure"}
            </button>
          </div>
        )}
      </div>
      {/* Entête (portrait, nom, onglets) fixe ; le contenu (résumé ou liste des mesures, puis « Pour votre profil ») défile. */}
      <div className="detail-contenu">
      {vueActive === "detail" ? (
        estMixteReel ? (
          <>
            <GroupeMesures titre="Mesures favorables" sens="favorable" propositions={favorables} profil={profil} remarques={remarques} />
            <GroupeMesures titre="Mesures défavorables" sens="defavorable" propositions={defavorables} profil={profil} remarques={remarques} />
            <GroupeMesures titre="Autres mesures" sens="neutre" propositions={autres} profil={profil} remarques={remarques} />
          </>
        ) : (
          <ul className="liste-mesures">
            {propositions.map((proposition) => (
              <MesureAnalysee key={proposition.id} proposition={proposition} profil={profil} remarques={remarques} />
            ))}
          </ul>
        )
      ) : vueActive === "citations" && resume ? (
        <CitationsResume resume={resume} propositions={propositions} />
      ) : resume ? (
        <Resume resume={resume} />
      ) : synthese ? (
        <>
          <p className="synthese">{synthese.texte}</p>
          <p className="sources-citees">
            Sources : <ListeSources sources={sources} />
          </p>
        </>
      ) : null}

      {projection &&
        (niveau ? (
          <>
            <p className="pour-votre-profil">
              <strong>Pour votre profil :</strong> {NIVEAUX[niveau].sens}
            </p>
            {/* Déjà réparties dans le détail des mesures quand il est affiché : pas de répétition. */}
            {estMixteReel && vueActive !== "detail" && (
              <>
                <GroupeMesures titre="Mesures favorables" sens="favorable" propositions={favorables} profil={profil} remarques={remarques} />
                <GroupeMesures titre="Mesures défavorables" sens="defavorable" propositions={defavorables} profil={profil} remarques={remarques} />
              </>
            )}
            {messagesIncertitude.map((message) => (
              <p className="pour-votre-profil incertitude" key={message}>
                {message}
              </p>
            ))}
          </>
        ) : (
          <>
            <p className="pour-votre-profil">
              <strong>Pour votre profil :</strong> pas d'indicateur pour l'instant.
            </p>
            {messagesSansBadge.map((message) => (
              <p className="pour-votre-profil" key={message}>
                {message}
              </p>
            ))}
          </>
        ))}
      {/* Toujours affiché quand il s'applique, même à côté d'un badge : jamais l'impression que l'indicateur tient compte de tout. */}
      {messagesEffetsExclus.map((message) => (
        <p className="pour-votre-profil exclus" key={message}>
          {message}
        </p>
      ))}

      {projection && projection.effetsRetenus.length > 0 && (
        <details className="pourquoi">
          <summary>Pourquoi cet indicateur ?</summary>
          <ul>
            {projection.effetsRetenus.map(({ propositionId, effet, polarite }, index) => {
              const mesure = propositions.find((p) => p.id === propositionId);
              return (
                <li key={`${propositionId}-${index}`}>
                  <strong>{mesure?.titre ?? propositionId}</strong>
                  <br />
                  {decrireEffet(effet)} — {polarite === "favorable" ? "favorable" : "défavorable"} pour votre situation.
                  <br />
                  <q>{effet.extrait}</q>
                </li>
              );
            })}
          </ul>
        </details>
      )}
      </div>
    </div>
  );
}

// Copie d'un élément posée au même endroit de la carte, qui s'estompe puis disparaît : donne un fondu de sortie à un
// élément que React retire aussitôt du DOM. Décorative (masquée aux lecteurs d'écran, non cliquable).
function estomper(element: HTMLElement) {
  const carte = element.closest("article");
  if (!carte || typeof element.animate !== "function") return;
  const cadre = carte.getBoundingClientRect();
  const place = element.getBoundingClientRect();
  const copie = element.cloneNode(true) as HTMLElement;
  copie.removeAttribute("id");
  copie.setAttribute("aria-hidden", "true");
  Object.assign(copie.style, {
    position: "absolute",
    left: `${place.left - cadre.left}px`,
    top: `${place.top - cadre.top}px`,
    width: `${place.width}px`,
    margin: "0",
    pointerEvents: "none",
    zIndex: "3",
  });
  carte.appendChild(copie);
  copie.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: "ease-out" }).finished.then(
    () => copie.remove(),
    () => copie.remove(),
  );
}
// Le rendu serveur (tests) n'exécute pas d'effet de mise en page.
const useEffetLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;

// Un portrait = une pastille à initiales et — seulement s'il existe — la couleur de l'indicateur du candidat sur ce
// thème, en bordure. Le nom n'est pas écrit sous la pastille, mais il reste le nom accessible du bouton et s'affiche
// au survol. Le mot et le symbole de l'indicateur ne sont pas répétés sous chaque portrait (la légende, affichée en
// permanence au-dessus de la grille, les porte déjà pour les quatre niveaux) : la couleur n'est donc jamais la SEULE
// façon de connaître le niveau, seulement la façon la plus rapide une fois la légende lue. Tant qu'aucun candidat
// n'est sélectionné, chaque portrait affiche son nombre de mesures, comme un compteur de notifications. Le pied de
// carte garde toujours la même taille (rétractée), qu'un candidat soit ouvert ou non.
function Portrait({ ligne, ouvert, idDetail, onBasculer }: { ligne: LigneCandidat; ouvert: boolean; idDetail: string; onBasculer: () => void }) {
  const niveau = ligne.projection?.niveau ?? null;
  const { nom } = ligne.meta;
  const nombre = ligne.propositions.length;
  const precision = niveau ? ` — ${NIVEAUX[niveau].libelle}${ligne.projection?.incertain ? ", à préciser" : ""}` : "";
  const label = `${nom}${precision} : ${nombre} mesure${nombre > 1 ? "s" : ""} sur ce thème`;
  return (
    <li>
      <button
        type="button"
        className={`portrait${ouvert ? " portrait--ouvert" : ""}`}
        data-niveau={niveau ?? undefined}
        aria-expanded={ouvert}
        aria-controls={idDetail}
        aria-label={label}
        title={nom}
        onClick={onBasculer}
      >
        <Pastille slug={ligne.meta.slug} nom={nom} />
        <span className="portrait-compte" aria-hidden="true">
          {nombre}
        </span>
      </button>
    </li>
  );
}

// Questions propres à un thème : le visiteur les renseigne à son rythme, une fois le formulaire général validé. Chaque
// réponse s'applique tout de suite : l'indicateur des portraits de ce thème s'affine.
function QuestionsDuTheme({ theme, idTheme, questions, profil, onReponse }: { theme: string; idTheme: string; questions: ChampProfil[]; profil: ProfilPartiel; onReponse: SurReponse }) {
  const { repondues, total } = compterReponses(questions, profil);
  // Aucune question ordinaire (seulement des questions sensibles, sur accord) : pas de décompte « 0/0 ».
  const progression = total === 0 ? "(questions sensibles, facultatif)" : `(${repondues}/${total} réponse${repondues > 1 ? "s" : ""})`;
  return (
    <details className="questions-theme">
      <summary>
        Préciser ma situation pour ce thème <span className="progression">{progression}</span>
      </summary>
      <div className="questions-theme-corps" aria-label={`Questions sur le thème ${theme}`}>
        <SectionQuestions questions={questions} profil={profil} onReponse={onReponse} idPrefixe={`theme-${idTheme}`} />
      </div>
    </details>
  );
}

// `ouvertInitial` : candidat ouvert à l'arrivée (lien depuis le tableau de l'accueil) ; ensuite, au clic sur un portrait.
function CarteTheme({
  card,
  profil,
  questionsTheme,
  onReponse,
  ouvertInitial,
  masquerNonConcernes,
}: {
  card: CardTheme;
  profil: ProfilPartiel;
  // Questions propres à ce thème, à afficher seulement une fois le formulaire général validé ; [] sinon.
  questionsTheme: ChampProfil[];
  onReponse: SurReponse;
  ouvertInitial?: string;
  masquerNonConcernes: boolean;
}) {
  const { theme, absents, enCoursAnalyse } = card;
  // Option du visiteur : les candidats dont les mesures ne changent rien à sa situation (« non concerné ») sont retirés.
  const lignes = masquerNonConcernes ? card.lignes.filter((l) => l.projection?.niveau !== "non_concerne") : card.lignes;
  const nombreMasques = card.lignes.length - lignes.length;
  const [ouvert, setOuvert] = useState<string | null>(ouvertInitial ?? null);
  const ligneOuverte = lignes.find((l) => l.meta.slug === ouvert) ?? null;
  const idDetail = `detail-${theme.id}`;

  // Animations d'ouverture et de fermeture du candidat (désactivées si le visiteur demande de limiter les animations).
  // Ouverture : la pastille blanche qui entoure icône et libellé grandit à partir du seul médaillon. Elle est centrée,
  // donc son bord gauche — et le médaillon, posé contre ce bord — glisse vers la gauche, du centre à sa place finale ;
  // son ombre apparaît progressivement. Fermeture : le mouvement inverse (la pastille rétrécit, le médaillon revient au
  // centre) pendant que le corps de la carte s'estompe, puis seulement le candidat est refermé.
  const medaillon = useRef<HTMLDivElement>(null);
  const entete_ = useRef<HTMLElement>(null);
  const corps_ = useRef<HTMLDivElement>(null);
  const ouvertAvant = useRef(Boolean(ligneOuverte));
  const fermeture = useRef(false);
  // Vrai après une fermeture : le titre et la question du thème réapparaissent en fondu (pas au premier affichage).
  const [retour, setRetour] = useState(false);
  const OPTIONS_ANIMATION = { duration: 350, easing: "cubic-bezier(0.22, 1, 0.36, 1)" };
  const sansAnimation = () => typeof window === "undefined" || Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

  useEffetLayout(() => {
    const change = ouvertAvant.current !== Boolean(ligneOuverte);
    ouvertAvant.current = Boolean(ligneOuverte);
    const element = medaillon.current;
    const entete = entete_.current;
    if (!change || !ligneOuverte || !element || !entete || typeof entete.animate !== "function" || sansAnimation()) return;
    const ombre = getComputedStyle(entete).boxShadow;
    entete.animate(
      [
        { width: `${element.offsetWidth}px`, boxShadow: "0 0 0 0 rgba(0, 0, 0, 0)" },
        { width: `${entete.offsetWidth}px`, boxShadow: ombre },
      ],
      OPTIONS_ANIMATION,
    );
  }, [ligneOuverte]);

  function fermer() {
    const entete = entete_.current;
    const element = medaillon.current;
    const corps = corps_.current;
    if (!entete || !element || !corps || typeof entete.animate !== "function" || sansAnimation()) {
      setOuvert(null);
      return;
    }
    if (fermeture.current) return;
    fermeture.current = true;
    const options = { ...OPTIONS_ANIMATION, fill: "forwards" as FillMode };
    const pastille = entete.animate(
      [
        { width: `${entete.offsetWidth}px`, boxShadow: getComputedStyle(entete).boxShadow },
        { width: `${element.offsetWidth}px`, boxShadow: "0 0 0 0 rgba(0, 0, 0, 0)" },
      ],
      options,
    );
    const autres = [
      corps.animate([{ opacity: 1 }, { opacity: 0 }], { ...options, duration: 250 }),
      ...Array.from(entete.querySelectorAll("h2")).map((titre) => titre.animate([{ opacity: 1 }, { opacity: 0 }], { ...options, duration: 150 })),
    ];
    const terminer = () => {
      flushSync(() => {
        setOuvert(null);
        setRetour(true);
      });
      [pastille, ...autres].forEach((animation) => animation.cancel());
      fermeture.current = false;
    };
    pastille.finished.then(terminer, () => {
      fermeture.current = false;
    });
  }

  // Ouvrir un autre candidat remplace directement le détail ; cliquer sur le candidat ouvert le referme (avec animation).
  function basculer(slug: string) {
    if (ouvert === slug) {
      fermer();
      return;
    }
    if (ouvert === null && !sansAnimation()) {
      // Le titre et la question, sur le point de disparaître de leur place, s'estompent au lieu de s'éclipser.
      const entete = entete_.current;
      if (entete) entete.querySelectorAll<HTMLElement>(":scope > h2, :scope > .question-theme").forEach(estomper);
    }
    setRetour(false);
    setOuvert(slug);
  }
  // Carte de hauteur fixe : en-tête (thème), corps défilant qui accueille le texte du candidat choisi, pied avec les
  // portraits. Ouvrir un candidat ne change pas la taille de la carte ni la mise en page de la grille.
  return (
    <article className={`carte${ligneOuverte ? " carte--ouvert" : ""}`} id={`theme-${theme.id}`} aria-labelledby={`titre-${theme.id}`}>
      {/* Candidat ouvert : le médaillon rejoint le titre sur une ligne, pour laisser la place au texte du candidat. */}
      <header className={`carte-entete${ligneOuverte ? " carte-entete--ouvert" : ""}${retour && !ligneOuverte ? " carte-entete--retour" : ""}`} ref={entete_}>
        <div className="medaillon" aria-hidden="true" ref={medaillon}>
          <IconeTheme themeId={theme.id} taille={24} />
        </div>
        <h2 id={`titre-${theme.id}`}>{theme.libelle}</h2>
        {!ligneOuverte && (
          <p className="question-theme">
            {theme.sujets?.length ? `Sujets abordés : ${theme.sujets.join(", ")}.` : theme.question_citoyen}
          </p>
        )}
      </header>

      <div className={`carte-corps${ligneOuverte ? " carte-corps--detail" : ""}`} ref={corps_}>
        {enCoursAnalyse ? (
          <p className="hint">Ce thème est en cours d'analyse : aucun programme n'a encore été analysé sur ce sujet.</p>
        ) : (
          <>
            {ligneOuverte ? (
              <DetailCandidat ligne={ligneOuverte} profil={profil} id={idDetail} onFermer={fermer} />
            ) : (
              <>
                {lignes.length > 0 && <FluxCandidats key={lignes.map((l) => l.meta.slug).join("|")} lignes={lignes} />}
                {questionsTheme.length > 0 && <QuestionsDuTheme theme={theme.libelle} idTheme={theme.id} questions={questionsTheme} profil={profil} onReponse={onReponse} />}
                {/* Les portraits, toujours visibles en pied de carte ,
                    suffisent à inviter au clic : pas besoin de le répéter ici. */}
                {lignes.length === 0 && (
                  <p className="hint carte-invite">Aucun candidat ne change votre situation sur ce thème, d'après vos réponses.</p>
                )}
              </>
            )}
          </>
        )}
      </div>

      {!enCoursAnalyse && (
        <footer className="carte-pied">
          <ul className="portraits" aria-label={`Candidats, thème ${theme.libelle}`}>
            {lignes.map((ligne) => (
              <Portrait
                key={ligne.meta.slug}
                ligne={ligne}
                ouvert={ouvert === ligne.meta.slug}
                idDetail={idDetail}
                onBasculer={() => basculer(ligne.meta.slug)}
              />
            ))}
            {nombreMasques > 0 && (
              <li className="portraits-masques">
                {nombreMasques} non concerné{nombreMasques > 1 ? "s" : ""} masqué{nombreMasques > 1 ? "s" : ""}
              </li>
            )}
            {/* Candidats sans mesure sur ce thème : nommés, jamais omis en silence — en fin de liste, en pile estompée,
                non cliquables. */}
            {absents.length > 0 && (
              <li className="pile-absents">
                <ul aria-label={`Candidats sans mesure sur le thème ${theme.libelle}`}>
                  {absents.map((meta) => (
                    <li key={meta.slug}>
                      <Pastille slug={meta.slug} nom={meta.nom} className="pastille--absent" libelle={`${meta.nom} : aucune mesure sur ce thème`} />
                    </li>
                  ))}
                </ul>
              </li>
            )}
          </ul>
        </footer>
      )}
    </article>
  );
}

interface VueThemesProps {
  cards: CardTheme[];
  profil: ProfilPartiel;
  // Vrai après validation du formulaire général ET dès que le visiteur a donné une information : c'est alors seulement
  // que les indicateurs (les couleurs autour des portraits) existent.
  personnalise: boolean;
  questionnaire: Questionnaire;
  // Vrai après validation du formulaire général : les questions propres à chaque thème deviennent disponibles.
  questionsActives: boolean;
  onReponse: SurReponse;
  ouvertInitial?: { theme: string; candidat: string };
}

export function VueThemes({ cards, profil, personnalise, questionnaire, questionsActives, onReponse, ouvertInitial }: VueThemesProps) {
  const [masquer, setMasquer] = useState(true);
  const masquerNonConcernes = personnalise && masquer;
  return (
    <section className="themes">
      {personnalise && (
        <div className="legende">
          <div className="legende-entete">
            <Info size={20} aria-hidden="true" focusable="false" />
            <p className="legende-titre">Comment lire les indicateurs</p>
          </div>
          <p className="legende-intro">
            Pour chaque thème, l'indicateur dit ce que deviendrait votre situation si les mesures du candidat sur ce
            thème s'appliquaient. Il est calculé par des règles explicites, à partir de vos réponses et des mesures
            sourcées, et il n'existe pas de score global. Plus vous répondez, plus il s'affine.
          </p>
          <dl>
            {ORDRE_LEGENDE.map((niveau) => (
              <div key={niveau} data-niveau={niveau}>
                <dt>
                  <BadgeNiveau niveau={niveau} />
                </dt>
                <dd>
                  {NIVEAUX[niveau].sens}
                  {/* Même niveau, pas un cinquième : « à préciser » n'est qu'une mention posée sur « mixte ». */}
                  {niveau === "mixte" && (
                    <span className="legende-precision">
                      <span className="a-preciser">à préciser</span> : quand nous ne savons pas encore si les mesures vous
                      concernent, l'indicateur est « mixte » par prudence. Répondre aux questions du thème permet de le
                      préciser.
                    </span>
                  )}
                </dd>
              </div>
            ))}            <div>
              <dt>
                <span className="sans-badge">Pas d'indicateur</span>
              </dt>
              <dd>
                Les mesures ou vos réponses ne permettent pas de conclure. Nous préférons ne rien afficher plutôt qu'un
                indicateur douteux.
              </dd>
            </div>
          </dl>
        </div>
      )}

      {/* Juste au-dessus des cartes, à droite. */}
      {personnalise && (
        <div className="themes-outils">
          <label className="interrupteur">
            <input type="checkbox" role="switch" checked={masquer} onChange={(e) => setMasquer(e.target.checked)} />
            <span className="interrupteur-piste" aria-hidden="true" />
            Masquer les candidats dont les mesures ne changent rien à ma situation
          </label>
        </div>
      )}

      <div className="grille-themes">
        {cards.map((card) => (
          <CarteTheme
            key={card.theme.id}
            card={card}
            profil={profil}
            questionsTheme={questionsActives ? questionsDuTheme(questionnaire, card.theme.id) : []}
            onReponse={onReponse}
            ouvertInitial={ouvertInitial?.theme === card.theme.id ? ouvertInitial.candidat : undefined}
            masquerNonConcernes={masquerNonConcernes}
          />
        ))}
      </div>
    </section>
  );
}
