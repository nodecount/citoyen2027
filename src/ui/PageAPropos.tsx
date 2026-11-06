import { Equal, Lock, Scale } from "lucide-react";
import type { InfoBase } from "../data/bases";
import { Pastille, PORTRAITS } from "./Pastille";
import SchemaTraitement from "./SchemaTraitement";

interface PageAProposProps {
  bases: InfoBase[];
  nomsParSlug: Record<string, string>;
}

// Page « À propos » : du texte rédigé, des titres, des phrases courtes. Les encarts (`aside`) se rangent dans la marge à côté du
// paragraphe qui les précède, pour utiliser la largeur de l'écran ; sur téléphone ils passent sous le texte.
// Les chiffres sur les sources sont relevés dans les données le 1er novembre 2026 (à mettre à jour avec elles).
export default function PageAPropos({ bases, nomsParSlug }: PageAProposProps) {
  // Seuls les portraits des candidats présents dans une base sont crédités (un candidat retiré de la source n'a plus de photo affichée).
  const credits = Object.entries(PORTRAITS)
    .filter(([slug]) => slug in nomsParSlug)
    .sort(([a], [b]) => a.localeCompare(b));
  const libelle = (id: string, repli: string) => bases.find((b) => b.id === id)?.libelle ?? repli;
  return (
    <article className="a-propos">
      {/* Trois repères d'un coup d'œil : une icône, un titre, une mini phrase. */}
      <ul className="reperes">
        <li className="repere repere--bleu">
          <Scale aria-hidden="true" />
          <strong>Indépendant</strong>
          <span>Aucun lien avec un parti ou un candidat.</span>
        </li>
        <li className="repere repere--rouge">
          <Equal aria-hidden="true" />
          <strong>Même règle pour tous</strong>
          <span>Le score compte des mesures, sans pondération.</span>
        </li>
        <li className="repere repere--fonce">
          <Lock aria-hidden="true" />
          <strong>Vos données</strong>
          <span>Rien n'est envoyé ni enregistré : vos réponses restent dans votre navigateur.</span>
        </li>
      </ul>

      <section className="chapitre">
        <h2>L'essentiel</h2>
        <p>Ce simulateur aide à lire les programmes des candidats à la présidentielle de 2027. Il ne dit pas pour qui voter.</p>
        <p>Vous répondez à quelques questions sur votre situation, et vous choisissez des positions sur des questions de société. Le simulateur repère alors les mesures de chaque candidat qui vous concernent, et celles qui vont dans le sens de vos convictions.</p>
        <p>La règle est la même pour tous les candidats : le score compte des mesures, sans pondération.</p>
        <aside className="encart">
          <strong>Effacer vos réponses</strong>
          <p>Vos réponses sont gardées dans votre navigateur pour votre prochaine visite. Vous pouvez les effacer à tout moment.</p>
        </aside>
      </section>

      <section className="chapitre">
        <h2>Le choix de la source des données</h2>
        <p>Trois sources ont été essayées, avec le même calcul et les mêmes profils types. Une seule est affichée par défaut : le comparateur iFRAP.</p>
        <aside className="encart">
          <strong>Voir les essais</strong>
          <p>Ouvrez le choix de la source (l'icône dans le menu), puis « Tests de situations » : onze profils types passés dans le calcul exact du site, pour chaque source. « Monitoring » montre l'état de la collecte.</p>
        </aside>

        <h3>{libelle("officielle", "Programmes officiels")} : en pause</h3>
        <p>
          <strong>5 candidats, 590 mesures, dont 227 avec des effets sur la situation.</strong> C'est la source la plus fiable : chaque extrait est retrouvé mot pour mot dans le document, puis relu deux fois.
        </p>
        <p>Mais seuls 6 candidats sur 24 avaient un programme exploitable (étude du 25 septembre 2026). Onze avaient un programme partiel ou ancien, et sept n'en avaient aucun. Chaque candidat demande aussi de trouver, lire et relire ses documents. Cette source pourra reprendre.</p>

        <h3>{libelle("votes", "Votes des députés")} : écartée</h3>
        <p>
          <strong>8 candidats, 823 mesures, dont 92 avec des effets, et aucune position de convictions.</strong> Un vote n'est pas un engagement : un groupe vote selon des compromis, parfois un texte dont il récuse des mesures.
        </p>
        <p>Au 18 octobre, le même candidat ressortait pour presque tous les profils types, et aucun résultat n'était possible côté convictions. Rattacher un groupe parlementaire à un candidat reste enfin une approximation.</p>

        <h3>{libelle("agregateurs", "Comparateur iFRAP")} : retenue</h3>
        <p>
          <strong>12 candidats, 1 480 mesures, dont 449 avec des effets et 777 avec une position de convictions.</strong> C'est la couverture la plus large, et les résultats varient selon les profils.
        </p>
        <p>Chaque mesure est reprise telle quelle, attribuée, et liée à sa page d'origine. La collecte peut être rejouée à volonté, sans coût.</p>
        <aside className="encart encart--attention">
          <strong>Les limites de cette source</strong>
          <p>Elle est secondaire : ses mesures ne sont pas vérifiées une à une dans les programmes, et elles n'ont pas de date. iFRAP est une fondation que des tiers décrivent comme libérale ; elle affirme son indépendance des partis.</p>
        </aside>

        <h3>Ce qui a été écarté d'emblée</h3>
        <p>Les simulateurs produits par un parti ou un candidat ne sont jamais utilisés, même comme point de départ. Le site candidatspresidentielles2027.fr n'est pas lu non plus : sa protection bloque la lecture automatique, et nous ne la contournons pas.</p>
      </section>

      <section className="chapitre">
        <h2>Comment le candidat suggéré est calculé</h2>
        <p>Chaque candidat reçoit deux notes sur 100 : une selon votre situation, une selon vos convictions. Le candidat suggéré est celui dont la moyenne des deux notes est la plus élevée.</p>
        <aside className="encart">
          <strong>Un exemple</strong>
          <p>Un candidat à 100 en situation et 30 en convictions obtient (100 + 30) ÷ 2 = 65.</p>
        </aside>

        <h3>Votre situation</h3>
        <p>Le candidat gagne 1 point pour chaque mesure qui améliore votre situation, et perd 1 point pour chaque mesure qui la dégrade. Une mesure qui ne vous concerne pas ne compte pas, et chaque mesure compte une seule fois par thème.</p>

        <h3>Vos convictions</h3>
        <p>Sur chaque question où vous avez choisi une position, le candidat gagne 1 point pour une mesure qui défend cette position, et perd 1 point pour une mesure qui défend la position opposée. Une mesure sans position reconnue ne compte pas. Si vous cochez « sans condamnation », les candidats concernés sont écartés de ce critère.</p>

        <h3>La moyenne des deux notes</h3>
        <p>Chaque critère est noté sur 100 avec sa propre référence : le plus grand nombre de mesures qui vous concernent chez un seul candidat sur ce critère. Ensuite, nous faisons la moyenne des deux notes, à parts égales. Si vous n'avez répondu que d'un côté, seule la note de ce côté compte.</p>
        <aside className="encart">
          <strong>Pourquoi une moyenne</strong>
          <p>Additionner les points laissait le critère qui compte le plus de mesures, souvent la situation, écraser l'autre. Avec la moyenne, un critère pèse autant que l'autre. Un candidat à 100 et 30 avait 98 au total, il a maintenant 65.</p>
        </aside>
        <p>Le classement suit la moyenne exacte, pas la note arrondie ni la note d'un seul critère.</p>

        <h3>En cas d'égalité</h3>
        <p>Nous montrons tous les candidats à égalité, sans jamais les départager par l'ordre alphabétique. Un candidat sans aucun résultat ne peut pas être suggéré.</p>

        <h3>Pour aller plus loin</h3>
        <p>Les onglets « Candidats » de chaque bloc montrent les 3 meilleures places de chaque critère. La fenêtre de détail d'un candidat indique combien de ses mesures vont dans votre sens, par exemple 18 sur 19. Si sa note est sous 100 alors que toutes ses mesures sont favorables, elle explique pourquoi : le 100 est celui du candidat qui a le plus de mesures qui vous concernent.</p>
      </section>

      <section className="chapitre">
        <h2>Limites et partis pris</h2>
        <p>Le simulateur a des limites, et il vaut mieux les connaître.</p>

        <h3>Ce que nous vous demandons</h3>
        <p>Les questions portent sur des tranches (âge, revenus, patrimoine), jamais votre situation au centime. C'est un juste milieu : plus de détails demanderaient plus de temps, et seraient plus intrusifs.</p>
        <p>Une conséquence : certains effets ne peuvent pas être mesurés précisément. Quand trancher est impossible, nous l'écrivons plutôt que de deviner.</p>

        <h3>Ce que nous calculons</h3>
        <p>Nous ne chiffrons pas en euros : sans chiffres précis dans les programmes, un montant serait inventé. Nous retenons seulement l'effet direct d'une mesure sur vous, pas ses conséquences sur l'économie.</p>
        <p>Le score d'un candidat est le nombre de mesures qui améliorent votre situation, moins le nombre de mesures qui la dégradent. Il n'y a ni pourcentage ni pondération. Une grande mesure et une petite mesure comptent chacune pour une, et aucun thème ne pèse plus qu'un autre. Un candidat qui propose plus de mesures qui vous avantagent a donc un meilleur score : c'est un parti pris assumé.</p>
        <aside className="encart encart--attention">
          <strong>Lire la note sur 100</strong>
          <p>100 correspond au plus grand nombre de mesures qui vous concernent chez un seul candidat. Ce n'est pas une probabilité de convenir, et deux visiteurs ne comparent pas leurs notes.</p>
        </aside>
        <p>Pour la lecture, le score de chaque critère est ramené à une note sur 100. Un score nul ou négatif s'affiche 0. Le classement, lui, suit le score brut.</p>
        <p>Le candidat de référence n'est pas forcément dans le top : il peut avoir beaucoup de mesures dont certaines vont à l'opposé de votre sens, ou être écarté par « sans condamnation ».</p>

        <h3>Ce qui reste à vous</h3>
        <p>Le candidat idéal est une suggestion. C'est à vous de peser les mesures qui comptent le plus pour vous, en les lisant.</p>
        <p>Le pourcentage de précision ne mesure pas la fiabilité du résultat : il compte seulement les questions auxquelles vous avez répondu.</p>
        <p>Vos convictions sont rattachées aux mesures par une méthode automatique, avec une seconde lecture. Elles n'ont pas encore été relues une à une par une personne.</p>
        <aside className="encart encart--attention">
          <strong>Les candidats absents</strong>
          <p>Un candidat dont les mesures ne sont pas encore intégrées ne peut pas ressortir. Le résultat dépend de ce qui est publié et de ce qui a été traité à ce jour.</p>
        </aside>
      </section>

      <section className="chapitre chapitre--schema">
        <h2>Comment les mesures sont traitées</h2>
        <p>Chaque étape dit qui agit : le code, ou un modèle d'IA que le code contrôle.</p>
        <SchemaTraitement />
      </section>

      <section className="chapitre">
        <h2>Données reprises à titre d'information</h2>
        <h3>Le bord politique</h3>
        <p>
          Le bord affiché à côté du parti d'un candidat vient du jeu de données{" "}
          <a href="https://www.data.gouv.fr/datasets/candidatures-a-lelection-presidentielle-2027-statuts-sources" target="_blank" rel="noopener noreferrer">
            Candidatures à l'élection présidentielle 2027
          </a>{" "}
          publié par 2027etmoi sur data.gouv.fr (Licence Ouverte 2.0) : c'est le bloc que la source donne au candidat. Un candidat classé « autre » n'a pas de bord affiché. Il n'entre dans aucun calcul.
        </p>
        <h3>Les condamnations</h3>
        <p>
          Les condamnations de certains candidats sont recoupées avec{" "}
          <a href="https://casier-politique.fr/" target="_blank" rel="noopener noreferrer">
            casier-politique.fr
          </a>{" "}
          (Raphaël Jolivet, licence{" "}
          <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener noreferrer">
            CC BY-NC-SA 4.0
          </a>
          ). Un candidat absent de ce site n'est pas pour autant un candidat sans condamnation.
        </p>
      </section>

      <section className="chapitre">
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
      </section>
    </article>
  );
}
