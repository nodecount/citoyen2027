import { useState } from "react";
import themes from "../../data/themes.json";
import type { Profil, Proposition, Theme } from "../types";
import { chargerCandidats } from "../data/chargerCandidats";
import { evaluerProposition } from "../engine";

const themesTypes: Theme[] = themes as Theme[];

const THEME_ICONS: Record<string, string> = {
  fiscalite: "💰",
  "pouvoir-achat": "🛒",
  travail: "💼",
  "aides-etat": "🤝",
  "libertes-fondamentales": "⚖️",
  sante: "🏥",
  securite: "🚓",
  immigration: "🛂",
  education: "🎓",
  environnement: "🌳",
  logement: "🏠",
  retraites: "👴",
};

// Thèmes dont les données sont collectées : seuls eux comptent dans le « x / N thèmes »,
// sinon aucun candidat ne pourrait atteindre N tant que certains thèmes sont encore vides.
const nombreThemesPeuples = themesTypes.filter((t) => t.statut === "populated").length;

// Chargés dynamiquement depuis data/programmes/, triés par ordre alphabétique de slug.
const { avecDonnees: candidats, enCoursAnalyse } = chargerCandidats();

interface ResultatsProps {
  profil: Profil;
}

function initiales(nom: string): string {
  return nom
    .split(" ")
    .filter((mot) => mot.length > 0)
    .map((mot) => mot[0])
    .join("")
    .toUpperCase();
}

function propositionsDuTheme(propositions: Proposition[], themeId: string): Proposition[] {
  return propositions.filter(
    (p) => p.theme === themeId && (p.statut === "complet" || p.statut === "partiel")
  );
}

export default function Resultats({ profil }: ResultatsProps) {
  // Pour chaque thème, quel candidat (slug) a sa fiche détaillée ouverte, s'il y en a un.
  const [ouvert, setOuvert] = useState<Record<string, string | null>>({});

  function basculer(themeId: string, slug: string) {
    setOuvert((precedent) => ({
      ...precedent,
      [themeId]: precedent[themeId] === slug ? null : slug,
    }));
  }

  // Calculé une seule fois pour tous les thèmes : sert à la fois au résumé en tête de page
  // et à chaque carte thème, pour ne jamais faire diverger les deux.
  const parThemeEtCandidat = themesTypes.map((theme) => ({
    theme,
    parCandidat: candidats.map(({ meta, propositions }) => {
      const props = propositionsDuTheme(propositions, theme.id);
      const impacts = props.map((proposition) => ({
        proposition,
        impact: evaluerProposition(profil, proposition),
      }));
      const concerne = impacts.some(({ impact }) => impact.concerne);
      return { meta, props, impacts, concerne };
    }),
  }));

  const nombreThemesConcerneParSlug: Record<string, number> = {};
  for (const { meta } of candidats) {
    nombreThemesConcerneParSlug[meta.slug] = parThemeEtCandidat.filter(({ parCandidat }) =>
      parCandidat.find((c) => c.meta.slug === meta.slug)?.concerne
    ).length;
  }

  return (
    <section>
      <h1>Résultats</h1>
      <p className="avertissement">
        Ces données ont été collectées et sourcées par un assistant IA — chaque source a été
        vérifiée individuellement, mais l'ensemble n'a pas encore été relu ni validé par l'équipe
        du projet. Considérez ceci comme une première version, pas un résultat définitif.
      </p>

      <div className="resume-global">
        <h2>Les programmes qui concernent votre situation personnelle</h2>
        <div className="portraits-groupe portraits-groupe--concerne">
          {candidats.map(({ meta }) => (
            <div className="portrait portrait--statique" key={meta.slug} title={meta.nom}>
              <span className="avatar">{initiales(meta.nom)}</span>
              <span className="portrait-nom">{meta.nom}</span>
              <span className="compte-themes">
                {nombreThemesConcerneParSlug[meta.slug]} / {nombreThemesPeuples} thèmes
              </span>
            </div>
          ))}
        </div>
        <p className="hint">
          Nombre de thèmes, sur {nombreThemesPeuples}, où ce candidat a au moins une mesure qui
          s'applique à votre profil tel que renseigné. Détail thème par thème ci-dessous.
        </p>
      </div>

      {enCoursAnalyse.length > 0 && (
        <p className="hint">
          Programmes pas encore analysés, donc absents des résultats ci-dessous :{" "}
          {enCoursAnalyse.map((meta) => meta.nom).join(", ")}.
        </p>
      )}

      {parThemeEtCandidat.map(({ theme, parCandidat }) => {
        const slugOuvert = ouvert[theme.id] ?? null;
        const candidatOuvert = parCandidat.find((c) => c.meta.slug === slugOuvert) ?? null;

        return (
          <div className="theme-card" key={theme.id}>
            <h2>
              <span aria-hidden="true">{THEME_ICONS[theme.id] ?? "🗳️"}</span> {theme.libelle}
            </h2>

            {candidatOuvert && (
              <div className="candidat-detail">
                <h3>{candidatOuvert.meta.nom}</h3>
                <p className="statut-texte">
                  {candidatOuvert.concerne
                    ? "Concerné pour votre profil"
                    : "Non concerné pour votre profil"}
                </p>
                {candidatOuvert.props.length === 0 ? (
                  <p>Programme en cours d'analyse sur ce thème.</p>
                ) : (
                  <ul>
                    {candidatOuvert.impacts.map(({ proposition, impact }) => (
                      <li key={proposition.id}>
                        <strong>{proposition.titre}</strong>
                        {proposition.statut === "partiel" && (
                          <span className="badge-partiel"> (sourcing partiel — à confirmer)</span>
                        )}
                        <p>{impact.explication}</p>
                        {impact.niveau === "chiffre_personnalise" &&
                          impact.montant_estime !== undefined && (
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
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="portraits-row">
              <div className="portraits-groupe portraits-groupe--concerne">
                {parCandidat
                  .filter(({ concerne }) => concerne)
                  .map(({ meta }) => (
                    <button
                      key={meta.slug}
                      type="button"
                      className="portrait"
                      aria-pressed={slugOuvert === meta.slug}
                      onClick={() => basculer(theme.id, meta.slug)}
                      title={meta.nom}
                    >
                      <span className="avatar">{initiales(meta.nom)}</span>
                      <span className="portrait-nom">{meta.nom}</span>
                    </button>
                  ))}
              </div>
              <div className="portraits-groupe portraits-groupe--non-concerne">
                {parCandidat
                  .filter(({ concerne }) => !concerne)
                  .map(({ meta }) => (
                    <button
                      key={meta.slug}
                      type="button"
                      className="portrait portrait--empile"
                      aria-pressed={slugOuvert === meta.slug}
                      onClick={() => basculer(theme.id, meta.slug)}
                      title={meta.nom}
                    >
                      <span className="avatar">{initiales(meta.nom)}</span>
                    </button>
                  ))}
              </div>
            </div>
            <p className="hint">Cliquez sur un portrait pour voir le détail de son programme.</p>
          </div>
        );
      })}
    </section>
  );
}
