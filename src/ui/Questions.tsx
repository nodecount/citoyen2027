import { ChevronDown, CircleHelp } from "lucide-react";
import { useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { compterMesuresImpactees } from "../engine/mesuresImpactees";
import { PropositionsBase } from "./PropositionsContexte";
import { estRepondue, questionsVisibles } from "../questionnaire";
import { iconeDeQuestion } from "./icones";
import type { ProfilPartiel } from "../profil";
import type { ChampProfil } from "../types";

export type SurReponse = (champ: ChampProfil, brut: string | string[]) => void;

interface ChampQuestionProps {
  champ: ChampProfil;
  profil: ProfilPartiel;
  onReponse: SurReponse;
  idPrefixe: string;
  // Présentation en carte (icône devant le libellé, cadre), sinon présentation compacte sans cadre.
  carte?: boolean;
  // Texte placé devant le libellé de la question (ex. « Pour affiner : » sur les questions propres à un thème).
  prefixe?: string;
  // Cartes des questions sans réponse mises en valeur (bouton « Mettre en valeur les réponses manquantes »).
  mettreEnValeurManquantes?: boolean;
}

export function libelleOption(champ: ChampProfil, option: string): string {
  return champ.libelles?.[option] ?? option;
}

// « ? » à côté du libellé : la finalité de la question (« Pourquoi cette question ? ») dans une vraie infobulle, comme
// sur les formulaires de l'administration. Elle s'affiche au survol, au focus clavier et au clic/toucher (qui bascule
// l'ouverture : un toucher ne survole pas) ; Échap ou un clic ailleurs la referment. La finalité reste lisible par les
// lecteurs d'écran (elle décrit le champ via aria-describedby).
function AideQuestion({ id, texte }: { id: string; texte: string }) {
  const [ouverte, setOuverte] = useState(false);
  const racine = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ouverte) return;
    const dehors = (e: MouseEvent) => {
      if (!racine.current?.contains(e.target as Node)) setOuverte(false);
    };
    const echap = (e: KeyboardEvent) => e.key === "Escape" && setOuverte(false);
    document.addEventListener("mousedown", dehors);
    document.addEventListener("keydown", echap);
    return () => {
      document.removeEventListener("mousedown", dehors);
      document.removeEventListener("keydown", echap);
    };
  }, [ouverte]);

  return (
    <span className={`aide-question avec-infobulle${ouverte ? " aide-question--ouverte" : ""}`} ref={racine}>
      <button type="button" className="aide-question-bouton" aria-label="Pourquoi cette question ?" aria-describedby={id} onClick={() => setOuverte((o) => !o)}>
        <CircleHelp size={18} aria-hidden="true" focusable="false" />
      </button>
      <span className="infobulle infobulle--dessous" role="tooltip" id={id}>
        <strong>Pourquoi cette question ?</strong> {texte}
      </span>
    </span>
  );
}

// Liste déroulante à choix multiples : un bouton qui résume la sélection, et, à l'ouverture, une case à cocher par
// option. Les cases sont toujours dans la page (masquées tant que la liste est fermée) : le résumé se met à jour à
// chaque coche, et les réponses restent lisibles par un lecteur d'écran. Fermeture : Échap, clic ailleurs, ou sortie
// du champ au clavier. Aucune option n'est cochée au départ : ne rien cocher n'est jamais compté comme « non ».
function SelectMultiple({ champ, choisis, onChoix, id, idEtiquette, decrit }: { champ: ChampProfil; choisis: string[]; onChoix: (valeurs: string[]) => void; id: string; idEtiquette: string; decrit?: string }) {
  const [ouvert, setOuvert] = useState(false);
  const racine = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: MouseEvent) => {
      if (!racine.current?.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener("mousedown", dehors);
    return () => document.removeEventListener("mousedown", dehors);
  }, [ouvert]);

  const resume = choisis.length === 0 ? "Je préfère ne pas répondre" : choisis.map((o) => libelleOption(champ, o)).join(", ");

  return (
    <div
      className="select-multiple"
      ref={racine}
      onKeyDown={(e) => e.key === "Escape" && setOuvert(false)}
      onBlur={(e) => {
        if (!racine.current?.contains(e.relatedTarget as Node | null)) setOuvert(false);
      }}
    >
      <button
        type="button"
        id={id}
        className={`select-multiple-bouton${choisis.length === 0 ? " select-multiple-bouton--vide" : ""}`}
        aria-expanded={ouvert}
        aria-controls={`${id}-liste`}
        aria-labelledby={`${idEtiquette} ${id}`}
        aria-describedby={decrit}
        onClick={() => setOuvert((o) => !o)}
      >
        <span className="select-multiple-resume">{resume}</span>
        <ChevronDown size={16} aria-hidden="true" focusable="false" />
      </button>
      <div className="select-multiple-liste" id={`${id}-liste`} role="group" aria-labelledby={idEtiquette} hidden={!ouvert}>
        {(champ.options ?? []).map((option) => (
          <label key={option} className="option-multi">
            <input
              type="checkbox"
              checked={choisis.includes(option)}
              onChange={(e) => onChoix(e.target.checked ? [...choisis, option] : choisis.filter((v) => v !== option))}
            />
            {libelleOption(champ, option)}
          </label>
        ))}
      </div>
    </div>
  );
}

