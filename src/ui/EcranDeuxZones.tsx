import { CircleHelp, Eraser } from "lucide-react";
import { useCallback, useState } from "react";
import { BlocSuggestion } from "./BlocSuggestion";
import { ModaleAideScore, type ResultatAffiche } from "./CardCandidatIdeal";
import { etatSuggestion, type Onglet, type OngletsZones } from "./etatZones";
import { ModaleConfirmation } from "./ModaleConfirmation";
import { PanneauCandidats } from "./PanneauCandidats";
import { messageRevelation, progression, sourceDeLaSuggestion, type Comptes } from "./progression";
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

function Barre({ comptes, couleur }: { comptes: Comptes; couleur: "bleu" | "vert" }) {
  const pct = comptes.total > 0 ? Math.round((comptes.repondues / comptes.total) * 100) : 0;
  return (
    <div className={`zone-barre zone-barre--${couleur}`} aria-hidden="true">
      <span style={{ width: `${pct}%` }} />
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
              <h2>Ma situation</h2>
              <p className="zone-compte">{pluriel(p.situation.repondues, "question", "questions")} sur {p.situation.total}</p>
              <Barre comptes={p.situation} couleur="bleu" />
              <button type="button" onClick={() => p.onOuvrir("situation")}>
                {commence(p.situation) ? "Continuer" : "Commencer"}
              </button>
              {p.mesuresAccessibles && (
                <button type="button" className="lien-discret" onClick={() => p.onOuvrir("themes")}>
                  → Voir les mesures adaptées
                </button>
              )}
              {p.peutEffacerReponses && (
                <button type="button" className="bouton-effacer" onClick={p.onEffacerReponses}>
                  <Eraser size={18} aria-hidden="true" focusable="false" />
                  Effacer mes réponses
                </button>
              )}
            </>
          }
          candidats={<PanneauCandidats critere="situation" resultat={p.resultatSituation} />}
        />

        <div className="deux-zones-centre">
          <BlocSuggestion etat={etat} pourcent={prog.pourcent} source={sourceDeLaSuggestion(p.situation, p.convictions)} combine={p.combine} onReveler={() => setConfirmer(true)} onRevenir={p.onRevenir} />
          <button type="button" className="secondaire zone-aide" aria-haspopup="dialog" onClick={() => setAide(true)}>
            <CircleHelp size={20} aria-hidden="true" focusable="false" />
            Comment est calculé le score ?
          </button>
        </div>

        <ZoneOnglets
          zone="convictions"
          onglet={p.onglets.droite}
          candidatsOuverts={p.revele}
          onChoisir={(o) => p.onChoisirOnglet("droite", o)}
          questions={
            <>
              <h2>Mes convictions</h2>
              <p className="zone-compte">{pluriel(p.convictions.repondues, "sujet", "sujets")} sur {p.convictions.total}</p>
              <Barre comptes={p.convictions} couleur="vert" />
              <p className="zone-aide-texte">Un sujet sans avis ne compte pas.</p>
              <button type="button" className="secondaire" onClick={() => p.onOuvrir("convictions")}>
                {commence(p.convictions) ? "Continuer" : "Commencer"}
              </button>
              {p.peutEffacerConvictions && (
                <button type="button" className="bouton-effacer" onClick={p.onEffacerConvictions}>
                  <Eraser size={18} aria-hidden="true" focusable="false" />
                  Effacer mes convictions
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
