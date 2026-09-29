import { GROUPES_SOCIAUX } from "../convictions";
import type { ConstatIntegrite } from "../data/integrite";
import { projeterConviction } from "../engine/convictions";
import type { Proposition } from "../types";
import { aDesConvictions, CONVICTIONS_VIDES, type Convictions } from "./memoireConvictions";
import { NIVEAUX } from "./projection";

// Bloc de questions « Mes convictions » : facultatif, séparé de « Ma situation » (aucun score, aucun classement).
export function BlocConvictions({ convictions, onChange, aveugle }: { convictions: Convictions; onChange: (c: Convictions) => void; aveugle: boolean }) {
  const basculer = (id: string, coche: boolean) =>
    onChange({ ...convictions, groupes: coche ? [...convictions.groupes, id] : convictions.groupes.filter((g) => g !== id) });
  return (
    <section className="convictions" aria-label="Mes convictions">
      <h2>Mes convictions</h2>
      <p className="hint">
        Facultatif. Ces choix s'affichent à part, dans le détail de chaque candidat : ils ne changent pas les indicateurs « Ma situation ». Elles sont gardées dans votre navigateur tant que vous ne les effacez pas.
      </p>
      <fieldset>
        <legend>Je veux un candidat dont les mesures améliorent la situation de :</legend>
        {GROUPES_SOCIAUX.map((g) => (
          <label key={g.id} className="case">
            <input type="checkbox" checked={convictions.groupes.includes(g.id)} onChange={(e) => basculer(g.id, e.target.checked)} />
            {g.libelle}
          </label>
        ))}
      </fieldset>
      <label className="interrupteur">
        <input type="checkbox" role="switch" checked={convictions.exemplarite} onChange={(e) => onChange({ ...convictions, exemplarite: e.target.checked })} />
        <span className="interrupteur-piste" aria-hidden="true" />
        Je tiens à un candidat sans condamnation définitive
      </label>
      {aveugle && convictions.exemplarite && <p className="hint">Les faits d'intégrité sont masqués tant que les candidats sont masqués.</p>}
      {aDesConvictions(convictions) && (
        <button type="button" className="secondaire" onClick={() => onChange(CONVICTIONS_VIDES)}>
          Effacer mes convictions
        </button>
      )}
    </section>
  );
}

function ListeSourcesIntegrite({ sources }: { sources: Array<{ nom: string; annee: number; url: string }> }) {
  return (
    <>
      {sources.map((s, i) => (
        <span key={s.url}>
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
        <strong>Intégrité non vérifiée</strong> : aucune donnée sourcée pour ce candidat.
      </p>
    );
  }
  if (integrite.etat === "aucune_recensee") {
    return (
      <p>
        <span aria-hidden="true">□ </span>
        <strong>Aucune condamnation définitive recensée</strong>, d'après les sources consultées le {integrite.verifieLe} : <ListeSourcesIntegrite sources={integrite.sources} />.
      </p>
    );
  }
  return (
    <div>
      <p>
        <span aria-hidden="true">■ </span>
        <strong>Condamnation définitive recensée</strong> (sources consultées le {integrite.verifieLe})
      </p>
      <ul>
        {integrite.condamnations.map((c) => (
          <li key={`${c.date_decision}-${c.nature}`}>
            {c.nature}, {c.juridiction}, décision du {c.date_decision} ({c.peine}). <ListeSourcesIntegrite sources={c.sources} />
          </li>
        ))}
      </ul>
    </div>
  );
}

// Panneau du détail d'un candidat : deux constats séparés, sans score. `integrite` est null quand les faits d'intégrité
// ne doivent pas s'afficher (option désactivée, ou mode aveugle : un casier identifie le candidat).
export function PanneauConvictions({ propositions, convictions, integrite }: { propositions: Proposition[]; convictions: Convictions; integrite: ConstatIntegrite | null }) {
  const groupes = GROUPES_SOCIAUX.filter((g) => convictions.groupes.includes(g.id));
  const social = groupes.length > 0 ? projeterConviction(groupes, propositions) : null;
  if (!social && !integrite) return null;
  return (
    <section className="panneau-convictions" aria-label="Convictions">
      {social && (
        <p>
          <strong>Valeurs sociales :</strong>{" "}
          {social.niveau ? (
            <>
              <span aria-hidden="true">{NIVEAUX[social.niveau].symbole}</span> {NIVEAUX[social.niveau].libelle} pour les groupes que vous avez choisis.
            </>
          ) : (
            "Pas d'indicateur : les mesures de ce thème ne permettent pas de conclure pour ces groupes."
          )}
        </p>
      )}
      {integrite && <ConstatIntegriteTexte integrite={integrite} />}
    </section>
  );
}
