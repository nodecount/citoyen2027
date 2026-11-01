import { useCallback, useState, type ReactNode } from "react";
import { AnneauPrecision } from "./AnneauPrecision";
import type { ResultatAffiche } from "./CardCandidatIdeal";
import { ModaleCandidatSuggere } from "./ModaleCandidatSuggere";
import type { EtatSuggestion } from "./etatZones";
import { Pastille } from "./Pastille";
import { partiAffichable } from "./parti";
import "./deuxZones.css";

// Nom affiché derrière le flou tant que la suggestion n'est pas révélée : jamais le vrai nom, qui n'est alors pas dans la page.
export const NOM_FICTIF = "XXXXXX YYYYYY";

interface BlocSuggestionProps {
  etat: EtatSuggestion;
  // Part de réponses données (0 à 100), côtés confondus.
  pourcent: number;
  // Candidat qui cumule les deux critères. Ses identités ne sont lues que révélé.
  combine: ResultatAffiche | null;
  onReveler: () => void;
  onRevenir: () => void;
}

// Parti affiché, flouté, tant que la suggestion n'est pas révélée : jamais le vrai parti, qui n'est alors pas dans la page.
export const PARTI_FICTIF = "Parti fictif";

// Bloc central, sur fond bleu à tous les états : titre fixe, anneau (précision, puis score une fois révélé), nom du candidat
// (flouté, avec son parti, tant que non révélé) et, révélé, son score ; puis le bouton de l'état.
export function BlocSuggestion({ etat, pourcent, combine, onReveler, onRevenir }: BlocSuggestionProps) {
  const [detailOuvert, setDetailOuvert] = useState(false);
  const fermerDetail = useCallback(() => setDetailOuvert(false), []);
  const revele = etat === "revele";
  // Le détail des deux notes : le candidat de la première place (ou tous ceux à égalité), révélé seulement.
  const lignesDetail = revele && combine?.departageable ? combine.classement.filter((l) => l.rang === 1 && l.identite && l.criteres) : [];
  const gagnants = combine && combine.departageable ? combine.gagnants : [];
  // Révélé seulement : c'est la seule fois où l'identité est lue.
  const identites = revele ? gagnants.flatMap((g) => (g.identite ? [g.identite] : [])) : [];
  // Score du candidat (sur 100), lu seulement révélé : il remplace le pourcentage de précision autour du portrait.
  const note = revele && identites.length > 0 ? combine?.classement[0]?.note ?? null : null;

  let nom: ReactNode;
  if (combine && gagnants.length === 0) {
    nom = combine.tousEcartes ? (
      <p className="suggestion-message">
        <strong>Tous les candidats étudiés sont écartés</strong> : condamnation connue.
      </p>
    ) : (
      <p className="suggestion-message">
        <strong>Égalité parfaite : aucun candidat ne se détache.</strong>
      </p>
    );
  } else if (revele && identites.length > 0) {
    nom = (
      <ul className="suggestion-noms">
        {identites.map((i) => (
          <li key={i.slug}>
            <strong>{i.nom}</strong>
            {partiAffichable(i.parti) && <span className="detail-parti">{partiAffichable(i.parti)}</span>}
          </li>
        ))}
      </ul>
    );
  } else {
    nom = (
      <>
        {gagnants.length > 1 && (
          <p className="suggestion-message">
            <strong>{gagnants.length} candidats à égalité</strong>
          </p>
        )}
        <div className="suggestion-identite" aria-hidden="true">
          <p className="suggestion-nom suggestion-nom--flou">{NOM_FICTIF}</p>
          <span className="detail-parti suggestion-parti--flou">{PARTI_FICTIF}</span>
        </div>
      </>
    );
  }

  return (
    <section className={`suggestion suggestion--${etat}`} aria-label="Mon candidat idéal">
      <h2>Mon candidat idéal</h2>
      <AnneauPrecision pourcent={note ?? pourcent} revele={revele} score={note !== null}>
        {identites.length > 0 ? <Pastille slug={identites[0].slug} nom={identites[0].nom} className="pastille--ideal" /> : <span aria-hidden="true">?</span>}
      </AnneauPrecision>
      {nom}
      {note !== null && (
        <p className="suggestion-score">
          <strong>Score {note} %</strong>
        </p>
      )}
      {lignesDetail.length > 0 && (
        <button type="button" className="bouton-revele suggestion-detail" aria-haspopup="dialog" onClick={() => setDetailOuvert(true)}>
          Voir les détails
        </button>
      )}
      {detailOuvert && lignesDetail.length > 0 && <ModaleCandidatSuggere lignes={lignesDetail} onFermer={fermerDetail} />}
      {etat === "vide" && <p className="suggestion-source">Répondez à une question de votre situation ou de vos convictions pour débloquer la suggestion.</p>}
      {revele ? (
        <div className="suggestion-retour">
          <p className="suggestion-precision">Précision {pourcent} %</p>
          <button type="button" className="bouton-fantome" onClick={onRevenir}>
            Revenir aux questions
          </button>
        </div>
      ) : (
        <button type="button" className="bouton-revele" disabled={etat === "vide"} onClick={onReveler}>
          Révéler
        </button>
      )}
    </section>
  );
}
