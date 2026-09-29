import { useState } from "react";
import { GROUPES_SOCIAUX } from "../convictions";
import { constatIntegrite, INTEGRITES, type ConstatIntegrite, type Integrite } from "../data/integrite";
import { projeterConviction } from "../engine/convictions";
import type { Proposition } from "../types";
import { aDesConvictions, CONVICTIONS_VIDES, type Convictions } from "./memoireConvictions";
import { ModaleConfirmation } from "./ModaleConfirmation";
import { decrireEffet, NIVEAUX } from "./projection";

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

// Rubriques dans l'ordre du catalogue (généré depuis le schéma du formulaire : aucun public n'est mis en avant).
const RUBRIQUES = [...new Set(GROUPES_SOCIAUX.map((g) => g.rubrique))];

// Bloc de questions « Mes convictions » : facultatif, séparé de « Ma situation » (aucun score, aucun classement).
export function BlocConvictions({ convictions, onChange, aveugle }: { convictions: Convictions; onChange: (c: Convictions) => void; aveugle: boolean }) {
  const basculer = (id: string, coche: boolean) =>
    onChange({ ...convictions, groupes: coche ? [...convictions.groupes, id] : convictions.groupes.filter((g) => g !== id) });
  const [confirmerEffacement, setConfirmerEffacement] = useState(false);
  return (
    <section className="convictions" aria-label="Mes convictions">
      <h2>Mes convictions</h2>
      <p className="hint">
        Facultatif. Ces choix s'affichent à part, dans le détail de chaque candidat : ils ne changent pas les indicateurs « Ma situation ». Ils sont gardés dans votre navigateur tant que vous ne les effacez pas.
      </p>
      <p className="hint">
        Repères : ▲ améliorant, ◆ mixte, ○ non concerné, ▼ dégradant, pour les groupes choisis, pas pour vous. Intégrité : ■ condamnation recensée, □ aucune recensée, ? non vérifié.
      </p>
      <p className="question-convictions">Je veux un candidat dont les mesures améliorent la situation de :</p>
      {RUBRIQUES.map((rubrique) => (
        <fieldset key={rubrique}>
          <legend>{rubrique}</legend>
          {GROUPES_SOCIAUX.filter((g) => g.rubrique === rubrique).map((g) => (
            <label key={g.id} className="case">
              <input type="checkbox" checked={convictions.groupes.includes(g.id)} onChange={(e) => basculer(g.id, e.target.checked)} />
              {g.libelle}
            </label>
          ))}
        </fieldset>
      ))}
      <label className="interrupteur">
        <input type="checkbox" role="switch" checked={convictions.exemplarite} onChange={(e) => onChange({ ...convictions, exemplarite: e.target.checked })} />
        <span className="interrupteur-piste" aria-hidden="true" />
        Je tiens à un candidat sans condamnation définitive
      </label>
      {aveugle && convictions.exemplarite && <p className="hint">Les faits d'intégrité sont masqués tant que les candidats sont masqués.</p>}
      {aDesConvictions(convictions) && (
        <button type="button" className="secondaire" onClick={() => setConfirmerEffacement(true)}>
          Effacer mes convictions
        </button>
      )}
      <ModaleConfirmation
        ouverte={confirmerEffacement}
        titre="Effacer vos convictions ?"
        message="Vos choix (groupes et intégrité) seront effacés de ce navigateur. Cette action ne peut pas être annulée."
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

// Constat « valeurs sociales » d'UN groupe : niveau (mot + symbole), mesures au public non précisé (non comptées), et
// l'explication — quelles mesures fondent le niveau, comme « Pourquoi cet indicateur ? » pour « Ma situation ».
function ConstatGroupe({ groupeId, propositions }: { groupeId: string; propositions: Proposition[] }) {
  const groupe = GROUPES_SOCIAUX.find((g) => g.id === groupeId);
  if (!groupe) return null;
  const constat = projeterConviction([groupe], propositions);
  const n = constat.effetsIncertains;
  return (
    <li>
      {groupe.rubrique} : {groupe.libelle} —{" "}
      {constat.niveau ? (
        <>
          <span aria-hidden="true">{NIVEAUX[constat.niveau].symbole}</span> <strong>{NIVEAUX[constat.niveau].libelle}</strong>
        </>
      ) : (
        <strong>pas d'indicateur</strong>
      )}
      {n > 0 && (
        <span className="hint">
          {" "}
          ({n} mesure{n > 1 ? "s" : ""} au public non précisé, non comptée{n > 1 ? "s" : ""})
        </span>
      )}
      {constat.effetsRetenus.length > 0 && (
        <details className="pourquoi">
          <summary>Pourquoi ?</summary>
          <ul>
            {constat.effetsRetenus.map(({ propositionId, effet, polarite }, index) => (
              <li key={`${propositionId}-${index}`}>
                <strong>{propositions.find((p) => p.id === propositionId)?.titre ?? propositionId}</strong>
                <br />
                {decrireEffet(effet)} — {polarite === "favorable" ? "favorable" : "défavorable"} pour ce groupe.
                <br />
                <q>{effet.extrait}</q>
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}

// Panneau du détail d'un candidat : deux constats séparés, sans score. Valeurs sociales : un constat PAR groupe choisi
// (jamais une union qui laisserait croire que tous les groupes sont servis). `integrite` est null quand les faits
// d'intégrité ne doivent pas s'afficher (option désactivée, ou mode aveugle : un casier identifie le candidat).
export function PanneauConvictions({ propositions, convictions, integrite }: { propositions: Proposition[]; convictions: Convictions; integrite: ConstatIntegrite | null }) {
  const groupes = convictions.groupes.filter((id) => GROUPES_SOCIAUX.some((g) => g.id === id));
  if (groupes.length === 0 && !integrite) return null;
  return (
    <section className="panneau-convictions" aria-label="Convictions">
      {groupes.length > 0 && (
        <>
          <p>
            <strong>Valeurs sociales</strong>, groupe par groupe :
          </p>
          <ul>
            {groupes.map((id) => (
              <ConstatGroupe key={id} groupeId={id} propositions={propositions} />
            ))}
          </ul>
        </>
      )}
      {integrite && <ConstatIntegriteTexte integrite={integrite} />}
    </section>
  );
}
