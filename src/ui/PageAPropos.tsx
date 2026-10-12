import { Camera, Database, Lock, Scale, TriangleAlert, Workflow } from "lucide-react";
import type { InfoBase } from "../data/bases";
import { Pastille, PORTRAITS } from "./Pastille";
import SchemaTraitement from "./SchemaTraitement";

interface PageAProposProps {
  bases: InfoBase[];
  nomsParSlug: Record<string, string>;
}

// Page « À propos » : ce qui n'aide pas directement à choisir, mais qu'un site doit dire quelque part — une seule fois.
// Une section = un bloc avec son icône.
export default function PageAPropos({ bases, nomsParSlug }: PageAProposProps) {
  // Seuls les portraits des candidats présents dans une base sont crédités (un candidat retiré de la source n'a plus de photo affichée).
  const credits = Object.entries(PORTRAITS)
    .filter(([slug]) => slug in nomsParSlug)
    .sort(([a], [b]) => a.localeCompare(b));
  return (
    <section className="a-propos">
      <div className="sections-a-propos">
        <article className="bloc-a-propos">
          <Scale aria-hidden="true" />
          <h2>Indépendant</h2>
          <p>Aucun lien avec un parti ou un candidat.</p>
          <p>Les candidats sont toujours présentés par ordre alphabétique.</p>
        </article>

        <article className="bloc-a-propos">
          <Database aria-hidden="true" />
          <h2>D'où viennent les données</h2>
          <ul>
            {bases.map((base) => (
              <li key={base.id}>
                <strong>{base.libelle}</strong> : {base.description}
              </li>
            ))}
          </ul>
          <p>Chaque mesure renvoie à sa source.</p>
        </article>

        <article className="bloc-a-propos">
          <Lock aria-hidden="true" />
          <h2>Vos données</h2>
          <p>Vos réponses restent dans votre navigateur.</p>
          <p>Rien n'est envoyé ni enregistré.</p>
        </article>
      </div>

      <article className="bloc-a-propos bloc-limites">
        <TriangleAlert aria-hidden="true" />
        <h2>Limites et partis pris</h2>
        <p>Le simulateur aide à lire les programmes. Il ne dit pas pour qui voter.</p>
        <h3>Ce que nous vous demandons</h3>
        <ul>
          <li>Nous posons des questions par tranches (âge, revenus, patrimoine), jamais votre situation au centime.</li>
          <li>C'est un juste milieu : plus de détails demanderaient plus de temps et seraient plus intrusifs.</li>
          <li>Conséquence : certains effets ne peuvent pas être mesurés précisément. Quand nous ne pouvons pas trancher, nous l'écrivons plutôt que de deviner.</li>
        </ul>
        <h3>Ce que nous calculons</h3>
        <ul>
          <li>Nous ne chiffrons pas en euros : sans chiffres précis dans les programmes, un montant serait inventé.</li>
          <li>Nous retenons seulement l'effet direct d'une mesure sur vous, pas ses conséquences sur l'économie.</li>
          <li>Le score d'un candidat est le nombre de mesures qui améliorent votre situation, moins le nombre de mesures qui la dégradent. Il n'y a ni pourcentage ni pondération.</li>
          <li>Un candidat qui propose plus de mesures qui vous avantagent obtient donc un meilleur score : c'est un parti pris assumé.</li>
          <li>Pour la lecture, le score des classements est noté sur 100 : 100 correspond au plus grand nombre de mesures qui touchent votre situation (favorables ou défavorables) chez un seul candidat, et un score nul ou négatif s'affiche 0. Le classement, lui, suit le score brut.</li>
          <li>Cette note dépend donc de vos réponses : 100 signifie que toutes les mesures qui vous concernent chez le candidat qui en a le plus sont à votre avantage. Ce n'est pas une probabilité de convenir, et deux visiteurs ne comparent pas leurs notes.</li>
          <li>Une grande mesure et une petite mesure comptent chacune pour une. Aucun thème ne pèse plus qu'un autre.</li>
        </ul>
        <h3>Ce qui reste à vous</h3>
        <ul>
          <li>Le candidat idéal est une suggestion. C'est à vous de peser les mesures qui comptent le plus pour vous, en les lisant.</li>
          <li>Vos convictions sont rattachées aux mesures par une méthode automatique, avec une seconde lecture. Elles n'ont pas encore été relues une à une par une personne.</li>
          <li>Un candidat dont les mesures ne sont pas encore intégrées ne peut pas ressortir : le résultat dépend de ce qui est publié et de ce qui a été traité à ce jour.</li>
        </ul>
      </article>

      <article className="bloc-a-propos bloc-schema">
        <Workflow aria-hidden="true" />
        <h2>Comment les mesures sont traitées</h2>
        <p>Chaque étape dit qui agit : le code, ou un modèle d'IA que le code contrôle.</p>
        <SchemaTraitement />
      </article>

      <article className="bloc-a-propos bloc-credits">
        <Camera aria-hidden="true" />
        <h2>Crédits photos</h2>
        <p>Photos sous licence libre, via Wikimedia Commons.</p>
        <ul className="liste-credits">
          {credits.map(([slug, p]) => (
            <li key={slug}>
              <Pastille slug={slug} nom={nomsParSlug[slug] ?? slug} className="pastille--petite" />
              <span>
                <strong>{nomsParSlug[slug] ?? slug}</strong>
                <span className="credit-detail">
                  {p.auteur} ·{" "}
                  <a href={p.licence_url || p.source_url} target="_blank" rel="noopener noreferrer">
                    {p.licence}
                  </a>{" "}
                  ·{" "}
                  <a href={p.source_url} target="_blank" rel="noopener noreferrer">
                    source
                  </a>
                </span>
              </span>
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}
