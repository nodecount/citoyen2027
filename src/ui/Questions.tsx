import { Info } from "lucide-react";
import { questionsVisibles } from "../questionnaire";
import { iconeDeQuestion } from "./icones";
import type { ProfilPartiel } from "../profil";
import type { ChampProfil } from "../types";

export type SurReponse = (champ: ChampProfil, brut: string | string[]) => void;

interface ChampQuestionProps {
  champ: ChampProfil;
  profil: ProfilPartiel;
  onReponse: SurReponse;
  idPrefixe: string;
  // Présentation en carte (icône + « Pourquoi cette question ? » mis en évidence), sinon présentation compacte.
  carte?: boolean;
}

function libelleOption(champ: ChampProfil, option: string): string {
  return champ.libelles?.[option] ?? option;
}

// Une question. Aucune réponse n'est présélectionnée : « Je préfère ne pas répondre » est l'état de départ, et laisser une
// question telle quelle n'est jamais compté comme « non ».
export function ChampQuestion({ champ, profil, onReponse, idPrefixe, carte = false }: ChampQuestionProps) {
  const corps = <CorpsQuestion champ={champ} profil={profil} onReponse={onReponse} idPrefixe={idPrefixe} carte={carte} />;
  if (!carte) return corps;
  // Mode « carte » (formulaire ouvert au-dessus des thèmes) : une icône à gauche, la question et son pourquoi à droite.
  const Icone = iconeDeQuestion(champ.id);
  return (
    <div className="question-carte">
      <span className="question-icone" aria-hidden="true">
        <Icone size={22} focusable="false" />
      </span>
      <div className="question-carte-corps">{corps}</div>
    </div>
  );
}

function CorpsQuestion({ champ, profil, onReponse, idPrefixe, carte }: ChampQuestionProps & { carte: boolean }) {
  const id = `${idPrefixe}-${champ.id}`;
  const valeur = profil[champ.id];
  const finalite = champ.finalite ? (
    <small className="finalite" id={`${id}-finalite`}>
      {carte && <Info size={16} aria-hidden="true" focusable="false" />}
      <span>
        <strong>Pourquoi cette question ?</strong> {champ.finalite}
      </span>
    </small>
  ) : null;

  if (champ.type === "multi") {
    const choisis = Array.isArray(valeur) ? valeur : [];
    return (
      <fieldset className="question question--multi" aria-describedby={champ.finalite ? `${id}-finalite` : undefined}>
        <legend>{champ.label}</legend>
        {(champ.options ?? []).map((option) => (
          <label key={option} className="option-multi">
            <input
              type="checkbox"
              checked={choisis.includes(option)}
              onChange={(e) => onReponse(champ, e.target.checked ? [...choisis, option] : choisis.filter((v) => v !== option))}
            />
            {libelleOption(champ, option)}
          </label>
        ))}
        {finalite}
      </fieldset>
    );
  }

  return (
    <div className="question">
      <label htmlFor={id}>{champ.label}</label>
      {champ.type === "enum" ? (
        <select
          id={id}
          value={typeof valeur === "string" ? valeur : ""}
          onChange={(e) => onReponse(champ, e.target.value)}
          aria-describedby={champ.finalite ? `${id}-finalite` : undefined}
        >
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
          aria-describedby={champ.finalite ? `${id}-finalite` : undefined}
        />
      )}
      {finalite}
    </div>
  );
}

interface SectionQuestionsProps {
  questions: ChampProfil[];
  profil: ProfilPartiel;
  onReponse: SurReponse;
  idPrefixe: string;
  carte?: boolean;
}

// Questions d'une section, toutes au même niveau : les questions sensibles ne sont ni regroupées ni précédées d'une case
// d'accord (un seul geste pour répondre). Elles restent facultatives, chacune explique sa finalité, et « Je préfère ne
// pas répondre » est l'état de départ. Les questions conditionnelles n'apparaissent que si leur condition est remplie.
export function SectionQuestions({ questions, profil, onReponse, idPrefixe, carte = false }: SectionQuestionsProps) {
  return (
    <div className={`section-questions${carte ? " section-questions--cartes" : ""}`}>
      {questionsVisibles(questions, profil).map((champ) => (
        <ChampQuestion key={champ.id} champ={champ} profil={profil} onReponse={onReponse} idPrefixe={idPrefixe} carte={carte} />
      ))}
    </div>
  );
}