# Étude des sources officielles par candidat — 25/09/2026

Objectif : arbitrer **avant de payer quoi que ce soit** comment alimenter le jeu de données. Cette étude
n'a coûté aucun appel à l'API payante : lecture de pages publiques et analyse locale.

## Les questions à trancher, et ce que l'étude répond

| # | Question | Réponse en une ligne |
|---|---|---|
| 1 | Qui a un programme officiel exploitable ? | 6 candidats sur 24 oui, 11 en partie ou en ancien, 7 non. |
| 2 | Combien coûte de le lire une fois ? | ~0,7 M de jetons au total pour les 17 candidats exploitables, soit quelques euros (voir plus bas). |
| 3 | Quel âge ont ces documents ? | Mélangés : de 2019 à 2026. Beaucoup de « positions anciennes » encore défendues. |
| 4 | Couvrent-ils nos 12 thèmes ? | Larges pour 6 candidats ; thématiques ou partiels pour les autres. |
| 5 | Sont-ils lisibles par un programme ? | PDF : oui ; HTML : oui ; quelques pages rendues par JavaScript ; quelques PDF-images (OCR). |
| 6 | Peut-on les lire (robots, droit) ? | Aucun site examiné ne bloque la lecture ; Lisnard et Renaissance autorisent explicitement les robots de Claude. |
| 7 | Les agrégateurs (iFRAP, candidatspresidentielles2027.fr) comblent-ils les manques ? | Non : là où l'officiel manque, ils sont quasi vides aussi. |
| 8 | Que montre-t-on pour un candidat sans programme ? | **Décision produit à prendre** (voir « À arbitrer »). |

## Méthode et limites

- Pour les 24 candidats du filtre (« déclarés », programme « complet » sur candidatspresidentielles2027.fr),
  balayage automatique : liens des fiches de veille + découverte sur le site officiel, jusqu'à 16
  documents par candidat ; mesure du type, de la taille, du texte extractible (PDF via `pdf-parse`), des
  années citées, et d'une couverture grossière des 12 thèmes par mots-clés. Passes ciblées ensuite sur
  les cas ambigus.
- **Limites** : le balayage se laisse attirer par des statuts ou des images et ne suit pas les pages
  rendues par JavaScript ; la couverture par mots-clés est indicative ; le classement ci-dessous est
  mon jugement, à recouper avant décision. Le niveau « Programme complet » du site source mesure la
  **disponibilité de positions**, pas la publication d'un programme.

## Classement des 24 candidats

Volumes en jetons estimés (caractères ÷ 3,6), pour le texte lisible trouvé.

### Niveau 1 — exploitable maintenant (6)

| Candidat | Documents clés | ~Jetons | Fraîcheur | Remarques |
|---|---|---|---|---|
| Lisnard | Pages « notre programme » du site | 29 k | 2027 cité | 12/12 thèmes ; HTML ; robots : Claude explicitement autorisé |
| Retailleau | PDF « Produire plus » (40 p) et « Nos propositions » (40 p), page qrtravail | 65 k+ | 2025-2026 | 12/12 ; PDF « Famille » et « Logement » non lus (trop lourd / inaccessible) ; pas de robots.txt |
| Glucksmann | PDF « Acte un » (88 p, 42 chantiers) | 33 k | à dater | 12/12 ; manqué par le balayage, trouvé à la main |
| Mélenchon | Programme Front populaire 2026 (PDF 26 p), livre « L'avenir en commun » 2025, livrets 2022 | 12 k+ | 2025-2026 | Très large ; le livre est paginé et probablement rendu par JavaScript |
| Philippot | Projet Les Patriotes (PDF 24 p) | 26 k | 2025 | 10/12 thèmes |
| Dupont-Aignan | Pages « projet » par thème du site | 68 k | 2019-2026 mêlés | 12/12 cumulé ; fraîcheur de chaque page à vérifier |

### Niveau 2 — partiel, thématique ou ancien (11)

