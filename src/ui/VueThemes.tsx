import { useState } from "react";
import { libelleCitation } from "../citations";
import { evaluerProposition } from "../engine";
import type { NiveauProjection } from "../engine/projection";
import { compterReponses, questionsDuTheme, type Questionnaire } from "../questionnaire";
import type { ProfilPartiel } from "../profil";
import type { ChampProfil, Proposition } from "../types";
import type { CardTheme, LigneCandidat } from "./cards";
import { initiales } from "./portrait";
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

function MesureAnalysee({ proposition, profil }: { proposition: Proposition; profil: ProfilPartiel }) {
  // Une règle propre à une mesure ne s'applique que si le visiteur a répondu aux questions dont elle dépend
  // (voir evaluerProposition) : sinon explication générale, jamais « non concerné » sur une réponse manquante.
  const impact = evaluerProposition(profil, proposition);
  return (
    <li>
      <strong>{proposition.titre}</strong>
      {proposition.statut === "partiel" && <span className="badge-partiel"> (sourcing partiel — à confirmer)</span>}
      {proposition.sous_theme && <span className="sous-theme"> — rubrique « {proposition.sous_theme} » de la source</span>}
      {impact.explication !== proposition.titre && <p>{impact.explication}</p>}
      {impact.niveau === "chiffre_personnalise" && impact.montant_estime !== undefined && (
        <p>Estimation pour votre profil : {impact.montant_estime} €/an</p>
      )}
      {!impact.concerne && (
        <p>
          <em>Cette mesure ne s'applique pas à votre profil.</em>
        </p>
      )}
      <p className="sources">
        Sources :{" "}
        <ListeSources sources={proposition.sources.map((s) => ({ texte: libelleCitation(s), url: s.url }))} />
      </p>
    </li>
  );
}

