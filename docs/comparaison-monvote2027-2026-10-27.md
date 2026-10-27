# Comparaison avec MonVote2027 (2026-10-27)

MonVote2027 est un quiz d'opinion (« quels candidats sont proches de mes convictions ? »). Notre simulateur mesure l'effet des programmes sur la situation concrète du visiteur. Les deux outils se complètent ; notre créneau (profil personnel + plusieurs candidats + indépendance) reste libre.

Sources lues le 2026-10-27 : [accueil](https://monvote2027.fr/), [contact](https://monvote2027.fr/contact). La page de méthodologie n'a pas pu être lue (`/methodo` renvoie une erreur 404) : leur calcul reste à confirmer. Contexte : [Next](https://next.ink/235530/monvote2027-dans-les-coulisses-du-quiz-citoyen-pour-les-presidentielles/).

## Tableau comparatif

| Critère | MonVote2027 | Notre simulateur |
| --- | --- | --- |
| Principe | Quiz d'opinion : proximité avec les convictions | Simulateur d'impact : effet des mesures sur ma situation |
| Questions | 20 (rapide, ~2 min) ou 100 (complet, ~10 min), échelle « d'accord / pas d'accord » | 26 questions factuelles sur la situation + 35 sujets de convictions |
| Affichage des questions | Non confirmé sur la page lue ; ordre aléatoire | Grille de cartes, enregistrement automatique |
| Résultat | Pourcentage de correspondance par thème et global | Effet par thème (améliorant, mixte, non concerné, dégradant) ; candidat idéal noté sur 100 |
| Candidats | 21 | 22 dans `agregateurs` (iFRAP), moins dans `officielle` |
| Sources | Plus de 2 000 (programmes, discours, interviews, votes à l'Assemblée) | Extrait retrouvé mot pour mot, source citée sur chaque mesure |
| Données ouvertes | Page « Données » annoncée | Pas encore publiées |
| Corrections | Formulaire « Demande de correction » (candidat, question, source) | Aucun |
| Partage | Image de résultat à télécharger, 5 réseaux sociaux | Aucun |
| Public | Page « Enseignants » | Aucun |
| Équipe | Bénévoles anonymes (Whois : « Ano Nymous ») | Porteur identifiable |
| Financement | Dons, sans publicité | — |
| Données personnelles | Rien stocké, réponses à l'écran | Réponses dans le navigateur uniquement |

## À reprendre

1. **Une question par écran**, avec barre de progression : à lancer en premier.
2. **Mode rapide ou complet** : environ 8 questions essentielles, puis « affiner ». Les questions à garder se choisissent avec `scrape:couverture`.
3. **Données ouvertes** pour afficher le détail des calculs et du raisonnement (mesure, extrait, effet, polarité, poids dans le score). Distinguer l'affichage dans l'interface (données déjà présentes) de la publication en téléchargement sous licence ; pour `agregateurs`, vérifier d'abord les droits de réutilisation du contenu iFRAP.
4. **Formulaire de correction** par candidat, mesure et source : très utile tant qu'aucune donnée n'a été relue.
5. **Page enseignants**, à faible coût.
6. **Image de résultat à partager**, seulement si elle respecte le mode à l'aveugle.

## À ne pas reprendre

- **Le pourcentage de correspondance** : déjà écarté, il favorise les petits programmes.
- **L'anonymat de l'équipe** : il affaiblit la confiance dans un outil politique.
- **Leurs positions comme source** : au mieux une liste de contrôle, jamais citée ni copiée (même règle qu'iFRAP).

## Contact

Le formulaire de contact propose « Message général » et « Demande de correction » (nom, e-mail, message de 10 à 2 000 caractères). Pas d'adresse directe ni de délai annoncé.
