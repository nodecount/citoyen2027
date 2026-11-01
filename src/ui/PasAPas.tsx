import { ArrowLeft, ArrowRight, Check, Eraser, ListChecks } from "lucide-react";
import { useContext, useState } from "react";
import { compterMesuresImpactees } from "../engine/mesuresImpactees";
import type { ProfilPartiel } from "../profil";
import { estRepondue } from "../questionnaire";
import type { ChampProfil } from "../types";
import { ActionPied, FermerContexte, RetourIntroContexte, useNavigationPied } from "./ModaleTravail";
import { IconeTheme } from "./icones";
import { PropositionsBase } from "./PropositionsContexte";
import { libelleOption } from "./Questions";
import "./pasAPas.css";

// Une question de la file : générale (posée une seule fois) ou propre à un thème (le libellé du thème est alors rappelé).
export interface EtapeQuestion {
  champ: ChampProfil;
  theme?: string;
  // Identifiant du thème : son icône est dans le badge (absent pour une question générale).
  themeId?: string;
}

interface PasAPasProps {
  // File des questions actuellement visibles, générales d'abord puis par thème (les conditionnelles n'y sont que si leur condition est remplie).
  etapes: EtapeQuestion[];
  profil: ProfilPartiel;
  onReponse: (etape: EtapeQuestion, brut: string | string[]) => void;
  // Quitte le pas à pas pour la grille de toutes les questions.
  onToutVoir: () => void;
  // Nom accessible du groupe de questions (situation ou convictions) : on ne pose jamais que des « questions » au visiteur.
  groupe?: string;
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
// Dans une fenêtre de questions, « Précédent », « Suivant » (ou « Passer » tant que rien n'est répondu) et « Enregistrer et fermer »
// sont rangés dans le pied fixe de la fenêtre ; à la dernière question, « Suivant » devient « Enregistrer et fermer ».
export function PasAPas({ etapes, profil, onReponse, onToutVoir, groupe = "Questions sur ma situation", impact, texteFin = "Vos réponses sont enregistrées. Vous pouvez revenir en arrière pour les corriger, ou voir les mesures adaptées à votre situation.", fin }: PasAPasProps) {
  const [rang, setRang] = useState(() => rangDeDepart(etapes, profil));
  const propositions = useContext(PropositionsBase);
  const retourIntro = useContext(RetourIntroContexte);
  const fermer = useContext(FermerContexte);
  const total = etapes.length;
  // La file change quand une réponse fait apparaître ou disparaître une question conditionnelle : le rang reste dans ses bornes.
  const courant = Math.min(rang, total);
  const fini = courant >= total;
  const etape = fini ? null : etapes[courant];
  // Une question affichée : la navigation du pied de la fenêtre est la nôtre (sinon le pied ne propose que « Enregistrer et fermer »).
  useNavigationPied(Boolean(etape));

  if (total === 0) {
    return (
      <div className="pas-a-pas" role="group" aria-label={groupe}>
        <p>Aucune question à vous poser pour le moment.</p>
      </div>
    );
  }

  if (fini || !etape) {
    return (
      <div className="pas-a-pas pas-a-pas--fin" role="group" aria-label={groupe}>
        <Check size={40} aria-hidden="true" focusable="false" />
        <h2>Vous avez fait le tour des questions</h2>
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
            Voir toutes mes réponses
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
  const derniere = courant === total - 1;

  return (
    <div className="pas-a-pas" role="group" aria-label={groupe}>
      {/* Pas de barre d'avancement ici : celle de la complétion est déjà sur le tableau de bord. Seul le thème est rappelé. */}

      <fieldset className="pas-a-pas-question" key={champ.id}>
        {/* Sans sous-titre ni thème, le titre est centré sur le rond : aucune place n'est laissée à un sous-titre absent. */}
        <legend className={champ.finalite || etape.theme ? undefined : "pas-a-pas-legende--seule"}>
          <span className="pas-a-pas-rond" role="img" aria-live="polite" aria-label={`Question ${courant + 1} sur ${total}`}>
            <span className="pas-a-pas-num" aria-hidden="true">
              {courant + 1}
            </span>
            <span className="pas-a-pas-den" aria-hidden="true">
              {total}
            </span>
          </span>
          {/* La question et son sous-titre forment un seul groupe, que le compteur centre verticalement. */}
          <span className="pas-a-pas-titre">
            <span className="pas-a-pas-question-texte">{champ.label}</span>
            {/* Le thème est un badge à la fin du sous-titre, à la suite du texte : la question commence toujours à la même hauteur. */}
            {(champ.finalite || etape.theme) && (
              <span className="pas-a-pas-sous-titre">
                {champ.finalite && <span className="pas-a-pas-finalite">{champ.finalite}</span>}
                {etape.theme && (
                  <span className="pas-a-pas-theme">
                    {etape.themeId && <IconeTheme themeId={etape.themeId} taille={14} />}
                    {etape.theme}
                  </span>
                )}
              </span>
            )}
          </span>
        </legend>

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

        {/* Une fois répondu : la phrase sur les mesures concernées à gauche, « Effacer ma réponse » (rouge, ghost) sur la même ligne, à droite. */}
        {repondue && (
          <div className="pas-a-pas-ligne-reponse">
            {phraseImpact ? (
              <p className="question-impact" aria-live="polite">
                {phraseImpact}
              </p>
            ) : impactees !== null ? (
              <p className="question-impact" aria-live="polite">
                {impactees === 0 ? "Aucune mesure des programmes ne concerne cette réponse." : impactees === 1 ? "1 mesure des programmes concerne cette réponse." : `${impactees} mesures des programmes concernent cette réponse.`}
              </p>
            ) : (
              <span />
            )}
            <button type="button" className="bouton-effacer pas-a-pas-effacer" onClick={() => onReponse(etape, champ.type === "multi" ? [] : "")}>
              <Eraser size={16} aria-hidden="true" focusable="false" />
              Effacer ma réponse
            </button>
          </div>
        )}
      </fieldset>

      <ActionPied zone="navigation">
        <div className="pas-a-pas-actions">
          <button type="button" className="secondaire" disabled={courant === 0 && !retourIntro} onClick={() => (courant === 0 ? retourIntro?.() : setRang(courant - 1))}>
            <ArrowLeft size={18} aria-hidden="true" focusable="false" />
            Précédent
          </button>
          {/* À droite : « Enregistrer et fermer » (ghost) juste à gauche de « Suivant ». À la dernière question, « Suivant » devient
              « Enregistrer et fermer » (réponse donnée ou non). */}
          <div className="pas-a-pas-actions-droite">
            {derniere ? (
              <button type="button" onClick={() => fermer?.()}>
                Enregistrer et fermer
              </button>
            ) : (
              <>
                {fermer && (
                  <button type="button" className="ghost" onClick={fermer}>
                    Enregistrer et fermer
                  </button>
                )}
                <button type="button" onClick={() => setRang(courant + 1)}>
                  {repondue ? "Suivant" : "Passer"}
                  <ArrowRight size={18} aria-hidden="true" focusable="false" />
                </button>
              </>
            )}
          </div>
        </div>
      </ActionPied>
      <ActionPied>
        <button type="button" className="secondaire pas-a-pas-tout" onClick={onToutVoir}>
          <ListChecks size={16} aria-hidden="true" focusable="false" />
          Voir toutes les questions d'un coup
        </button>
      </ActionPied>
    </div>
  );
}
