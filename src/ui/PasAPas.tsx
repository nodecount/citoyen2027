import { ArrowLeft, ArrowRight, Check, Eraser, ListChecks } from "lucide-react";
import { useContext, useState } from "react";
import { compterMesuresImpactees } from "../engine/mesuresImpactees";
import type { ProfilPartiel } from "../profil";
import { estRepondue } from "../questionnaire";
import type { ChampProfil } from "../types";
import { FermerContexte, RetourIntroContexte } from "./ModaleTravail";
import { PropositionsBase } from "./PropositionsContexte";
import { libelleOption } from "./Questions";
import "./pasAPas.css";

// Une question de la file : générale (posée une seule fois) ou propre à un thème (le libellé du thème est alors rappelé).
export interface EtapeQuestion {
  champ: ChampProfil;
  theme?: string;
}

interface PasAPasProps {
  // File des questions actuellement visibles, générales d'abord puis par thème (les conditionnelles n'y sont que si leur condition est remplie).
  etapes: EtapeQuestion[];
  profil: ProfilPartiel;
  onReponse: (etape: EtapeQuestion, brut: string | string[]) => void;
  // Quitte le pas à pas pour la grille de toutes les questions.
  onToutVoir: () => void;
  // Ce que l'on pose : « Question » (situation) ou « Sujet » (convictions), et son pluriel.
  nom?: string;
  pluriel?: string;
  // Phrase sous la réponse (nombre de mesures concernées) ; par défaut, celle des questions de situation. null : rien.
  impact?: (etape: EtapeQuestion, valeur: string | string[] | number | undefined) => string | null;
  // Texte de l'écran de fin, et contenu en plus (ex. l'option « sans condamnation » des convictions).
  texteFin?: string;
  fin?: React.ReactNode;
}

// Premier rang sans réponse (le visiteur qui revient reprend là où il s'est arrêté), à défaut le premier.
function rangDeDepart(etapes: EtapeQuestion[], profil: ProfilPartiel): number {
  const rang = etapes.findIndex((e) => !estRepondue(e.champ, profil));
  return rang === -1 ? 0 : rang;
}

