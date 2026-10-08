import { useEffect, useMemo, useState } from "react";
import type { BaseCharge } from "../data/bases";
import { trouverPosition, trouverSujet } from "../positions";
import { ELECTORATS, simuler, type Electorat, type ResultatBase } from "../simulation/electorats";
import { formaterGagnants, formaterSuivants } from "../simulation/format";
import { cleVerdict, lireVerdicts, memoriserVerdicts, type Verdict, type VerdictNote } from "./memoireVerdicts";

// Page de contrôle d'une base : des électorats types (situation + convictions) passent dans le calcul EXACT de la page de
// résultat, et le porteur du projet juge si le candidat désigné correspond à ce qu'on attendrait. Chaque base a son propre
// découpage (questions, mesures étiquetées) : les tests se font base par base, la base est celle du menu.

type Classement = NonNullable<ResultatBase["situation"]>;

function Resultat({ titre, resultat, vide }: { titre: string; resultat: Classement | null; vide: string }) {
  return (
    <div className="test-resultat">
      <h4>{titre}</h4>
      {resultat ? (
        <>
          <p className="test-gagnants">{formaterGagnants(resultat.gagnants, resultat.departageable)}</p>
          <p className="hint">Suivants : {formaterSuivants(resultat.suivants)}</p>
        </>
      ) : (
        <p className="hint">{vide}</p>
      )}
    </div>
  );
}

function CarteElectorat({ electorat, base, valeur, onChange }: { electorat: Electorat; base: BaseCharge; valeur: VerdictNote; onChange: (v: VerdictNote) => void }) {
  const resultat = useMemo(() => simuler(electorat, base.info.id), [electorat, base.info.id]);
  const positions = Object.entries(electorat.convictions)
    .filter(([, p]) => p !== "")
    .map(([sujet, position]) => `${trouverSujet(sujet)?.libelle ?? `?${sujet}`} → ${trouverPosition(sujet, position)?.libelle ?? `?${position}`}`);
  const reponses = Object.entries(electorat.reponses).map(([k, v]) => `${k} = ${Array.isArray(v) ? v.join(", ") : v}`);
  return (
    <article className="test-electorat" data-verdict={valeur.verdict || undefined}>
      <h3>{electorat.nom}</h3>
      <p>{electorat.description}</p>
      <div className="test-resultats">
        <Resultat titre="Selon la situation" resultat={resultat.situation} vide="Aucun résultat." />
        <Resultat titre="Selon les convictions" resultat={resultat.convictions} vide="Aucun résultat (aucune mesure étiquetée sur ces sujets)." />
      </div>
      <fieldset className="test-verdict">
        <legend>Verdict</legend>
        {([["conforme", "Conforme à l'attendu"], ["a-revoir", "À revoir"]] as [Verdict, string][]).map(([v, libelle]) => (
          <label key={v}>
            <input type="radio" name={`verdict-${electorat.id}`} checked={valeur.verdict === v} onChange={() => onChange({ ...valeur, verdict: v })} /> {libelle}
          </label>
        ))}
        <label className="test-note">
          Remarque
          <textarea rows={2} value={valeur.note} onChange={(e) => onChange({ ...valeur, note: e.target.value })} />
        </label>
      </fieldset>
      <details>
        <summary>Profil simulé ({resultat.reponsesRetenues} réponses retenues dans cette base)</summary>
        <p><strong>Réponses au formulaire :</strong> {reponses.join(" · ")}</p>
        <p><strong>Convictions :</strong> {positions.join(" · ")}</p>
      </details>
    </article>
  );
}

export default function PageTestsSituations({ base }: { base: BaseCharge }) {
  const [verdicts, setVerdicts] = useState<Record<string, VerdictNote>>(lireVerdicts);
  useEffect(() => memoriserVerdicts(verdicts), [verdicts]);
  const vide: VerdictNote = { verdict: "", note: "" };
  const jugés = ELECTORATS.filter((e) => verdicts[cleVerdict(base.info.id, e.id)]?.verdict).length;
  return (
    <section className="tests-situations">
      <h1>Tests de situations</h1>
      <p>
        Base testée : <strong>{base.info.libelle}</strong>. Chaque situation type passe dans le calcul exact de la page de résultat ; dites si le candidat désigné est celui
        qu'on attendrait. Vos verdicts sont gardés dans ce navigateur, pour chaque base.
      </p>
      <p className="hint">
        Lecture : « Nom (+score = N pour − M contre, sur K) ». Le score compte les thèmes (situation) ou les croisements sujet × thème (convictions) favorables moins
        défavorables ; K, ceux où le candidat a un résultat. {jugés} situation(s) jugée(s) sur {ELECTORATS.length}.
      </p>
      {ELECTORATS.map((electorat) => {
        const cle = cleVerdict(base.info.id, electorat.id);
        return <CarteElectorat key={cle} electorat={electorat} base={base} valeur={verdicts[cle] ?? vide} onChange={(v) => setVerdicts((p) => ({ ...p, [cle]: v }))} />;
      })}
    </section>
  );
}
