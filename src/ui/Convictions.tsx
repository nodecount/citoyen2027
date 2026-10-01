import { Briefcase, Coins, Cpu, Eraser, Highlighter, Landmark, Leaf, Scale, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { constatIntegrite, INTEGRITES, type ConstatIntegrite, type Integrite } from "../data/integrite";
import { projeterPosition } from "../engine/positions";
import { SUJETS_CONVICTION, trouverPosition, trouverSujet } from "../positions";
import type { Proposition } from "../types";
import { aDesConvictions, CONVICTIONS_VIDES, type Convictions } from "./memoireConvictions";
import { IndicateurEnregistrement, useSignalEnregistrement } from "./IndicateurEnregistrement";
import { ModaleConfirmation } from "./ModaleConfirmation";

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

// « 2025-06-10 » → « 10 juin 2025 » (les données gardent le format ISO, l'écran parle français).
export function dateEnClair(iso: string): string {
  const [annee, mois, jour] = iso.split("-").map(Number);
  return `${jour === 1 ? "1er" : jour} ${MOIS[mois - 1]} ${annee}`;
}

// Ce que le visiteur voit de l'axe, selon le mode. Deux garde-fous, testés à part :
//  - faits d'intégrité : seulement en simulateur, si le visiteur y tient, et jamais à l'aveugle (un casier identifie) ;
//  - convictions : jamais transmises en exploration, même enregistrées.
export function integritesVisibles({ simulateur, exemplarite, aveugle, slugs, integrites = INTEGRITES }: { simulateur: boolean; exemplarite: boolean; aveugle: boolean; slugs: string[]; integrites?: Record<string, Integrite> }): Record<string, ConstatIntegrite> | null {
  if (!simulateur || !exemplarite || aveugle) return null;
  return Object.fromEntries(slugs.map((slug) => [slug, constatIntegrite(integrites[slug])]));
}

export function convictionsVisibles(simulateur: boolean, convictions: Convictions): Convictions {
  return simulateur ? convictions : CONVICTIONS_VIDES;
}

const ICONES_SUJETS: Record<string, LucideIcon> = {
  ecologie: Leaf,
  ia: Cpu,
  europe: Landmark,
  immigration: Users,
  fiscalite: Coins,
  securite: ShieldCheck,
  travail: Briefcase,
  libertes: Scale,
};

// Bloc « Mes convictions » : un sujet par carte, une position au choix, « Pas d'avis » par défaut (aucun score, aucun
// classement ici : les positions ne servent qu'au résultat « convictions » de la card « candidat idéal »).
export function BlocConvictions({ convictions, onChange: appliquer }: { convictions: Convictions; onChange: (c: Convictions) => void }) {
  const { etat, signaler } = useSignalEnregistrement();
  const onChange = (c: Convictions) => {
    signaler();
    appliquer(c);
  };
  const choisir = (sujet: string, position: string) => {
    const positions = { ...convictions.positions };
    if (position === "") delete positions[sujet];
    else positions[sujet] = position;
    onChange({ ...convictions, positions });
  };
  const [confirmerEffacement, setConfirmerEffacement] = useState(false);
  const [manquantesEnValeur, setManquantesEnValeur] = useState(false);
  const nombre = Object.keys(convictions.positions).length;
  return (
    <section className="convictions questionnaire questionnaire--integre" aria-label="Mes convictions">
      <div className="questionnaire-entete">
        <h2>Mes convictions</h2>
        <p className="progression">
          {nombre} position{nombre > 1 ? "s" : ""} sur {SUJETS_CONVICTION.length} sujets
        </p>
        <button type="button" className="secondaire bouton-manquantes" aria-pressed={manquantesEnValeur} onClick={() => setManquantesEnValeur((v) => !v)}>
          <Highlighter size={18} aria-hidden="true" focusable="false" />
          Mettre en valeur les réponses manquantes
        </button>
        <IndicateurEnregistrement etat={etat} />
        {aDesConvictions(convictions) && (
          <div className="actions">
            <button type="button" className="secondaire" onClick={() => setConfirmerEffacement(true)}>
              <Eraser size={18} aria-hidden="true" focusable="false" />
              Effacer mes convictions
            </button>
          </div>
        )}
      </div>
      <div className="section-questions--cartes">
        {SUJETS_CONVICTION.map((sujet) => {
          const Icone = ICONES_SUJETS[sujet.id] ?? Scale;
          const id = `conviction-${sujet.id}`;
          return (
            <div key={sujet.id} className={manquantesEnValeur && !convictions.positions[sujet.id] ? "question-carte question-carte--manquante" : "question-carte"}>
              <div className="question">
                <div className="question-tete">
                  <span className="question-icone" aria-hidden="true">
                    <Icone size={22} focusable="false" />
                  </span>
                  <label className="question-libelle" htmlFor={id}>
                    {sujet.libelle}
                  </label>
                </div>
                <select id={id} value={convictions.positions[sujet.id] ?? ""} onChange={(e) => choisir(sujet.id, e.target.value)}>
                  <option value="">Pas d'avis</option>
                  {sujet.positions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.libelle}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>
      <label className="interrupteur">
        <input type="checkbox" role="switch" checked={convictions.exemplarite} onChange={(e) => onChange({ ...convictions, exemplarite: e.target.checked })} />
        <span className="interrupteur-piste" aria-hidden="true" />
        Je tiens à un candidat sans condamnation définitive
      </label>
      {/* Le simulateur est toujours à l'aveugle : les faits d'intégrité ne s'affichent jamais, ils servent seulement à écarter
          des candidats du résultat « convictions » de la card « candidat idéal », qui n'existe qu'avec au moins une position. */}
      {convictions.exemplarite &&
        (nombre === 0 ? (
          <p className="hint">Sans position choisie, cette option ne change rien : elle sert seulement à écarter des candidats du résultat « convictions ». Choisissez au moins une position.</p>
        ) : (
          <p className="hint">Les candidats ayant une condamnation définitive connue sont écartés du résultat « convictions ». Les faits ne sont pas affichés, pour ne pas dévoiler les noms.</p>
        ))}
      <ModaleConfirmation
        ouverte={confirmerEffacement}
        titre="Effacer vos convictions ?"
        message="Vos choix (positions et intégrité) seront effacés de ce navigateur. Cette action ne peut pas être annulée."
        libelleConfirmer="Oui, tout effacer"
        onConfirmer={() => {
          setConfirmerEffacement(false);
          onChange(CONVICTIONS_VIDES);
        }}
        onAnnuler={() => setConfirmerEffacement(false)}
      />
    </section>
  );
}
function ListeSourcesIntegrite({ sources }: { sources: Array<{ nom: string; annee: number; url: string }> }) {
  return (
    <>
      {sources.map((s, i) => (
        <span key={`${i}-${s.url}`}>
          {i > 0 && ", "}
          <a href={s.url} target="_blank" rel="noopener noreferrer">{`${s.nom} · ${s.annee}`}</a>
        </span>
      ))}
    </>
  );
}

// Symboles propres à cet axe (■ □ ?), distincts de ceux des niveaux d'indicateur : la couleur ne porte jamais seule
// l'information, et un symbole d'indicateur ne doit pas être réutilisé ici pour dire autre chose.
function ConstatIntegriteTexte({ integrite }: { integrite: ConstatIntegrite }) {
  if (integrite.etat === "non_verifie") {
    return (
      <p>
        <span aria-hidden="true">? </span>
        <strong>Condamnations définitives : non vérifiées par cet outil</strong>, faute de données sourcées.
      </p>
    );
  }
  if (integrite.etat === "aucune_recensee") {
    return (
      <p>
        <span aria-hidden="true">□ </span>
        <strong>Aucune condamnation définitive recensée</strong>, d'après les sources consultées le {dateEnClair(integrite.verifieLe)} : <ListeSourcesIntegrite sources={integrite.sources} />.
      </p>
    );
  }
  const pluriel = integrite.condamnations.length > 1 ? "s" : "";
  return (
    <div>
      <p>
        <span aria-hidden="true">■ </span>
        <strong>Condamnation{pluriel} définitive{pluriel} recensée{pluriel}</strong> (sources consultées le {dateEnClair(integrite.verifieLe)})
      </p>
      <ul>
        {integrite.condamnations.map((c, i) => (
          <li key={`${i}-${c.date_decision}-${c.nature}`}>
            {c.nature}, {c.juridiction}, décision du {dateEnClair(c.date_decision)} ({c.peine}). <ListeSourcesIntegrite sources={c.sources} />
          </li>
        ))}
      </ul>
    </div>
  );
}

// Mots propres à cet axe : on parle de proximité avec la position choisie, pas d'« amélioration » d'une situation.
const MOTS_POSITION = { ameliorant: { symbole: "▲", libelle: "proche de votre position" }, mixte: { symbole: "◆", libelle: "mixte" }, degradant: { symbole: "▼", libelle: "opposé à votre position" } } as const;

// Constat d'UN sujet choisi : niveau (mot + symbole) et, en « Pourquoi ? », les mesures étiquetées avec leur extrait.
function ConstatSujet({ sujetId, positionId, propositions }: { sujetId: string; positionId: string; propositions: Proposition[] }) {
  const sujet = trouverSujet(sujetId);
  const position = trouverPosition(sujetId, positionId);
  if (!sujet || !position) return null;
  const constat = projeterPosition(sujetId, positionId, propositions);
  return (
    <li>
      {sujet.libelle} : {position.libelle} —{" "}
      {constat.niveau ? (
        <>
          <span aria-hidden="true">{MOTS_POSITION[constat.niveau].symbole}</span> <strong>{MOTS_POSITION[constat.niveau].libelle}</strong>
        </>
      ) : (
        <strong>pas de mesure sur ce sujet</strong>
      )}
      {constat.retenues.length > 0 && (
        <details className="pourquoi">
          <summary>Pourquoi ?</summary>
          <ul>
            {constat.retenues.map(({ propositionId, etiquette, conforme }, index) => (
              <li key={`${propositionId}-${index}`}>
                <strong>{propositions.find((p) => p.id === propositionId)?.titre ?? propositionId}</strong>
                <br />
                Défend « {trouverPosition(etiquette.sujet, etiquette.position)?.libelle} » — {conforme ? "proche de votre position" : "opposé à votre position"}.
                <br />
                <q>{etiquette.extrait}</q>
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}

// Panneau du détail d'un candidat : un constat par sujet choisi, sans score. `integrite` est null quand les faits
// d'intégrité ne doivent pas s'afficher (option désactivée, ou mode aveugle : un casier identifie le candidat).
export function PanneauConvictions({ propositions, convictions, integrite }: { propositions: Proposition[]; convictions: Convictions; integrite: ConstatIntegrite | null }) {
  const choix = Object.entries(convictions.positions).filter(([sujet, position]) => trouverPosition(sujet, position));
  if (choix.length === 0 && !integrite) return null;
  return (
    <section className="panneau-convictions" aria-label="Convictions">
      {choix.length > 0 && (
        <>
          <p>
            <strong>Vos convictions</strong>, sujet par sujet :
          </p>
          <ul>
            {choix.map(([sujet, position]) => (
              <ConstatSujet key={sujet} sujetId={sujet} positionId={position} propositions={propositions} />
            ))}
          </ul>
        </>
      )}
      {integrite && <ConstatIntegriteTexte integrite={integrite} />}
    </section>
  );
}