| Candidat | Ce qui existe | ~Jetons | Limite principale |
|---|---|---|---|
| Le Pen | 8 PDF du RN (programme 2024, européennes 2024, contre-budget 2026, livret entreprise ≈ 2022), pages « 22 mesures » et « livrets thématiques » | 69 k | Pas de programme présidentiel 2027 unique ; époques mêlées |
| Asselineau | Programme 2022 complet | 20 k | Ancien |
| Arthaud | Brochures, discours, textes 2024-2026 | 93 k | Discursif : peu de liste de mesures |
| Attal | Conventions thématiques du parti Renaissance (2 PDF, 2024-2025) | 67 k | Documents du parti, pas un programme présidentiel ; robots : Claude explicitement autorisé |
| Roussel | « Pacte national pour l'avenir de la France » + 10 propositions | 12 k | 8/12 thèmes |
| Tondelier | Nombreux livrets thématiques PDF (santé environnementale, solitude, enfance, littoraux, montagne…) ; page « 557 mesures » | ~85 k | Thèmes centraux (fiscalité, retraites, logement) à confirmer ; la page « 557 mesures » est rendue par JavaScript |
| Philippe | 4 pages « priorités » et manifeste Horizons | 6 k | Synthétique (c'est la base des 71 propositions actuelles) |
| Kazib | Page programme + dépliant PDF (4 p) | 5 k | Court, 2/12 thèmes |
| Mikolajczak | Documents Equinoxe (statuts, règlement, un document de juillet 2026) | 40 k | Programme à confirmer ; 6/12 |
| Batho | « Notre projet » + PDF 2025 (9 p) | 29 k | 6/12 |
| Guedj | Pas de site propre ; projet du PS (page de synthèse) | 19 k | Primaire du PS les 9 et 10 octobre |

### Niveau 3 — rien d'exploitable à ce stade (7)

Bertrand (site « vision », pas de programme), Cazeneuve (« contribuer au programme » : en construction),
Ruffin (page « cahiers de campagne » de 2,6 k caractères), Faure (site de 2,3 k caractères sans lien de
programme), Bouamrane (pas de programme), Branco et Brun (aucun site officiel identifié).

## Robots et droit

- Aucun des sites examinés n'interdit la lecture de son contenu (Lisnard et Renaissance autorisent
  explicitement ClaudeBot ; Tondelier n'a que des interdits techniques ; Les Républicains n'a pas de
  robots.txt ; les Écologistes renvoient une erreur 403 sur robots.txt, donc inconnu).
- Un robots.txt ouvert n'est pas une licence de réutilisation : on cite des extraits et on renvoie vers la
  source, on ne recopie pas des documents.

## Coût d'une lecture unique (estimation)

- Corpus niveau 1 ≈ 233 k jetons ; niveau 2 ≈ 445 k ; total ≈ 0,7 M de jetons à lire **une fois**.
- Avec le taux implicite constaté (15 € pour ~5,7 M de jetons, essentiellement en entrée, soit ~2,6 €
  par million), la lecture coûte ≈ 2 €. La sortie (≈ 25 k jetons par candidat, tarif supposé ~5× celui de
  l'entrée) ajoute ≈ 5 à 6 €. **Ordre de grandeur : 8 à 15 € pour l'ensemble des 17 candidats**, à confirmer
  par un test à quelques centimes. À comparer aux 15 € dépensés pour un seul thème d'un seul candidat.
- Hypothèses à confirmer avec la grille tarifaire réelle (rapport sortie/entrée, remise du cache et du mode
  différé).

## Ce que l'étude dit des agrégateurs

Là où l'officiel est mince ou absent (Bertrand, Cazeneuve, Faure, Ruffin, Brun), l'iFRAP indique
« proposition non encore connue » ou presque rien : il ne comble pas le manque. Là où il est riche
(Mélenchon, Retailleau, Philippe), l'officiel existe déjà. Leur intérêt reste la liste de contrôle de
complétude (usage en veille, non tranché).

## À arbitrer

1. **Périmètre de la première version** : ~~niveau 1 seul~~ **niveaux 1 et 2 (17 candidats)** — décision du
   porteur du projet, 2026-09-26. Motif : le niveau 1 seul omettrait des candidats très présents dans les
   sondages (Le Pen, Attal, Philippe). Les niveaux 1 et 2 ne coûtent que quelques euros de plus.
2. **Positions anciennes** : ~~exclure / sans badge~~ **affichées datées (« position de 2022 ») et comptées
   dans l'indicateur** quand le candidat n'a rien publié de plus récent — décision du porteur du projet,
   2026-09-26, prolongement de la règle posée pour les sources institutionnelles.
3. **Candidats sans programme (niveau 3)** : les montrer comme « programme pas encore publié » (neutre,
   exact), ou ne pas les montrer ?
4. **Primaire du PS (9-10 octobre)** : attendre le résultat avant d'ingérer Faure, Guedj, Glucksmann ?
5. **Pages rendues par JavaScript** (Écologistes, livre de Mélenchon, cahiers de Ruffin) : accepter un
   navigateur sans interface pour les lire, ou se limiter aux PDF et au HTML statique ?
6. **Documents en image** (quelques PDF sans texte) : ignorer, ou OCR ?
