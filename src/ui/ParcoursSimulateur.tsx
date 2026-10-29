import { ArrowLeft, Compass, EyeOff, Target, UserRound, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { ProfilPartiel } from "../profil";
import { compterReponses, type Questionnaire } from "../questionnaire";

// Le simulateur est un tableau de bord à trois blocs (situation, suggestion, convictions). Trois vues de travail s'ouvrent en
// pleine largeur depuis lui : les questions de situation, les mesures adaptées à cette situation (candidats anonymisés, thème par
// thème : elles ne dépendent QUE de la situation) et les convictions. « zones » est le tableau de bord lui-même.
export type Vue = "zones" | "situation" | "themes" | "convictions";

// Texte d'introduction de chaque vue de travail : toujours le même bloc (icône + une ou deux phrases, corps de texte lisible),
// jamais une autre mise en forme d'une vue à l'autre.
const ICONES_VUES: Record<Exclude<Vue, "zones">, LucideIcon> = { situation: UserRound, convictions: Compass, themes: Target };
export function IntroEtape({ etape, children }: { etape: Exclude<Vue, "zones">; children: ReactNode }) {
  const Icone = ICONES_VUES[etape];
  return (
    <div className="intro-etape">
      <Icone size={28} aria-hidden="true" focusable="false" />
      <div className="intro-texte">{children}</div>
    </div>
  );
}

// Retour au tableau de bord, en haut ET en bas de chaque vue de travail : jamais besoin de défiler pour revenir.
export function BarreRetour({ onRetour, haut = false }: { onRetour: () => void; haut?: boolean }) {
  return (
    <div className={`barre-retour${haut ? " barre-retour--haut" : ""}`}>
      <button type="button" className="secondaire" onClick={onRetour}>
        <ArrowLeft size={18} aria-hidden="true" focusable="false" />
        Retour à mon candidat idéal
      </button>
    </div>
  );
}

// Introduction de la vue « mesures adaptées » : l'objectif, puis ce dont dépend la fiabilité de l'estimation (qualité et
// nombre des réponses données), avec le décompte et, tant que tout n'est pas répondu, un bouton pour retourner compléter.
export function IntroMesures({ questionnaire, profil, onCompleter }: { questionnaire: Questionnaire; profil: ProfilPartiel; onCompleter: () => void }) {
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
