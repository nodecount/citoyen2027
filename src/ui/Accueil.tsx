import themes from "../../data/themes.json";
import type { Theme } from "../types";

const themesTypes: Theme[] = themes as Theme[];

interface AccueilProps {
  onCommencer: () => void;
}

export default function Accueil({ onCommencer }: AccueilProps) {
  return (
    <section>
      <h1>Simulateur d'impact personnel — Présidentielle 2027</h1>
      <p>
        Cet outil projette, pour votre situation personnelle, ce que changerait l'élection de
        chacun des principaux candidats, thème par thème. Trois candidats sont couverts à ce
        stade, toujours présentés par ordre alphabétique. Voici les thèmes couverts :
      </p>
      <ul>
        {themesTypes.map((theme) => (
          <li key={theme.id}>
            <strong>{theme.libelle}</strong> — {theme.description}{" "}
            <em>{theme.statut === "populated" ? "(données disponibles)" : "(en cours d'analyse)"}</em>
          </li>
        ))}
      </ul>
      <button type="button" onClick={onCommencer}>
        Commencer
      </button>
    </section>
  );
}
