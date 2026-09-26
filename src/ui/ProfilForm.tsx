import { useState, type FormEvent } from "react";
import profilSchema from "../../data/profils-schema.json";
import type { ProfilPartiel } from "../profil";
import type { ChampProfil, Profil } from "../types";

const champs: ChampProfil[] = profilSchema as ChampProfil[];

interface ProfilFormProps {
  profilInitial?: ProfilPartiel;
  onValider: (profil: ProfilPartiel) => void;
  onAnnuler: () => void;
}

type ValeursFormulaire = Record<string, string>;

// Aucune valeur par défaut : une question laissée telle quelle est « non répondue », jamais « non ».
function valeursDepuis(profil: ProfilPartiel | undefined): ValeursFormulaire {
  const valeurs: ValeursFormulaire = {};
  for (const champ of champs) {
    const v = profil?.[champ.id as keyof Profil];
    valeurs[champ.id] = v === undefined || v === null ? "" : String(v);
  }
  return valeurs;
}

// Ne garde que les réponses données : un champ vide n'apparaît pas dans le profil.
export function profilDepuisValeurs(valeurs: ValeursFormulaire): ProfilPartiel {
  const profil: Record<string, string | number> = {};
  for (const champ of champs) {
    const brut = (valeurs[champ.id] ?? "").trim();
    if (brut === "") continue;
    if (champ.type === "number") {
      const n = Number(brut);
      if (Number.isFinite(n) && n >= 0) profil[champ.id] = n;
    } else {
      profil[champ.id] = brut;
    }
  }
  return profil as ProfilPartiel;
}

export default function ProfilForm({ profilInitial, onValider, onAnnuler }: ProfilFormProps) {
  const [valeurs, setValeurs] = useState<ValeursFormulaire>(() => valeursDepuis(profilInitial));

  function handleChange(id: string, valeur: string) {
    setValeurs((precedent) => ({ ...precedent, [id]: valeur }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onValider(profilDepuisValeurs(valeurs));
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Ma situation</h1>
      <p className="hint">
        Toutes les questions sont facultatives : répondez à celles que vous voulez. Vos réponses restent dans votre
        navigateur, elles ne sont ni envoyées ni conservées. Une question laissée sans réponse n'est jamais comptée
        comme « non ». Plus vous répondez, plus les indicateurs s'affinent.
      </p>
      {champs.map((champ) => (
        <div key={champ.id}>
          <label htmlFor={champ.id}>{champ.label}</label>
          {champ.type === "enum" ? (
            <select id={champ.id} value={valeurs[champ.id]} onChange={(e) => handleChange(champ.id, e.target.value)}>
              <option value="">Je préfère ne pas répondre</option>
              {(champ.options ?? []).map((option) => (
                <option key={option} value={option}>
                  {champ.libelles?.[option] ?? option}
                </option>
              ))}
            </select>
          ) : champ.type === "number" ? (
            <input
              id={champ.id}
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="Non renseigné"
              value={valeurs[champ.id]}
              onChange={(e) => handleChange(champ.id, e.target.value)}
            />
          ) : (
            <input
              id={champ.id}
              type="text"
              placeholder="Non renseigné"
              value={valeurs[champ.id]}
              onChange={(e) => handleChange(champ.id, e.target.value)}
            />
          )}
        </div>
      ))}
      <div className="actions">
        <button type="submit">Voir les indicateurs</button>
        <button type="button" className="secondaire" onClick={onAnnuler}>
          Retour aux thèmes
        </button>
      </div>
    </form>
  );
}
