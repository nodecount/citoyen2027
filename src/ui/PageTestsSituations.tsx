import { useEffect, useMemo, useState } from "react";
import type { BaseCharge } from "../data/bases";
import { trouverPosition, trouverSujet } from "../positions";
import type { Prisme } from "../engine/candidatIdeal";
import { ELECTORATS, simuler, type Classement, type Electorat, type ResultatBase, type SelonPrismes } from "../simulation/electorats";
import { formaterGagnants, formaterSuivants } from "../simulation/format";
import { cleVerdict, lireVerdicts, memoriserVerdicts, type Verdict, type VerdictNote } from "./memoireVerdicts";

// Page de contrôle d'une base : des électorats types (situation + convictions) passent dans le calcul EXACT de la page de
// résultat, et le porteur du projet juge si le candidat désigné correspond à ce qu'on attendrait. Chaque base a son propre
// découpage (questions, mesures étiquetées) : les tests se font base par base, la base est celle du menu.

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

const PRISMES: Array<{ id: Prisme; libelle: string }> = [
  { id: "themes", libelle: "Thèmes (règle actuelle)" },
  { id: "groupes", libelle: "Groupes de mesures" },
  { id: "mesures", libelle: "Mesures" },
];
const BLOCS = [
  { id: "situation", libelle: "Situation" },
  { id: "convictions", libelle: "Convictions" },
  { id: "combine", libelle: "Candidat idéal (situation + convictions)" },
] as const;

// Les gagnants d'un classement, en une clé comparable d'un prisme à l'autre (égalité parfaite à 0 : aucun gagnant).
const cle = (c: Classement | null) => (!c ? "—" : !c.departageable ? "aucun ne se détache" : c.gagnants.map((g) => g.nom).sort().join(" + "));

function TableauPrismes({ resultat }: { resultat: ResultatBase["prismes"] }) {
  return (
    <div className="test-prismes">
      <h4>Le même résultat, compté de trois façons</h4>
      {BLOCS.map((b) => {
        const lignes = resultat[b.id];
        if (!lignes) return null;
        const identiques = cle(lignes.themes) === cle(lignes.groupes) && cle(lignes.themes) === cle(lignes.mesures);
        return (
          <table key={b.id} className="test-prisme">
            <caption>
              {b.libelle} : <strong>{identiques ? "même candidat avec les trois comptes" : "résultats différents selon le compte"}</strong>
            </caption>
            <thead>
              <tr>
                <th scope="col">Compte</th>
                <th scope="col">Candidat(s) désigné(s)</th>
                <th scope="col">Suivants</th>
              </tr>
            </thead>
            <tbody>
              {PRISMES.map((p) => {
                const c = lignes[p.id];
                return (
                  <tr key={p.id}>
                    <th scope="row">{p.libelle}</th>
                    <td>{c ? formaterGagnants(c.gagnants, c.departageable) : "Aucun résultat."}</td>
                    <td>{c ? formaterSuivants(c.suivants) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        );
      })}
    </div>
  );
}

function BilanPrismes({ base }: { base: BaseCharge }) {
  const bilan = useMemo(() => {
    const lignes = ELECTORATS.map((e) => simuler(e, base.info.id).prismes);
    return BLOCS.map((b) => {
      const pris = lignes.map((l) => l[b.id]).filter((l): l is SelonPrismes => l !== null);
      const memes = (autre: Prisme) => pris.filter((l) => cle(l.themes) === cle(l[autre])).length;
      return { ...b, total: pris.length, groupes: memes("groupes"), mesures: memes("mesures") };
    });
  }, [base.info.id]);
  return (
    <table className="test-prisme test-bilan">
      <caption>Bilan : sur combien de situations le compte donne le même candidat que celui par thèmes</caption>
      <thead>
        <tr>
          <th scope="col">Résultat</th>
          <th scope="col">Situations</th>
          <th scope="col">Groupes de mesures</th>
          <th scope="col">Mesures</th>
        </tr>
      </thead>
      <tbody>
        {bilan.map((b) => (
          <tr key={b.id}>
            <th scope="row">{b.libelle}</th>
            <td>{b.total}</td>
            <td>{b.groupes} sur {b.total}</td>
            <td>{b.mesures} sur {b.total}</td>
          </tr>
        ))}
      </tbody>
    </table>
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
      <TableauPrismes resultat={resultat.prismes} />
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
      <BilanPrismes base={base} />
      {ELECTORATS.map((electorat) => {
        const cle = cleVerdict(base.info.id, electorat.id);
        return <CarteElectorat key={cle} electorat={electorat} base={base} valeur={verdicts[cle] ?? vide} onChange={(v) => setVerdicts((p) => ({ ...p, [cle]: v }))} />;
      })}
    </section>
  );
}
