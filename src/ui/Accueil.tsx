import themes from "../../data/themes.json";
import { chargerCandidats } from "../data/chargerCandidats";
import type { Theme } from "../types";

const themesTypes: Theme[] = themes as Theme[];
const nombreCandidats = chargerCandidats().avecDonnees.length;

interface AccueilProps {
  onCommencer: () => void;
}

export default function Accueil({ onCommencer }: AccueilProps) {
  return (
    <section>
      <h1>Simulateur d'impact personnel — Présidentielle 2027</h1>
      <p>
        Cet outil projette, pour votre situation personnelle, ce que changerait l'élection de
        chacun des principaux candidats, thème par thème. {nombreCandidats}{" "}
        {nombreCandidats > 1 ? "candidats sont couverts" : "candidat est couvert"} à ce stade, toujours
        présentés par ordre alphabétique. Voici les thèmes :
      </p>
      <ul>
        {themesTypes.map((theme) => (
          <li key={theme.id}>
            <strong>{theme.libelle}</strong> — {theme.question_citoyen}{" "}
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