// Une question par écran : libellé, finalité toujours visible (la place ne manque pas), réponses en grands choix. Rien n'est
// présélectionné : « Passer » laisse la question sans réponse, jamais comptée comme « non ». Chaque réponse s'applique tout de suite.
export function PasAPas({ etapes, profil, onReponse, onToutVoir, nom = "Question", pluriel = "questions", impact, texteFin = "Vos réponses sont enregistrées. Vous pouvez revenir en arrière pour les corriger, ou voir les mesures adaptées à votre situation.", fin }: PasAPasProps) {
  const [rang, setRang] = useState(() => rangDeDepart(etapes, profil));
  const propositions = useContext(PropositionsBase);
  const retourIntro = useContext(RetourIntroContexte);
  const fermer = useContext(FermerContexte);
  const total = etapes.length;
  // La file change quand une réponse fait apparaître ou disparaître une question conditionnelle : le rang reste dans ses bornes.
  const courant = Math.min(rang, total);
  const fini = courant >= total;
  const etape = fini ? null : etapes[courant];

  if (total === 0) {
    return (
      <div className="pas-a-pas" role="group" aria-label={nom === "Question" ? "Questions sur ma situation" : "Sujets de mes convictions"}>
        <p>Aucune question à vous poser pour le moment.</p>
      </div>
    );
  }

  if (fini || !etape) {
    return (
      <div className="pas-a-pas pas-a-pas--fin" role="group" aria-label={nom === "Question" ? "Questions sur ma situation" : "Sujets de mes convictions"}>
        <Check size={40} aria-hidden="true" focusable="false" />
        <h2>Vous avez fait le tour des {pluriel}</h2>
        <p>{texteFin}</p>
        {fin}
        {fermer && (
          <button type="button" className="pas-a-pas-retour-simulateur" onClick={fermer}>
            <Check size={18} aria-hidden="true" focusable="false" />
            Retour au simulateur
          </button>
        )}
        <div className="pas-a-pas-actions">
          <button type="button" className="secondaire" onClick={() => setRang(total - 1)}>
            <ArrowLeft size={18} aria-hidden="true" focusable="false" />
            Revenir à la dernière question
          </button>
          <button type="button" className="secondaire" onClick={onToutVoir}>
            <ListChecks size={18} aria-hidden="true" focusable="false" />
            Voir {pluriel === "questions" ? "toutes mes réponses" : "tous les sujets"}
          </button>
        </div>
      </div>
    );
  }

  const { champ } = etape;
  const id = `pas-${champ.id}`;
  const valeur = profil[champ.id];
  const repondue = estRepondue(champ, profil);
  const impactees = impact ? null : propositions ? compterMesuresImpactees(champ, profil, propositions) : null;
  const phraseImpact = impact ? impact(etape, valeur) : null;
  const choisis = Array.isArray(valeur) ? valeur : [];
  const pct = Math.round((courant / total) * 100);

  return (
    <div className="pas-a-pas" role="group" aria-label={nom === "Question" ? "Questions sur ma situation" : "Sujets de mes convictions"}>
      <div className="pas-a-pas-tete">
        <p className="pas-a-pas-rang" aria-live="polite">
          {nom} {courant + 1} sur {total}
          {etape.theme && <span className="pas-a-pas-theme"> · {etape.theme}</span>}
        </p>
        <div className="pas-a-pas-barre" role="progressbar" aria-label="Avancement des questions" aria-valuemin={0} aria-valuemax={total} aria-valuenow={courant}>
          <span style={{ width: `${pct}%` }} />
        </div>
      </div>

      <fieldset className="pas-a-pas-question" key={champ.id}>
        <legend>{champ.label}</legend>
        {champ.finalite && <p className="pas-a-pas-finalite">{champ.finalite}</p>}

        {champ.type === "enum" || champ.type === "multi" ? (
          <div className="pas-a-pas-choix">
            {(champ.options ?? []).map((option) => {
              const choisie = champ.type === "multi" ? choisis.includes(option) : valeur === option;
              return (
                <label key={option} className={`pas-a-pas-option${choisie ? " pas-a-pas-option--choisie" : ""}`}>
                  <input
                    type={champ.type === "multi" ? "checkbox" : "radio"}
                    name={id}
                    value={option}
                    checked={choisie}
                    onChange={(e) => {
                      if (champ.type === "multi") onReponse(etape, e.target.checked ? [...choisis, option] : choisis.filter((v) => v !== option));
                      else onReponse(etape, option);
                    }}
                  />
                  <span>{libelleOption(champ, option)}</span>
                </label>
              );
            })}
          </div>
        ) : (
          <input
            id={id}
            className="pas-a-pas-saisie"
            type={champ.type === "number" ? "number" : "text"}
            min={champ.type === "number" ? 0 : undefined}
            inputMode={champ.type === "number" ? "numeric" : undefined}
            placeholder="Non renseigné"
            value={valeur === undefined ? "" : String(valeur)}
            aria-label={champ.label}
            onChange={(e) => onReponse(etape, e.target.value)}
          />
        )}

        {phraseImpact && repondue && (
          <p className="question-impact" aria-live="polite">
            {phraseImpact}
          </p>
        )}
        {impactees !== null && repondue && (
          <p className="question-impact" aria-live="polite">
            {impactees === 0 ? "Aucune mesure des programmes ne concerne cette réponse." : impactees === 1 ? "1 mesure des programmes concerne cette réponse." : `${impactees} mesures des programmes concernent cette réponse.`}
          </p>
        )}

        {repondue && (
          <button type="button" className="lien-discret" onClick={() => onReponse(etape, champ.type === "multi" ? [] : "")}>
            <Eraser size={16} aria-hidden="true" focusable="false" />
            Effacer ma réponse
          </button>
        )}
      </fieldset>

      <div className="pas-a-pas-actions">
        <button type="button" className="secondaire" disabled={courant === 0 && !retourIntro} onClick={() => (courant === 0 ? retourIntro?.() : setRang(courant - 1))}>
          <ArrowLeft size={18} aria-hidden="true" focusable="false" />
          Précédent
        </button>
        <button type="button" onClick={() => setRang(courant + 1)}>
          {repondue ? "Suivant" : "Passer"}
          <ArrowRight size={18} aria-hidden="true" focusable="false" />
        </button>
      </div>
      <button type="button" className="lien-discret pas-a-pas-tout" onClick={onToutVoir}>
        <ListChecks size={16} aria-hidden="true" focusable="false" />
        Voir {pluriel === "questions" ? "toutes les questions" : "tous les sujets"} d'un coup
      </button>
    </div>
  );
}
