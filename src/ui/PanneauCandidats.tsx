import { useCallback, useState } from "react";
import { BlocAbsent, ColonneTop, ModaleDetail, type LigneClassement, type ResultatAffiche } from "./CardCandidatIdeal";

interface PanneauCandidatsProps {
  critere: "situation" | "convictions";
  resultat: ResultatAffiche | null;
  // Le visiteur a choisi au moins une position (pour expliquer l'absence de résultat « convictions »).
  positionsChoisies?: boolean;
}

// Contenu de l'onglet « Candidats » d'un bloc latéral : le top 3 de ce critère, avec le détail d'une ligne au clic. Il n'est monté
// qu'une fois la suggestion révélée (l'onglet est verrouillé avant), donc il affiche toujours les identités.
export function PanneauCandidats({ critere, resultat, positionsChoisies = false }: PanneauCandidatsProps) {
  const [ouverte, setOuverte] = useState<LigneClassement[] | null>(null);
  // Identité stable : la modale n'efface ni ne reprend le focus à chaque rendu.
  const fermer = useCallback(() => setOuverte(null), []);

  if (!resultat) {
    return critere === "convictions" ? <BlocAbsent positionsChoisies={positionsChoisies} /> : <p className="hint">Pas encore de résultat : répondez d'abord à au moins une question.</p>;
  }
  return (
    <>
      <ColonneTop resultat={resultat} revele={true} onOuvrir={setOuverte} />
      {ouverte && <ModaleDetail ligne={ouverte[0]} egales={ouverte} unite={resultat.unite} critere={resultat.titre} onFermer={fermer} />}
    </>
  );
}
