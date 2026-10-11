// Candidats que la source ne couvre pas du tout : aucune mesure affichable (par exemple, la fiche du candidat chez iFRAP ne contient
// aucune proposition). Dit dans la modale de choix de la source et dans le monitoring, jamais dans la page des thèmes (décision du
// 2026-10-11). Jamais en simulateur (candidats masqués) : le décompte des noms y lèverait l'anonymat par élimination.
export function ProgrammesSansMesure({ noms }: { noms: string[] }) {
  if (noms.length === 0) return null;
  return <p className="hint programmes-sans-mesure">Sans mesure dans cette source pour le moment : {noms.join(", ")}.</p>;
}
