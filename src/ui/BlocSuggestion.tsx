import type { ReactNode } from "react";
import { AnneauPrecision } from "./AnneauPrecision";
import type { ResultatAffiche } from "./CardCandidatIdeal";
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
  source: "situation" | "convictions" | "les deux" | null;
  // Candidat qui cumule les deux critères. Ses identités ne sont lues que révélé.
  combine: ResultatAffiche | null;
  onReveler: () => void;
  onRevenir: () => void;
}

const LIGNE_SOURCE = {
  situation: "Calculé sur votre situation seule",
  convictions: "Calculé sur vos convictions seules",
  "les deux": "Calculé sur votre situation et vos convictions",
} as const;

// Bloc central, sur fond bleu à tous les états : titre fixe, anneau de précision, nom du candidat (flouté tant que non révélé),
// ce sur quoi repose la suggestion, puis le bouton de l'état.
export function BlocSuggestion({ etat, pourcent, source, combine, onReveler, onRevenir }: BlocSuggestionProps) {
  const revele = etat === "revele";
  const gagnants = combine && combine.departageable ? combine.gagnants : [];
  // Révélé seulement : c'est la seule fois où l'identité est lue.
  const identites = revele ? gagnants.flatMap((g) => (g.identite ? [g.identite] : [])) : [];

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
        <p className="suggestion-nom suggestion-nom--flou" aria-hidden="true">
          {NOM_FICTIF}
        </p>
      </>
    );
  }

  return (
    <section className={`suggestion suggestion--${etat}`} aria-label="Mon candidat idéal">
      <h2>Mon candidat idéal</h2>
      <AnneauPrecision pourcent={pourcent} revele={revele}>
        {identites.length > 0 ? <Pastille slug={identites[0].slug} nom={identites[0].nom} className="pastille--ideal" /> : <span aria-hidden="true">?</span>}
      </AnneauPrecision>
      {nom}
      <p className="suggestion-source">{source ? LIGNE_SOURCE[source] : "Répondez à une question, d'un côté ou de l'autre, pour débloquer la suggestion."}</p>
      {revele ? (
        <button type="button" className="bouton-fantome" onClick={onRevenir}>
          Revenir aux questions
          <small>Révélé · précision {pourcent} %</small>
        </button>
      ) : (
        <button type="button" className="bouton-revele" disabled={etat === "vide"} onClick={onReveler}>
          Révéler
        </button>
      )}
    </section>
  );
}
