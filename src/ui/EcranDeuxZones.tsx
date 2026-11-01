import { CircleHelp, Eraser } from "lucide-react";
import { useCallback, useState, type CSSProperties } from "react";
import { BlocSuggestion } from "./BlocSuggestion";
import { ModaleAideScore, type ResultatAffiche } from "./CardCandidatIdeal";
import { etatSuggestion, type Onglet, type OngletsZones } from "./etatZones";
import { ModaleConfirmation } from "./ModaleConfirmation";
import { PanneauCandidats } from "./PanneauCandidats";
import { pourcentage } from "./PanneauProgression";
import { messageRevelation, progression, type Comptes } from "./progression";
import { ZoneOnglets } from "./ZoneOnglets";
import "./deuxZones.css";

export interface EcranDeuxZonesProps {
  situation: Comptes;
  convictions: Comptes;
  resultatSituation: ResultatAffiche | null;
  resultatConvictions: ResultatAffiche | null;
  combine: ResultatAffiche | null;
  // Le visiteur a choisi au moins une position (pour expliquer l'absence de résultat « convictions »).
  positionsChoisies: boolean;
  revele: boolean;
  onglets: OngletsZones;
  // Le lien « Voir les mesures adaptées » n'apparaît que lorsqu'il y a des réponses.
  mesuresAccessibles: boolean;
  peutEffacerReponses: boolean;
  peutEffacerConvictions: boolean;
  // Appelé APRÈS la confirmation du visiteur.
  onReveler: () => void;
  onRevenir: () => void;
  onChoisirOnglet: (zone: "gauche" | "droite", onglet: Onglet) => void;
  onOuvrir: (vue: "situation" | "themes" | "convictions") => void;
  onEffacerReponses: () => void;
  onEffacerConvictions: () => void;
  // Pour les tests de rendu statique : fenêtre de confirmation déjà ouverte.
  confirmationOuverteInitiale?: boolean;
}

const pluriel = (n: number, singulier: string, plur: string) => `${n} ${n > 1 ? plur : singulier}`;

// Même barre que celle de la fenêtre des questions (pilule, pourcentage écrit dedans), à la couleur du bloc.
function Barre({ comptes, couleur }: { comptes: Comptes; couleur: "bleu" | "vert" }) {
  const pct = pourcentage(comptes.repondues, comptes.total);
  return (
    <div className={`panneau-barre zone-barre zone-barre--${couleur}`} role="progressbar" aria-label="Part des réponses données" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <span className="panneau-barre-remplie" style={{ width: `${pct}%` }} />
      <span className="panneau-barre-texte" style={{ "--pct": `${pct}%` } as CSSProperties}>
        {pct} %
      </span>
    </div>
  );
}
// Écran du simulateur : à gauche la situation, au centre la suggestion « Mon candidat idéal », à droite les convictions. Les deux
// côtés se remplissent indépendamment, dans l'ordre que l'on veut ; la suggestion est accessible dès une réponse donnée.
export function EcranDeuxZones(p: EcranDeuxZonesProps) {
  const [confirmer, setConfirmer] = useState(p.confirmationOuverteInitiale ?? false);
  const [aide, setAide] = useState(false);
  const fermerAide = useCallback(() => setAide(false), []);
  const prog = progression(p.situation, p.convictions);
  const etat = etatSuggestion(prog.repondues, p.revele);
  const commence = (c: Comptes) => c.repondues > 0;

  return (
    <>
      <ModaleConfirmation
        ouverte={confirmer}
        titre="Révéler votre candidat idéal ?"
        message={messageRevelation(p.situation, p.convictions)}
        libelleConfirmer="Oui, révéler"
        libelleAnnuler="Continuer à répondre"
        destructrice={false}
        onConfirmer={() => {
          setConfirmer(false);
          p.onReveler();
        }}
        onAnnuler={() => setConfirmer(false)}
      />
      {aide && <ModaleAideScore onFermer={fermerAide} />}
      <div className="deux-zones">
        <ZoneOnglets
          zone="situation"
          onglet={p.onglets.gauche}
          candidatsOuverts={p.revele}
          onChoisir={(o) => p.onChoisirOnglet("gauche", o)}
          questions={
            <>
              <p className="zone-compte">Vous avez répondu à {pluriel(p.situation.repondues, "question", "questions")} sur {p.situation.total}</p>
              <Barre comptes={p.situation} couleur="bleu" />
              <button type="button" className="zone-principal" onClick={() => p.onOuvrir("situation")}>
                {commence(p.situation) ? "Reprendre le questionnaire" : "Commencer le questionnaire"}
              </button>
              {p.peutEffacerReponses && (
                <button type="button" className="bouton-effacer zone-effacer" onClick={p.onEffacerReponses}>
                  <Eraser size={18} aria-hidden="true" focusable="false" />
                  Effacer mes réponses
                </button>
              )}
              {p.mesuresAccessibles && (
                <button type="button" className="lien-discret" onClick={() => p.onOuvrir("themes")}>
                  → Voir les mesures adaptées
                </button>
              )}            </>
          }
          candidats={<PanneauCandidats critere="situation" resultat={p.resultatSituation} />}
        />

        <div className="deux-zones-centre">
          <BlocSuggestion etat={etat} pourcent={prog.pourcent} combine={p.combine} onReveler={() => setConfirmer(true)} onRevenir={p.onRevenir} />
          <button type="button" className="secondaire zone-aide" aria-haspopup="dialog" onClick={() => setAide(true)}>
            <CircleHelp size={20} aria-hidden="true" focusable="false" />
            Comment est suggéré le candidat ?
          </button>
        </div>

        <ZoneOnglets
          zone="convictions"
          onglet={p.onglets.droite}
          candidatsOuverts={p.revele}
          onChoisir={(o) => p.onChoisirOnglet("droite", o)}
          questions={
            <>
              <p className="zone-compte">Vous avez répondu à {pluriel(p.convictions.repondues, "question", "questions")} sur {p.convictions.total}</p>
              <Barre comptes={p.convictions} couleur="vert" />
              <button type="button" className="zone-principal" onClick={() => p.onOuvrir("convictions")}>
                {commence(p.convictions) ? "Reprendre le questionnaire" : "Commencer le questionnaire"}
              </button>
              {p.peutEffacerConvictions && (
                <button type="button" className="bouton-effacer zone-effacer" onClick={p.onEffacerConvictions}>
                  <Eraser size={18} aria-hidden="true" focusable="false" />
                  Effacer mes réponses
                </button>
              )}
            </>
          }
          candidats={<PanneauCandidats critere="convictions" resultat={p.resultatConvictions} positionsChoisies={p.positionsChoisies} />}
        />
      </div>
    </>
  );
}