// Une question. Aucune réponse n'est présélectionnée : « Je préfère ne pas répondre » est l'état de départ, et laisser une
// question telle quelle n'est jamais compté comme « non ». Chaque question tient sur peu de place : une ligne d'en-tête
// (icône en mode carte, libellé à droite de l'icône, « ? » de la finalité tout à droite), puis le champ.
export function ChampQuestion({ champ, profil, onReponse, idPrefixe, carte = false, prefixe = "", mettreEnValeurManquantes = false }: ChampQuestionProps) {
  const libelle = prefixe + champ.label;
  const id = `${idPrefixe}-${champ.id}`;
  const idEtiquette = `${id}-etiquette`;
  const idFinalite = `${id}-finalite`;
  const valeur = profil[champ.id];
  const decrit = champ.finalite ? idFinalite : undefined;
  const Icone = iconeDeQuestion(champ.id);
  const propositions = useContext(PropositionsBase);
  const impactees = propositions ? compterMesuresImpactees(champ, profil, propositions) : null;
  // Sous la réponse, une fois la question répondue : combien de mesures des programmes la concernent (tous candidats, sans les nommer).
  const impact =
    impactees === null ? null : (
      <p className="question-impact" aria-live="polite">
        {impactees === 0 ? "Aucune mesure des programmes ne concerne cette réponse." : impactees === 1 ? "1 mesure des programmes concerne cette réponse." : `${impactees} mesures des programmes concernent cette réponse.`}
      </p>
    );

  const entete = (etiquette: ReactNode) => (
    <div className="question-tete">
      {carte && (
        <span className="question-icone" aria-hidden="true">
          <Icone size={22} focusable="false" />
        </span>
      )}
      {etiquette}
      {champ.finalite && <AideQuestion id={idFinalite} texte={champ.finalite} />}
    </div>
  );

  const corps =
    champ.type === "multi" ? (
      <div className="question question--multi">
        {entete(
          <span className="question-libelle" id={idEtiquette}>
            {libelle}
          </span>,
        )}
        <SelectMultiple
          champ={champ}
          choisis={Array.isArray(valeur) ? valeur : []}
          onChoix={(valeurs) => onReponse(champ, valeurs)}
          id={id}
          idEtiquette={idEtiquette}
          decrit={decrit}
        />
        {impact}
      </div>
    ) : (
      <div className="question">
        {entete(
          <label className="question-libelle" htmlFor={id} id={idEtiquette}>
            {libelle}
          </label>,
        )}
        {champ.type === "enum" ? (
          <select id={id} value={typeof valeur === "string" ? valeur : ""} onChange={(e) => onReponse(champ, e.target.value)} aria-describedby={decrit}>
            <option value="">Je préfère ne pas répondre</option>
            {(champ.options ?? []).map((option) => (
              <option key={option} value={option}>
                {libelleOption(champ, option)}
              </option>
            ))}
          </select>
        ) : (
          <input
            id={id}
            type={champ.type === "number" ? "number" : "text"}
            min={champ.type === "number" ? 0 : undefined}
            inputMode={champ.type === "number" ? "numeric" : undefined}
            placeholder="Non renseigné"
            value={valeur === undefined ? "" : String(valeur)}
            onChange={(e) => onReponse(champ, e.target.value)}
            aria-describedby={decrit}
          />
        )}
        {impact}
      </div>
    );

  if (!carte) return corps;
  const manquante = mettreEnValeurManquantes && !estRepondue(champ, profil);
  return <div className={manquante ? "question-carte question-carte--manquante" : "question-carte"}>{corps}</div>;
}

interface SectionQuestionsProps {
  questions: ChampProfil[];
  profil: ProfilPartiel;
  onReponse: SurReponse;
  idPrefixe: string;
  carte?: boolean;
  prefixe?: string;
  mettreEnValeurManquantes?: boolean;
}

// Questions d'une section, toutes au même niveau : les questions sensibles ne sont ni regroupées ni précédées d'une case
// d'accord (un seul geste pour répondre). Elles restent facultatives, chacune explique sa finalité, et « Je préfère ne
// pas répondre » est l'état de départ. Les questions conditionnelles n'apparaissent que si leur condition est remplie.
export function SectionQuestions({ questions, profil, onReponse, idPrefixe, carte = false, prefixe, mettreEnValeurManquantes }: SectionQuestionsProps) {
  return (
    <div className={`section-questions${carte ? " section-questions--cartes" : ""}`}>
      {questionsVisibles(questions, profil).map((champ) => (
        <ChampQuestion key={champ.id} champ={champ} profil={profil} onReponse={onReponse} idPrefixe={idPrefixe} carte={carte} prefixe={prefixe} mettreEnValeurManquantes={mettreEnValeurManquantes} />
      ))}
    </div>
  );
}
