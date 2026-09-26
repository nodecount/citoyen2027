import { candidatsDeBase, type BaseCharge } from "../data/bases";

interface AccueilProps {
  base: BaseCharge;
  onCommencer: () => void;
}

export default function Accueil({ base, onCommencer }: AccueilProps) {
  const nombreCandidats = candidatsDeBase(base).avecDonnees.length;
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
        {base.themes.map((theme) => (
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
