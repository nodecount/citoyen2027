# Méthodologie — règles de sourçage et de neutralité

Ce document reprend les standards déjà appliqués dans les fiches de `data/programmes/`,
tels qu'établis en cours de collecte. Il documente une pratique existante ; ce n'est pas
une nouvelle politique.

## Sources primaires vs secondaires

Une source **primaire** est une propriété officielle de campagne du candidat, un document
officiel du parti, ou un document officiel/légal (compte rendu de vote parlementaire, texte
de loi, Légifrance). Ce n'est **jamais** une retranscription tierce, un site de fans, un
agrégateur ou un comparateur, aussi fidèle son contenu soit-il — même s'il reproduit le
programme mot pour mot.

En cas de doute, toujours vérifier la page « À propos » / mentions légales / pied de page
du site en question. C'est exactement cette vérification qui a permis d'identifier que
`laec.fr` (site tiers développé par une équipe indépendante du Discord Insoumis, qui précise
lui-même ne pas engager l'Union populaire) n'est pas une source primaire malgré son contenu
fidèle, et que l'Institut Montaigne, malgré son sérieux, reste un tiers analystique et non
une source officielle du candidat.

## Sources partisanes / militantes

Une source dont l'orientation politique ou militante est connue (média affilié à un parti,
association de plaidoyer, think tank à l'orientation affichée) peut être citée comme source
**secondaire**, mais son orientation doit être systématiquement indiquée dans son champ
`label` — de façon identique pour tous les candidats, sans exception. Exemples déjà en place :
« L'Insoumission (média affilié à La France Insoumise) » pour Mélenchon, « Fondation iFRAP
(think tank généralement associé à une orientation favorable à la baisse de la dépense
publique) » et « Contribuables Associés (association militante anti-fiscalité...) » pour
Philippe.

## `resume_factuel` vs `hypotheses_calcul`

- `resume_factuel` énonce ce que propose le candidat et ce que les sources consultées
  laissent non précisé (mécanisme, montant, calendrier...).
- `hypotheses_calcul` est l'endroit où figurent les chiffrages, la contestation de ces
  chiffrages par d'autres acteurs, et les réserves de faisabilité ou de conformité légale.

**Suivi connu :** un audit complet de l'application uniforme de cette convention sur
l'ensemble des données existantes des trois candidats reste à faire ; il n'a pas encore
été réalisé à ce jour.

## Le champ `statut`

`statut` (`"complet" | "partiel" | "provisoire"`) qualifie l'état de la **fiche elle-même**
— la qualité et l'exhaustivité de la recherche et du sourçage menés — et non l'état du
programme ou de la mesure du candidat. Une fiche peut être `"complet"` même si le programme
sous-jacent reste flou ou non chiffré, dès lors que cette imprécision est honnêtement
documentée et correctement sourcée (par exemple : « le site officiel ne précise pas de
mécanisme », avec la source à l'appui). À l'inverse, `"partiel"` ou `"provisoire"` signalent
un travail de recherche lui-même inachevé (sources manquantes, vérification à compléter),
indépendamment du degré de précision du programme rapporté.
