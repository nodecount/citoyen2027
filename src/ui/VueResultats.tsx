import { libelleCitation } from "../citations";
import { evaluerProposition } from "../engine";
import type { NiveauProjection } from "../engine/projection";
import type { Profil, Proposition } from "../types";
import type { CardTheme, LigneCandidat } from "./cards";
import { NIVEAUX, decrireEffet } from "./projection";

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

function MesureAnalysee({ proposition, profil }: { proposition: Proposition; profil: Profil }) {
  const impact = evaluerProposition(profil, proposition);
  return (
    <li>
      <strong>{proposition.titre}</strong>
      {proposition.statut === "partiel" && <span className="badge-partiel"> (sourcing partiel — à confirmer)</span>}
      <p>{impact.explication}</p>
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

function CandidatDansTheme({ ligne, profil }: { ligne: LigneCandidat; profil: Profil }) {
  const { meta, projection, synthese, sources, messagesSansBadge, propositions } = ligne;
  const niveau = projection.niveau;

  return (
    <li>
      <details className="candidat">
        <summary className="candidat-resume">
          <span className="candidat-nom">{meta.nom}</span>
          {niveau ? <BadgeNiveau niveau={niveau} /> : <span className="sans-badge">Pas de projection</span>}
        </summary>

        <div className="candidat-corps">
          {synthese ? (
            <>
              <p className="synthese">{synthese.texte}</p>
              <p className="sources-citees">
                Sources : <ListeSources sources={sources} />
              </p>
            </>
          ) : (
            <p className="hint">
              Le résumé de ce programme sur ce thème n'est pas encore rédigé : le détail sourcé des mesures est
              ci-dessous.
            </p>
          )}

          {niveau ? (
            <p className="pour-votre-profil">
              <strong>Pour votre profil :</strong> {NIVEAUX[niveau].sens}
            </p>
          ) : (
            messagesSansBadge.map((message) => (
              <p className="pour-votre-profil" key={message}>
                {message}
              </p>
            ))
          )}

          {projection.effetsRetenus.length > 0 && (
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
      </details>
    </li>
  );
}

function CarteTheme({ card, profil }: { card: CardTheme; profil: Profil }) {
  const { theme, lignes, absents, enCoursAnalyse } = card;
  return (
    <section className="carte" id={`theme-${theme.id}`} aria-labelledby={`titre-${theme.id}`}>
      <h2 id={`titre-${theme.id}`}>{theme.libelle}</h2>
      <p className="question">{theme.question_citoyen}</p>

      {enCoursAnalyse ? (
        <p className="hint">Ce thème est en cours d'analyse : aucun programme n'a encore été analysé sur ce sujet.</p>
      ) : (
        <ul className="candidats">
          {lignes.map((ligne) => (
            <CandidatDansTheme key={ligne.meta.slug} ligne={ligne} profil={profil} />
          ))}
        </ul>
      )}

      {!enCoursAnalyse && absents.length > 0 && (
        <p className="absents">Aucune mesure analysée sur ce thème : {absents.map((m) => m.nom).join(", ")}.</p>
      )}
    </section>
  );
}

export function VueResultats({ cards, profil, avertissement }: { cards: CardTheme[]; profil: Profil; avertissement: string }) {
  return (
    <section className="resultats">
      <h1>Vos résultats</h1>
      <p className="avertissement">{avertissement}</p>

      <details className="legende">
        <summary>Comment lire les indicateurs</summary>
        <p>
          Pour chaque thème, l'indicateur dit ce que deviendrait votre situation si les mesures du candidat sur ce
          thème s'appliquaient. Il est calculé par des règles explicites, à partir de votre profil et des mesures
          sourcées, et il n'existe pas de score global.
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
              <span className="sans-badge">Pas de projection</span>
            </dt>
            <dd>
              Le programme ne permet pas de conclure pour votre profil. Nous préférons ne rien afficher plutôt qu'un
              indicateur douteux.
            </dd>
          </div>
        </dl>
      </details>

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
        <CarteTheme key={card.theme.id} card={card} profil={profil} />
      ))}
    </section>
  );
}
