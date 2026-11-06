import { useEffect, useState } from "react";
import { candidatsDeBase, type BaseCharge } from "../data/bases";
import { ProgrammesSansMesure } from "./ProgrammesSansMesure";
import { indicateursBase } from "./monitoring/indicateurs";
import { calculerCouverture, type CouvertureCandidat } from "./monitoring/couverture";
import type { RequeteRelance, ResultatRelance } from "../ingestion/serveur-local";

const URL_SERVEUR_LOCAL = "http://localhost:5175";
// Le pipeline d'ingestion par API n'alimente que la base « officielle » : la relance n'est proposée que pour elle.
const BASE_DU_PIPELINE = "officielle";

type ModeRelance = "insert" | "update";

// Formate le détail d'un résultat de relance — la spec exige d'afficher les combinaisons
// fusionnées/en attente/la divergence détectée, pas seulement le statut brut (indispensable en
// mode update : sans ça, "divergence détectée" et "inchangé" rendent le même texte à l'écran).
function decrireResultat(r: {
  statut: "traite" | "saute" | "erreur";
  fusionnees?: number;
  enAttente?: number;
  divergence?: boolean;
  message?: string;
}): string {
  if (r.statut === "erreur") return `erreur : ${r.message ?? "inconnue"}`;
  if (r.statut === "saute") return "déjà couvert, sauté";
  if (r.fusionnees !== undefined) return `${r.fusionnees} fusionnée(s), ${r.enAttente} en attente`;
  if (r.divergence !== undefined) return r.divergence ? "divergence détectée, voir _a-verifier.json" : "inchangé";
  return "traité";
}

