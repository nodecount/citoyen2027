import themes from "../../data/themes.json";
import lePenMeta from "../../data/programmes/le-pen/meta.json";
import lePenProps from "../../data/programmes/le-pen/propositions.json";
import melenchonMeta from "../../data/programmes/melenchon/meta.json";
import melenchonProps from "../../data/programmes/melenchon/propositions.json";
import philippeMeta from "../../data/programmes/philippe/meta.json";
import philippeProps from "../../data/programmes/philippe/propositions.json";
import type { CandidatMeta, Profil, Proposition, Theme } from "../types";
import { evaluerProposition } from "../engine";

const themesTypes: Theme[] = themes as Theme[];

const candidats: { meta: CandidatMeta; propositions: Proposition[] }[] = [
  { meta: lePenMeta as CandidatMeta, propositions: lePenProps as Proposition[] },
  { meta: melenchonMeta as CandidatMeta, propositions: melenchonProps as Proposition[] },
  { meta: philippeMeta as CandidatMeta, propositions: philippeProps as Proposition[] },
].sort((a, b) => a.meta.slug.localeCompare(b.meta.slug));

interface ResultatsProps {
  profil: Profil;
}

export default function Resultats({ profil }: ResultatsProps) {
  return (
    <section>
      <h1>Résultats</h1>
      <p className="avertissement">
        Ces données ont été collectées et sourcées par un assistant IA — chaque source a été
        vérifiée individuellement, mais l'ensemble n'a pas encore été relu ni validé par l'équipe
        du projet. Considérez ceci comme une première version, pas un résultat définitif.
      </p>
      {candidats.map(({ meta, propositions }) => (
        <article key={meta.slug}>
          <h2>{meta.nom}</h2>
          {themesTypes.map((theme) => {
            const propsDuTheme = propositions.filter(
              (p) => p.theme === theme.id && (p.statut === "complet" || p.statut === "partiel")
            );
            return (
              <div key={theme.id}>
                <h3>{theme.libelle}</h3>
                {propsDuTheme.length === 0 ? (
                  <p>Programme en cours d'analyse sur ce thème.</p>
                ) : (
                  <ul>
                    {propsDuTheme.map((proposition) => {
                      const impact = evaluerProposition(profil, proposition);
                      return (
                        <li key={proposition.id}>
                          <strong>{proposition.titre}</strong>
                          {proposition.statut === "partiel" && (
                            <span className="badge-partiel"> (sourcing partiel — à confirmer)</span>
                          )}
                          <p>{impact.explication}</p>
                          {impact.niveau === "chiffre_personnalise" && impact.montant_estime !== undefined && (
                            <p>Estimation pour votre profil : {impact.montant_estime} €/an</p>
                          )}
                          {!impact.concerne && (
                            <p>
                              <em>Cette mesure ne s'applique pas à votre profil.</em>
                            </p>
                          )}
                          <ul className="sources">
                            {proposition.sources.map((source, index) => (
                              <li key={index}>
                                <span className="source-type">
                                  {source.type === "primaire" ? "Source primaire" : "Source secondaire"}
                                </span>{" "}
                                :{" "}
                                <a href={source.url} target="_blank" rel="noopener noreferrer">
                                  {source.label}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </article>
      ))}
    </section>
  );
}
