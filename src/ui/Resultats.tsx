import { candidatsDeBase, type BaseCharge } from "../data/bases";
import type { Profil } from "../types";
import { construireCards } from "./cards";
import { VueResultats } from "./VueResultats";

interface ResultatsProps {
  profil: Profil;
  base: BaseCharge;
}

export default function Resultats({ profil, base }: ResultatsProps) {
  const { avecDonnees: candidats, enCoursAnalyse } = candidatsDeBase(base);
  const cards = construireCards(base.themes, candidats, profil);
  return (
    <>
      <VueResultats cards={cards} profil={profil} avertissement={base.info.avertissement} />
      {enCoursAnalyse.length > 0 && (
        <p className="hint">
          Programmes pas encore analysés, donc absents des résultats : {enCoursAnalyse.map((meta) => meta.nom).join(", ")}.
        </p>
      )}
    </>
  );
}
