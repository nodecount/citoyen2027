import { ArrowLeft, ArrowRight, Calculator, Compass, Eraser, EyeOff, RotateCcw, Target, UserRound, type LucideIcon } from "lucide-react";
import { useContext, type ReactNode } from "react";
import type { ProfilPartiel } from "../profil";
import { compterReponses, estRepondue, questionsVisibles, type Questionnaire } from "../questionnaire";
import type { ChampProfil, Proposition } from "../types";
import { trouverPosition, trouverSujet } from "../positions";
import { sujetsDisponibles } from "../engine/positions";
import { PropositionsBase } from "./PropositionsContexte";
import { aDesConvictions, type Convictions } from "./memoireConvictions";
import { libelleOption } from "./Questions";

// Le simulateur est un parcours en quatre écrans : la situation, les mesures adaptées à cette situation (candidats anonymisés,
// thème par thème : ils ne dépendent QUE de la situation), les convictions, puis le candidat idéal face aux deux (card et
// rappel des réponses).
export type Etape = "situation" | "themes" | "convictions" | "resultat";

const ETAPES: Array<{ id: Etape; libelle: string }> = [
  { id: "situation", libelle: "Ma situation" },
  { id: "themes", libelle: "Mesures adaptées à ma situation" },
  { id: "convictions", libelle: "Mes convictions" },
  { id: "resultat", libelle: "Candidat idéal face à ma situation et mes convictions" },
];

// Texte d'introduction de chaque écran du parcours : toujours le même bloc (icône + une ou deux phrases, corps de texte lisible),
// jamais une autre mise en forme d'un écran à l'autre.
const ICONES_ETAPES: Record<Etape, LucideIcon> = { situation: UserRound, convictions: Compass, themes: Target, resultat: Calculator };
export function IntroEtape({ etape, children }: { etape: Etape; children: ReactNode }) {
  const Icone = ICONES_ETAPES[etape];
  return (
    <div className="intro-etape">
      <Icone size={28} aria-hidden="true" focusable="false" />
      <div className="intro-texte">{children}</div>
    </div>
  );
}

// Indicateur d'étapes : on peut revenir à toute étape ; les thèmes et le résultat ne sont accessibles qu'une fois des informations données.
export function Etapes({ etape, onAller, resultatAccessible }: { etape: Etape; onAller: (e: Etape) => void; resultatAccessible: boolean }) {
  return (
    <ol className="etapes" aria-label="Étapes du simulateur">
      {ETAPES.map(({ id, libelle }, i) => (
        <li key={id}>
          <button type="button" className="etape" aria-current={etape === id ? "step" : undefined} disabled={(id === "themes" || id === "resultat") && !resultatAccessible} onClick={() => onAller(id)}>
            <span className="etape-numero" aria-hidden="true">
              {i + 1}
            </span>
            {libelle}
          </button>
        </li>
      ))}
    </ol>
  );
}

// Boutons de bas d'écran : retour à l'étape précédente, passage à la suivante.
// `milieu` : un bouton placé AU MILIEU des deux (par exemple « Effacer mes réponses » en bas des étapes 1 et 3).
export function NavEtape({ precedent, suivant, haut = false, milieu }: { precedent?: { libelle: string; onClick: () => void }; suivant?: { libelle: string; onClick: () => void }; haut?: boolean; milieu?: { libelle: string; onClick: () => void } }) {
  return (
    <div className={`nav-etape${haut ? " nav-etape--haut" : ""}${milieu ? " nav-etape--milieu" : ""}`}>
      {milieu && !precedent && <span aria-hidden="true" />}
      {precedent && (
        <button type="button" className="secondaire" onClick={precedent.onClick}>
          <ArrowLeft size={18} aria-hidden="true" focusable="false" />
          {precedent.libelle}
        </button>
      )}
      {milieu && (
        <button type="button" className="bouton-effacer" onClick={milieu.onClick}>
          <Eraser size={18} aria-hidden="true" focusable="false" />
          {milieu.libelle}
        </button>
      )}
      {milieu && !suivant && <span aria-hidden="true" />}
      {suivant && (
        <button type="button" onClick={suivant.onClick}>
          {suivant.libelle}
          <ArrowRight size={18} aria-hidden="true" focusable="false" />
        </button>
      )}
    </div>
  );
}

function reponseEnClair(champ: ChampProfil, valeur: ProfilPartiel[string]): string {
  if (Array.isArray(valeur)) return valeur.map((v) => libelleOption(champ, String(v))).join(", ");
  return libelleOption(champ, String(valeur));
}

// Nombres qui fondent le calcul du programme idéal : questions répondues (parmi celles actuellement posées) et sujets
// de convictions renseignés.
function compteurs(questionnaire: Questionnaire, profil: ProfilPartiel, convictions: Convictions, propositions: Proposition[] | null) {
  const sujets = sujetsDisponibles(propositions);
  const questions = [...new Map([...questionnaire.generales, ...questionnaire.parTheme.flatMap((s) => s.questions)].map((q) => [q.id, q])).values()];
  const visibles = questionsVisibles(questions, profil);
  return {
    visibles,
    repondues: visibles.filter((q) => estRepondue(q, profil)).length,
    questions: visibles.length,
    convictions: sujets.filter((s) => convictions.positions[s.id] !== undefined).length,
    sujets: sujets.length,
  };
}

