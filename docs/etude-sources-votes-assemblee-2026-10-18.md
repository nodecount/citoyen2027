# Étude : votes à l'Assemblée nationale comme nouvelle source (2026-10-18)

Mandat de Macron 2022-2027 = deux législatures : la XVIe (juin 2022 - juin 2024) et la XVIIe (depuis juillet 2024).
Les chiffres de tokens sont des **estimations** (aucun fichier de scrutins n'a été ouvert, la consommation réelle des
sources existantes n'a pas été relevée) ; ils sont exprimés relativement à la base `agregateurs` = 1. La fiabilité des
sources est à déterminer par le porteur du projet : ce document ne la tranche pas.

## Sources trouvées

| Source | Nature | Couverture | Licence | Points vérifiés |
|---|---|---|---|---|
| [data.assemblee-nationale.fr, Votes](https://data.assemblee-nationale.fr/travaux-parlementaires/votes) | Primaire (publiée par l'Assemblée) | XVIIe : `Scrutins.json.zip` / `.xml.zip` (métadonnée du 2026-10-18) ; XVIe : archive annoncée | « Licence ouverte / Open licence » (conditions non détaillées sur la page) | Page incohérente (texte « XVe législature », liens vers le dépôt 17), champs non décrits : ouvrir le fichier pour les voir |
| [NosParlementaires](https://nosparlementaires.fr/donnees-ouvertes) (Regards Citoyens) | Secondaire (retraitement des données officielles) | Scrutins de l'Assemblée depuis 2012 (XVIe et XVIIe) | Licence Ouverte 2.0 (Etalab), vérifiée | CSV/JSON sans clé, régénérés chaque jour, environ 1,3 million de lignes de votes ; ajoute le groupe à la date du vote et 30 thèmes (taxonomie du Sénat) ; incohérences de comptage sur leur page |
| [Datan](https://datan.fr/a-propos) | Secondaire (indicateurs dérivés) | XVIIe surtout | Jeux en licence ouverte sur data.gouv.fr | Association bénévole, sans financement de partis, d'entreprises ou d'organismes publics ; scores de participation et de loyauté, pas de positions sur des mesures ; filtre éditorial sur les votes retenus |
| [NosDéputés.fr](https://github.com/regardscitoyens/nosdeputes.fr) | Secondaire | Jusqu'à la XVIe | ODbL selon une présentation de 2014 (à reconfirmer) | Suivi arrêté après la XVIe |

Non vérifiés : `scrutoir`, `votesdeputes` (dépôts de particuliers).

## Difficulté de transformation vers le moteur

Le moteur attend des mesures avec effets structurés (cibles, dimension, sens, extrait retrouvé mot pour mot). Un scrutin
donne un titre et des positions pour / contre / abstention ; le texte qui porte l'effet est dans les dossiers
législatifs, pas dans le fichier des votes. Les thèmes propres à chaque source ne posent pas de problème (voulu : chaque
source a ses thèmes, ses mesures et ses effets).

| Source | Complexité | Tokens (relatif, `agregateurs` = 1) | Fiabilité de la source | Fiabilité du résultat dans le moteur |
|---|---|---|---|---|
| iFRAP (`agregateurs`, existant) | Faible, déjà faite | 1 | Moyenne | Moyenne |
| Programmes bruts (`officielle`, existant, en pause) | Moyenne, déjà faite | 2 à 3 | Haute | Moyenne à haute |
| Fichier officiel des scrutins | Élevée (pas de texte de mesure, rattachement groupe → candidat, lien vers le texte voté) | 5 à 15 | Haute | Faible à moyenne |
| NosParlementaires | Moyenne (même problème de fond ; groupe à la date du vote et thèmes de départ déjà fournis) | 4 à 12 | Moyenne | Faible à moyenne |
| Datan | Faible, mais n'apporte pas ce qu'il faut (pas de positions) | 0,5 | Moyenne | Faible |
| NosDéputés.fr | Moyenne, sans la XVIIe | 3 à 8 (XVIe seulement) | Moyenne | Faible |

## Réserves

- Un vote n'est pas un programme : un groupe vote selon des compromis et des consignes, et peut voter un texte dont il récuse des mesures.
- Le coût en tokens est dominé par la lecture du texte voté (amendement, article), pas par les titres de scrutins. Un sous-ensemble (votes solennels, articles clés) ramènerait le coût vers 1 à 3.
- Il faut un rattachement explicite entre un groupe et un candidat avant tout affichage.
- Si la source est retenue, l'affichage proposé est « ce que le groupe a voté, à telle date » (attribué et daté, comme pour les positions anciennes).
