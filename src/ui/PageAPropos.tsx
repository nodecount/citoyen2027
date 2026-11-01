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
          <li>Poser des questions par tranches (âge, revenus, patrimoine), jamais votre situation au centime.</li>
          <li>Choisir un juste milieu : plus de détails demanderaient plus de temps et seraient plus intrusifs.</li>
          <li>Accepter une conséquence : certains effets ne peuvent pas être mesurés précisément. Quand trancher est impossible, l'écrire plutôt que deviner.</li>
        </ul>
        <h3>Ce que nous calculons</h3>
        <ul>
          <li>Ne pas chiffrer en euros : sans chiffres précis dans les programmes, un montant serait inventé.</li>
          <li>Retenir seulement l'effet direct d'une mesure sur vous, pas ses conséquences sur l'économie.</li>
          <li>Calculer le score d'un candidat : le nombre de mesures qui améliorent votre situation, moins le nombre de mesures qui la dégradent. Il n'y a ni pourcentage ni pondération.</li>
          <li>Accorder un meilleur score à un candidat qui propose plus de mesures qui vous avantagent : c'est un parti pris assumé.</li>
          <li>Noter sur 100, pour la lecture, le score des classements : 100 correspond au plus grand nombre de mesures qui touchent votre situation (favorables ou défavorables) chez un seul candidat, et un score nul ou négatif s'affiche 0. Le classement, lui, suit le score brut.</li>
          <li>Lire cette note en tenant compte de vos réponses : 100 signifie que toutes les mesures qui vous concernent chez le candidat qui en a le plus sont à votre avantage. Ce n'est pas une probabilité de convenir, et deux visiteurs ne comparent pas leurs notes.</li>
          <li>Compter une grande mesure et une petite mesure chacune pour une. Aucun thème ne pèse plus qu'un autre.</li>
        </ul>
        <h3>Comment le candidat suggéré est calculé</h3>
        <ul>
          <li>Pour la situation, ajouter 1 point au candidat pour chaque mesure qui améliore votre situation, et lui en retirer 1 pour chaque mesure qui la dégrade. Ne pas compter une mesure qui ne vous concerne pas, et compter chaque mesure une seule fois par thème.</li>
          <li>Pour les convictions, sur chaque sujet où vous avez choisi une position, ajouter 1 point au candidat pour une mesure qui défend cette position, et lui en retirer 1 pour une mesure qui défend la position opposée. Ne pas compter une mesure sans position reconnue. Écarter de ce critère les candidats concernés si vous cochez « sans condamnation ».</li>
          <li>Pour la combinaison, noter d'abord chaque critère sur 100 avec sa propre référence (le plus grand nombre de mesures qui vous concernent chez un seul candidat sur ce critère), puis faire la moyenne des deux notes, à parts égales. Si vous n'avez répondu que d'un côté, retenir seulement la note de ce côté.</li>
          <li>Préférer une moyenne à une addition des points : additionner les points laisserait le critère qui compte le plus de mesures (souvent la situation) écraser l'autre. Exemple : un candidat à 100 en situation et 30 en convictions avait 98 au total ; il a maintenant (100 + 30) ÷ 2 = 65. Un critère pèse donc autant que l'autre, même si l'un contient beaucoup plus de mesures. Le classement suit la moyenne exacte, pas la note arrondie ni la note d'un seul critère.</li>
          <li>Suggérer le candidat dont la moyenne est la plus élevée. En cas d'égalité, montrer tous les candidats à égalité, sans jamais les départager par l'ordre alphabétique. Ne pas rendre éligible un candidat sans aucun résultat.</li>
          <li>Consulter les onglets « Candidats » de chaque bloc : ils montrent les 3 meilleures places de chaque critère, les candidats à égalité partageant la même place.</li>
          <li>Ouvrir la fenêtre de détail d'un candidat pour voir combien de ses mesures vont dans votre sens (par exemple 18/19). Si sa note est sous 100 alors que toutes ses mesures sont favorables, la fenêtre explique pourquoi : le 100 est celui du candidat qui a le plus de mesures qui vous concernent. Ces phrases ne changent pas le classement.</li>
        </ul>
        <h3>Ce qui reste à vous</h3>
        <ul>
          <li>Considérer le candidat idéal comme une suggestion. C'est à vous de peser les mesures qui comptent le plus pour vous, en les lisant.</li>
          <li>Retenir que le pourcentage de précision ne mesure pas la fiabilité du résultat : il compte seulement les questions et les sujets auxquels vous avez répondu.</li>
          <li>Savoir que vos convictions sont rattachées aux mesures par une méthode automatique, avec une seconde lecture. Elles n'ont pas encore été relues une à une par une personne.</li>
          <li>Garder à l'esprit qu'un candidat dont les mesures ne sont pas encore intégrées ne peut pas ressortir : le résultat dépend de ce qui est publié et de ce qui a été traité à ce jour.</li>
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