// Le détail d'un candidat sur un thème, ouvert depuis son portrait : programme d'abord (synthèse, sources, mesures),
// puis — seulement si le visiteur a donné des informations — ce que cela change pour lui.
function DetailCandidat({ ligne, profil, id }: { ligne: LigneCandidat; profil: ProfilPartiel; id: string }) {
  const { meta, projection, synthese, sources, messagesSansBadge, messagesIncertitude, messagesEffetsExclus, propositions } = ligne;
  const niveau = projection?.niveau ?? null;

  return (
    <div className="detail" id={id} role="region" aria-label={`Détail : ${meta.nom}`}>
      <h3 className="detail-titre">{meta.nom}</h3>
      {synthese ? (
        <>
          <p className="synthese">{synthese.texte}</p>
          <p className="sources-citees">
            Sources : <ListeSources sources={sources} />
          </p>
        </>
      ) : (
        <p className="hint">
          Aucun résumé n'est disponible pour ce candidat sur ce thème : le détail sourcé des mesures est ci-dessous.
        </p>
      )}

      {projection &&
        (niveau ? (
          <>
            <p className="pour-votre-profil">
              <strong>Pour votre profil :</strong> {NIVEAUX[niveau].sens}
            </p>
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

      <details className="mesures">
        <summary>Mesures analysées ({propositions.length})</summary>
        <ul>
          {propositions.map((proposition) => (
            <MesureAnalysee key={proposition.id} proposition={proposition} profil={profil} />
          ))}
        </ul>
      </details>
    </div>
  );
}

// Un portrait = une pastille à initiales, le nom, et — seulement s'il existe — l'indicateur du candidat sur ce thème.
function Portrait({ ligne, ouvert, idDetail, onBasculer }: { ligne: LigneCandidat; ouvert: boolean; idDetail: string; onBasculer: () => void }) {
  const niveau = ligne.projection?.niveau ?? null;
  return (
    <li>
      <button
        type="button"
        className={`portrait${ouvert ? " portrait--ouvert" : ""}`}
        data-niveau={niveau ?? undefined}
        aria-expanded={ouvert}
        aria-controls={idDetail}
        onClick={onBasculer}
      >
        <span className="pastille" aria-hidden="true">
          {initiales(ligne.meta.nom)}
        </span>
        <span className="portrait-nom">{ligne.meta.nom}</span>
        {niveau && <BadgeNiveau niveau={niveau} />}
        {ligne.projection?.incertain && <span className="a-preciser">à préciser</span>}
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

// `ouvertInitial` sert aux tests (rendu statique) : à l'écran, le détail s'ouvre au clic sur un portrait.
function CarteTheme({
  card,
  profil,
  questionsTheme,
  onReponse,
  ouvertInitial,
}: {
  card: CardTheme;
  profil: ProfilPartiel;
  // Questions propres à ce thème, à afficher seulement une fois le formulaire général validé ; [] sinon.
  questionsTheme: ChampProfil[];
  onReponse: SurReponse;
  ouvertInitial?: string;
}) {
  const { theme, lignes, absents, enCoursAnalyse } = card;
  const [ouvert, setOuvert] = useState<string | null>(ouvertInitial ?? null);
  const ligneOuverte = lignes.find((l) => l.meta.slug === ouvert) ?? null;
  const idDetail = `detail-${theme.id}`;

  return (
    <section className="carte" id={`theme-${theme.id}`} aria-labelledby={`titre-${theme.id}`}>
      <h2 id={`titre-${theme.id}`}>{theme.libelle}</h2>
      <p className="question">{theme.question_citoyen}</p>

      {questionsTheme.length > 0 && <QuestionsDuTheme theme={theme.libelle} idTheme={theme.id} questions={questionsTheme} profil={profil} onReponse={onReponse} />}

      {enCoursAnalyse ? (
        <p className="hint">Ce thème est en cours d'analyse : aucun programme n'a encore été analysé sur ce sujet.</p>
      ) : (
        <>
          <ul className="portraits" aria-label={`Candidats sur le thème ${theme.libelle}`}>
            {lignes.map((ligne) => (
              <Portrait
                key={ligne.meta.slug}
                ligne={ligne}
                ouvert={ouvert === ligne.meta.slug}
                idDetail={idDetail}
                onBasculer={() => setOuvert(ouvert === ligne.meta.slug ? null : ligne.meta.slug)}
              />
            ))}
          </ul>
          {ligneOuverte && <DetailCandidat ligne={ligneOuverte} profil={profil} id={idDetail} />}
        </>
      )}

      {!enCoursAnalyse && absents.length > 0 && (
        <p className="absents">Aucune mesure analysée sur ce thème : {absents.map((m) => m.nom).join(", ")}.</p>
      )}
    </section>
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
  return (
    <section className="themes">
      {personnalise && (
        <details className="legende">
          <summary>Comment lire les indicateurs</summary>
          <p>
            Pour chaque thème, l'indicateur dit ce que deviendrait votre situation si les mesures du candidat sur ce
            thème s'appliquaient. Il est calculé par des règles explicites, à partir de vos réponses et des mesures
            sourcées, et il n'existe pas de score global. Plus vous répondez, plus il s'affine.
          </p>
          <dl>
            {ORDRE_LEGENDE.map((niveau) => (
              <div key={niveau}>
                <dt>
                  <BadgeNiveau niveau={niveau} />
                </dt>
                <dd>{NIVEAUX[niveau].sens}</dd>
              </div>
            ))}
            <div>
              <dt>
                <BadgeNiveau niveau="mixte" /> <span className="a-preciser">à préciser</span>
              </dt>
              <dd>
                Quand nous ne savons pas encore si les mesures vous concernent, l'indicateur est « mixte » par prudence :
                répondre aux questions du thème permet de le préciser.
              </dd>
            </div>
            <div>
              <dt>
                <span className="sans-badge">Pas d'indicateur</span>
              </dt>
              <dd>
                Les mesures ou vos réponses ne permettent pas de conclure. Nous préférons ne rien afficher plutôt qu'un
                indicateur douteux.
              </dd>
            </div>
          </dl>
        </details>
      )}

      <nav aria-label="Thèmes">
        <ul className="reperes">
          {cards.map(({ theme }) => (
            <li key={theme.id}>
              <a href={`#theme-${theme.id}`}>{theme.libelle}</a>
            </li>
          ))}
        </ul>
      </nav>

      {cards.map((card) => (
        <CarteTheme
          key={card.theme.id}
          card={card}
          profil={profil}
          questionsTheme={questionsActives ? questionsDuTheme(questionnaire, card.theme.id) : []}
          onReponse={onReponse}
          ouvertInitial={ouvertInitial?.theme === card.theme.id ? ouvertInitial.candidat : undefined}
        />
      ))}
    </section>
  );
}
