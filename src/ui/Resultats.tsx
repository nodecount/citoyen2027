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
      {candidats.map(({ meta, propositions }) => (
        <article key={meta.slug}>
          <h2>{meta.nom}</h2>
          {themesTypes.map((theme) => {
            const propsCompletesDuTheme = propositions.filter(
              (p) => p.theme === theme.id && p.statut === "complet"
            );
            return (
              <div key={theme.id}>
                <h3>{theme.libelle}</h3>
                {propsCompletesDuTheme.length === 0 ? (
                  <p>Programme en cours d'analyse sur ce thème.</p>
                ) : (
                  <ul>
                    {propsCompletesDuTheme.map((proposition) => {
                      const impact = evaluerProposition(profil, proposition);
                      return (
                        <li key={proposition.id}>
                          <strong>{proposition.titre}</strong>
                          <p>{impact.explication}</p>
                          {impact.niveau === "chiffre_personnalise" && impact.montant_estime !== undefined && (
                            <p>Estimation pour votre profil : {impact.montant_estime} €/an</p>
                          )}
                          {!impact.concerne && (
                            <p>
                              <em>Cette mesure ne s'applique pas à votre profil.</em>
                            </p>
                          )}
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