export default function Monitoring({ base }: { base: BaseCharge }) {
  const themes = base.themes;
  const kpi = indicateursBase(base);
  const couverture: CouvertureCandidat[] = calculerCouverture(themes, base.metas, base.propositions, base.aVerifier);

  const [serveurDisponible, setServeurDisponible] = useState(false);
  useEffect(() => {
    let annule = false;
    fetch(`${URL_SERVEUR_LOCAL}/api/sante`, { signal: AbortSignal.timeout(2000) })
      .then((reponse) => {
        if (!annule) setServeurDisponible(reponse.ok);
      })
      .catch(() => {
        if (!annule) setServeurDisponible(false);
      });
    return () => {
      annule = true;
    };
  }, []);

  const [slugSelectionne, setSlugSelectionne] = useState<string>(couverture[0]?.slug ?? "");
  const [themesSelectionnes, setThemesSelectionnes] = useState<string[]>([]);
  const [mode, setMode] = useState<ModeRelance>("insert");
  const [cleApi, setCleApi] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [resultats, setResultats] = useState<ResultatRelance["resultats"] | null>(null);
  const [erreurRelance, setErreurRelance] = useState<string | null>(null);

  function basculerTheme(themeId: string): void {
    setThemesSelectionnes((precedent) =>
      precedent.includes(themeId) ? precedent.filter((t) => t !== themeId) : [...precedent, themeId],
    );
  }

  async function lancerRelance(): Promise<void> {
    setEnCours(true);
    setErreurRelance(null);
    setResultats(null);
    const requete: RequeteRelance = { slug: slugSelectionne, themes: themesSelectionnes, mode, cleApi };
    try {
      const reponse = await fetch(`${URL_SERVEUR_LOCAL}/api/relancer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requete),
      });
      const corps = (await reponse.json()) as ResultatRelance & { message?: string };
      if (!reponse.ok) {
        setErreurRelance(corps.message ?? "Erreur inconnue du serveur local");
      } else {
        setResultats(corps.resultats);
      }
    } catch {
      setErreurRelance("Impossible de joindre le serveur local (localhost:5175). Vérifie qu'il est lancé.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <section className="monitoring">
      <h1>Monitoring du pipeline d'ingestion</h1>
      <p>Base affichée : {base.info.libelle}.</p>
      <ul className="kpis">
        {[
          [`${kpi.candidatsAvecMesures} / ${kpi.candidatsTotal}`, "candidats avec des mesures"],
          [String(kpi.themes), "thèmes"],
          [String(kpi.mesures), "mesures"],
          [String(kpi.mesuresAvecEffets), "mesures avec des effets"],
          [String(kpi.mesuresAvecPosition), "mesures avec une position de convictions"],
        ].map(([valeur, libelle]) => (
          <li className="kpi" key={libelle}>
            <strong>{valeur}</strong>
            <span>{libelle}</span>
          </li>
        ))}
      </ul>
      <ProgrammesSansMesure noms={candidatsDeBase(base).enCoursAnalyse.map((m) => m.nom)} />

      {couverture.length === 0 && <p>Aucune donnée de candidat trouvée dans data/bases/{base.info.id}/programmes/.</p>}

      {couverture.map((candidat) => (
        <div className="monitoring-candidat" key={candidat.slug}>
          <h2>
            {candidat.nom} <span className="monitoring-date">— meta.json mis à jour le {candidat.dateDerniereMaj}</span>
          </h2>
          <table className="monitoring-grille">
            <thead>
              <tr>
                <th>Thème</th>
                <th>Complet</th>
                <th>Partiel</th>
                <th>Provisoire</th>
                <th>Dernière vérification</th>
              </tr>
            </thead>
            <tbody>
              {candidat.parTheme.map((theme) => (
                <tr key={theme.themeId}>
                  <td>{theme.libelle}</td>
                  <td>{theme.parStatut.complet}</td>
                  <td>{theme.parStatut.partiel}</td>
                  <td>{theme.parStatut.provisoire}</td>
                  <td>{theme.dateVerificationRecente ?? "aucune donnée"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {candidat.enAttente.length > 0 && (
            <div className="monitoring-en-attente">
              <p className="monitoring-badge">Non relu, non vérifié — {candidat.enAttente.length} en attente</p>
              <ul>
                {candidat.enAttente.map((entree, index) => (
                  <li key={index}>
                    <strong>{entree.theme}</strong> — {entree.proposition.titre} : {entree.raison}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}

      {base.info.id !== BASE_DU_PIPELINE && (
        <p className="monitoring-badge">
          Cette base n'est pas alimentée par le pipeline d'ingestion par API : choisir la base « officielle » pour le relancer.
        </p>
      )}
      <div className="monitoring-relance" hidden={base.info.id !== BASE_DU_PIPELINE}>
        <h2>Relancer le pipeline</h2>
        {!serveurDisponible && (
          <p className="monitoring-badge">Disponible en local uniquement — serveur non détecté sur localhost:5175.</p>
        )}
        {serveurDisponible && (
          <>
            <label>
              Candidat
              <select value={slugSelectionne} onChange={(e) => setSlugSelectionne(e.target.value)}>
                {couverture.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.nom}
                  </option>
                ))}
              </select>
            </label>
            <fieldset>
              <legend>Thèmes</legend>
              {themes.map((theme) => (
                <label key={theme.id}>
                  <input
                    type="checkbox"
                    checked={themesSelectionnes.includes(theme.id)}
                    onChange={() => basculerTheme(theme.id)}
                  />
                  {theme.libelle}
                </label>
              ))}
            </fieldset>
            <fieldset>
              <legend>Mode</legend>
              <label>
                <input type="radio" name="mode" checked={mode === "insert"} onChange={() => setMode("insert")} />
                Insert (génère les combinaisons manquantes, saute celles déjà couvertes)
              </label>
              <label>
                <input type="radio" name="mode" checked={mode === "update"} onChange={() => setMode("update")} />
                Update (revérifie les combinaisons déjà couvertes, écrit les divergences dans _a-verifier.json)
              </label>
            </fieldset>
            <label>
              Clé API Claude (reste sur ta machine, jamais envoyée ailleurs qu'au serveur local)
              <input type="password" value={cleApi} onChange={(e) => setCleApi(e.target.value)} />
            </label>
            <button type="button" disabled={enCours || themesSelectionnes.length === 0 || !cleApi} onClick={lancerRelance}>
              {enCours ? "En cours..." : "Relancer"}
            </button>
            {erreurRelance && <p className="monitoring-erreur">{erreurRelance}</p>}
            {resultats && (
              <ul>
                {resultats.map((r) => (
                  <li key={r.theme}>
                    {r.theme} — {r.statut} : {decrireResultat(r)}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  );
}
