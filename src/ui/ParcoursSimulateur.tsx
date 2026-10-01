import { ArrowLeft, ArrowRight, Calculator, Compass, EyeOff, RotateCcw, UserRound, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { ProfilPartiel } from "../profil";
import { estRepondue, questionsVisibles, type Questionnaire } from "../questionnaire";
import type { ChampProfil } from "../types";
import { SUJETS_CONVICTION, trouverPosition, trouverSujet } from "../positions";
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
const ICONES_ETAPES: Record<Etape, LucideIcon> = { situation: UserRound, convictions: Compass, themes: EyeOff, resultat: Calculator };
export function IntroEtape({ etape, children }: { etape: Etape; children: ReactNode }) {
  const Icone = ICONES_ETAPES[etape];
  return (
    <div className="intro-etape">
      <Icone size={28} aria-hidden="true" focusable="false" />
      <p>{children}</p>
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
export function NavEtape({ precedent, suivant, haut = false }: { precedent?: { libelle: string; onClick: () => void }; suivant?: { libelle: string; onClick: () => void }; haut?: boolean }) {
  return (
    <div className={`nav-etape${haut ? " nav-etape--haut" : ""}`}>
      {precedent && (
        <button type="button" className="secondaire" onClick={precedent.onClick}>
          <ArrowLeft size={18} aria-hidden="true" focusable="false" />
          {precedent.libelle}
        </button>
      )}
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
function compteurs(questionnaire: Questionnaire, profil: ProfilPartiel, convictions: Convictions) {
  const questions = [...new Map([...questionnaire.generales, ...questionnaire.parTheme.flatMap((s) => s.questions)].map((q) => [q.id, q])).values()];
  const visibles = questionsVisibles(questions, profil);
  return {
    visibles,
    repondues: visibles.filter((q) => estRepondue(q, profil)).length,
    questions: visibles.length,
    convictions: Object.keys(convictions.positions).length,
    sujets: SUJETS_CONVICTION.length,
  };
}

// Message placé en tête du résultat : sur quoi repose le calcul, et à quel point les réponses le rendent précis.
export function BandeauPertinence({ questionnaire, profil, convictions }: { questionnaire: Questionnaire; profil: ProfilPartiel; convictions: Convictions }) {
  const n = compteurs(questionnaire, profil, convictions);
  return (
    <IntroEtape etape="resultat">
      <strong>Objectif :</strong> trouver le candidat dont le programme convient le mieux à sa situation et à ses convictions. Calcul fondé sur les réponses données : plus de réponses, et plus précises = résultat plus pertinent.{" "}
      <strong>
        {n.repondues} question{n.repondues > 1 ? "s" : ""} répondue{n.repondues > 1 ? "s" : ""} sur {n.questions}
      </strong>{" "}
      ·{" "}
      <strong>
        {n.convictions} conviction{n.convictions > 1 ? "s" : ""} complétée{n.convictions > 1 ? "s" : ""} sur {n.sujets}
      </strong>
      .
    </IntroEtape>
  );
}

// Rappel des réponses : tout ce qui a été demandé, avec « Non répondu » pour ce qui est resté en « Je préfère ne pas répondre ».
// Le bouton rouvre le parcours (réponses gardées) pour corriger ou compléter.
export function RecapReponses({ questionnaire, profil, convictions, onRecommencer }: { questionnaire: Questionnaire; profil: ProfilPartiel; convictions: Convictions; onRecommencer: () => void }) {
  const { visibles, repondues, questions } = compteurs(questionnaire, profil, convictions);
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
              {convictions.exemplarite && <li>Candidat sans condamnation définitive</li>}
            </ul>
          ) : (
            <p className="recap-vide">Aucune position choisie.</p>
          )}
        </div>
      </div>
    </section>
  );
}
