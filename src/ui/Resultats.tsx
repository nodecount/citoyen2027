import themes from "../../data/themes.json";
import { chargerCandidats } from "../data/chargerCandidats";
import type { Profil, Theme } from "../types";
import { construireCards } from "./cards";
import { VueResultats } from "./VueResultats";

const themesTypes: Theme[] = themes as Theme[];

// Chargés une fois depuis data/programmes/ (ajouter un candidat = ajouter un dossier, aucun code).
const { avecDonnees: candidats, enCoursAnalyse } = chargerCandidats();

interface ResultatsProps {
  profil: Profil;
}

export default function Resultats({ profil }: ResultatsProps) {
  const cards = construireCards(themesTypes, candidats, profil);
  return (
    <>
      <VueResultats cards={cards} profil={profil} />
      {enCoursAnalyse.length > 0 && (
        <p className="hint">
          Programmes pas encore analysés, donc absents des résultats : {enCoursAnalyse.map((meta) => meta.nom).join(", ")}.
        </p>
      )}
    </>
  );
}