// Message placé en tête du résultat : sur quoi repose le calcul, et à quel point les réponses le rendent précis.
export function BandeauPertinence({ questionnaire, profil, convictions, onCompleterSituation, onCompleterConvictions }: { questionnaire: Questionnaire; profil: ProfilPartiel; convictions: Convictions; onCompleterSituation?: () => void; onCompleterConvictions?: () => void }) {
  const n = compteurs(questionnaire, profil, convictions, useContext(PropositionsBase));
  return (
    <IntroEtape etape="resultat">
      <p>
        <strong>Objectif :</strong> trouver le candidat dont le programme convient le mieux à sa situation et à ses convictions.
      </p>
      <p>Nous calculons ce résultat à partir de vos réponses : plus elles sont nombreuses et précises, plus il est pertinent.</p>
      <div className="intro-decomptes">
        <p className="intro-decompte">
          <strong>
            {n.repondues} question{n.repondues > 1 ? "s" : ""} répondue{n.repondues > 1 ? "s" : ""} sur {n.questions}
          </strong>
          {n.repondues < n.questions && onCompleterSituation && (
            <button type="button" className="secondaire bouton-completer bouton-completer--ligne" onClick={onCompleterSituation}>
              <ArrowLeft size={18} aria-hidden="true" focusable="false" />
              Compléter ma situation
            </button>
          )}
        </p>
        <p className="intro-decompte">
          <strong>
            {n.convictions} conviction{n.convictions > 1 ? "s" : ""} complétée{n.convictions > 1 ? "s" : ""} sur {n.sujets}
          </strong>
          {n.convictions < n.sujets && onCompleterConvictions && (
            <button type="button" className="secondaire bouton-completer bouton-completer--ligne" onClick={onCompleterConvictions}>
              <ArrowLeft size={18} aria-hidden="true" focusable="false" />
              Compléter mes convictions
            </button>
          )}
        </p>
      </div>
    </IntroEtape>
  );
}

// Introduction de l'écran « mesures adaptées » : l'objectif, puis ce dont dépend la fiabilité de l'estimation (qualité et
// nombre des réponses données), avec le décompte et, tant que tout n'est pas répondu, un bouton pour retourner compléter.
export function IntroMesures({ questionnaire, profil, convictions, onCompleter }: { questionnaire: Questionnaire; profil: ProfilPartiel; convictions: Convictions; onCompleter: () => void }) {
  // Même décompte que l'en-tête de « Ma situation » (questions générales), pour ne pas afficher deux totaux différents.
  const { repondues, total: questions } = compterReponses(questionnaire.generales, profil);
  const complet = questions > 0 && repondues >= questions;
  return (
    <IntroEtape etape="themes">
      <p>
        <strong>Objectif :</strong> repérer, thème par thème, les mesures qui touchent sa situation, et leur effet.
      </p>
      <p>
        L'estimation est d'autant plus fiable que vos réponses sont nombreuses et précises. Vous avez donné{" "}
        <strong>
          {repondues} réponse{repondues > 1 ? "s" : ""} sur {questions}
        </strong>
        .
        {!complet && " Nous vous conseillons de compléter votre situation pour obtenir une estimation plus fiable."}
        {!complet && (
          <>
            <br />
            <button type="button" className="secondaire bouton-completer" onClick={onCompleter}>
              <ArrowLeft size={18} aria-hidden="true" focusable="false" />
              Compléter ma situation
            </button>
          </>
        )}
      </p>
      <p className="intro-ligne-icone">
        <EyeOff size={22} aria-hidden="true" focusable="false" />
        <span>
          Nous <strong>masquons</strong> le nom des candidats pour éviter les biais : chaque candidat garde la même lettre (A, B…) d'un thème à l'autre.
        </span>
      </p>
    </IntroEtape>
  );
}

// Rappel des réponses : tout ce qui a été demandé, avec « Non répondu » pour ce qui est resté en « Je préfère ne pas répondre ».
// Le bouton rouvre le parcours (réponses gardées) pour corriger ou compléter.
export function RecapReponses({ questionnaire, profil, convictions, onRecommencer }: { questionnaire: Questionnaire; profil: ProfilPartiel; convictions: Convictions; onRecommencer: () => void }) {
  const { visibles, repondues, questions } = compteurs(questionnaire, profil, convictions, useContext(PropositionsBase));
  const sansReponse = questions - repondues;
  return (
    <section className="recap-reponses" aria-labelledby="recap-titre">
      <div className="recap-entete">
        <h2 id="recap-titre">Mes réponses</h2>
        <button type="button" onClick={onRecommencer}>
          <RotateCcw size={18} aria-hidden="true" focusable="false" />
          Recommencer pour corriger ou compléter
        </button>
      </div>
      <p>
        {sansReponse === 0 ? "Toutes les questions ont une réponse." : `${sansReponse} question${sansReponse > 1 ? "s" : ""} sans réponse : vous pouvez y répondre en recommençant.`} Vos réponses sont gardées.
      </p>
      <div className="recap-colonnes">
        <div>
          <h3>Ma situation</h3>
          <dl className="recap-liste">
            {visibles.map((q) => (
              <div key={q.id}>
                <dt>{q.label}</dt>
                {estRepondue(q, profil) ? <dd>{reponseEnClair(q, profil[q.id])}</dd> : <dd className="recap-vide">Non répondu</dd>}
              </div>
            ))}
          </dl>
        </div>
        <div>
          <h3>Mes convictions</h3>
          {aDesConvictions(convictions) ? (
            <ul className="recap-convictions">
              {Object.entries(convictions.positions).map(([sujet, position]) => (
                <li key={sujet}>
                  {trouverSujet(sujet)?.libelle} : <strong>{trouverPosition(sujet, position)?.libelle}</strong>
                </li>
              ))}
              {convictions.exemplarite && <li>Candidat sans condamnation</li>}
            </ul>
          ) : (
            <p className="recap-vide">Aucune position choisie.</p>
          )}
        </div>
      </div>
    </section>
  );
}
