import { useState, type FormEvent } from "react";
import profilSchema from "../../data/profils-schema.json";
import type { ChampProfil, Profil } from "../types";

const champs: ChampProfil[] = profilSchema as ChampProfil[];

interface ProfilFormProps {
  onValider: (profil: Profil) => void;
}

type ValeursFormulaire = Record<string, string>;

function valeurParDefaut(champ: ChampProfil): string {
  if (champ.type === "enum" && champ.options && champ.options.length > 0) {
    return champ.options[0];
  }
  if (champ.type === "number") {
    return "0";
  }
  return "";
}

export default function ProfilForm({ onValider }: ProfilFormProps) {
  const [valeurs, setValeurs] = useState<ValeursFormulaire>(() => {
    const initiales: ValeursFormulaire = {};
    for (const champ of champs) {
      initiales[champ.id] = valeurParDefaut(champ);
    }
    return initiales;
  });

  function handleChange(id: string, valeur: string) {
    setValeurs((precedent) => ({ ...precedent, [id]: valeur }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const profil = {
      statut_professionnel: valeurs.statut_professionnel,
      tranche_revenus: valeurs.tranche_revenus,
      situation_familiale: valeurs.situation_familiale,
      nombre_enfants: Number(valeurs.nombre_enfants) || 0,
      logement: valeurs.logement,
      secteur_activite: valeurs.secteur_activite,
      region: valeurs.region,
      tranche_age: valeurs.tranche_age,
      tranche_patrimoine: valeurs.tranche_patrimoine,
    } satisfies Profil;
    onValider(profil);
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Votre profil</h1>
      {champs.map((champ) => (
        <div key={champ.id}>
          <label htmlFor={champ.id}>{champ.label}</label>
          {champ.type === "enum" ? (
            <select
              id={champ.id}
              value={valeurs[champ.id]}
              onChange={(e) => handleChange(champ.id, e.target.value)}
              required
            >
              {(champ.options ?? []).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : champ.type === "number" ? (
            <input
              id={champ.id}
              type="number"
              min={0}
              value={valeurs[champ.id]}
              onChange={(e) => handleChange(champ.id, e.target.value)}
              required
            />
          ) : (
            <input
              id={champ.id}
              type="text"
              value={valeurs[champ.id]}
              onChange={(e) => handleChange(champ.id, e.target.value)}
              required
            />
          )}
        </div>
      ))}
      <button type="submit">Voir les résultats</button>
    </form>
  );
}
