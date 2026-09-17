# CLAUDE.md

Ce fichier donne à Claude Code le contexte nécessaire pour travailler sur ce projet.

## Vue d'ensemble du projet

**Nom (provisoire) :** Simulateur d'impact personnel — Présidentielle 2027

**Objectif :** Un outil web où un citoyen français renseigne quelques informations sur sa situation personnelle (statut, âge, revenus, situation familiale, secteur d'activité, etc.) et obtient une projection factuelle de ce que changerait, concrètement et pour lui, l'élection de chacun des principaux candidats à la présidentielle 2027 — classée par catégories (économie personnelle, droits et libertés, fiscalité, travail, logement, santé, etc.).

**Principe fondateur — INDÉPENDANCE ET NEUTRALITÉ :** C'est la contrainte la plus importante du projet. L'outil ne doit être affilié à aucun parti, ni directement ni indirectement. Concrètement, cela implique :
- Ne jamais utiliser un simulateur ou un jeu de données produit par un parti ou une organisation partisane (ex : les simulateurs internes que certains candidats ou partis publient sur leur propre programme) comme source de vérité, même comme point de départ technique.
- Pour chaque proposition intégrée, toujours viser au moins deux sources, dont une source primaire (le programme officiel du candidat/parti, un texte de loi, une déclaration officielle), inspirées de la rigueur méthodologique observée chez des initiatives comme Komune Media.
- Présenter les propositions de façon factuelle et juxtaposée, sans commentaire de valeur, sans classement moral, sans "score" implicite favorisant un candidat.
- Documenter systématiquement les hypothèses de calcul quand une proposition est vague ou incomplète (ex : "aucun chiffrage précis publié, estimation basée sur X").
- Traiter tous les candidats déclarés avec le même niveau d'exigence et de détail, même si leurs programmes ne sont pas tous publiés au même degré de précision.

## Ce qui existe déjà sur le marché (contexte de veille, ne pas dupliquer bêtement)

- **Komune Media** (komunemedia.fr) — comparateur sourcé, exigence de sources primaires, approche éditoriale indépendante. Bonne référence méthodologique.
- **Pourquituvotes.fr** — comparateur thématique de programmes (actuellement centré municipales 2026), pas de simulateur d'impact personnel.
- **ÉlyséeScope** (elyseescope.com) — agrégation de sondages + comparaison position par position, classement alphabétique pour neutralité.
- **Ça change quoi** (cachangequoi.fr) — simulateur d'impact personnel, mais **produit par LFI** → à étudier uniquement pour la mécanique UX, jamais comme source de données ou de calcul.
- **Simulateur Lisnard 2027** — même remarque, outil de campagne d'un candidat, à ne pas utiliser comme référence de calcul.
- **Fondapol "Qui en 2027 ?"** — simulateur de scénarios électoraux (sondages), pas d'impact personnel.
- **Candidator, MonVote2027, Prési2027, politiquement.org** — quiz de matching candidat/convictions, pas des simulateurs d'impact.

**Constat :** aucun outil identifié à ce jour ne combine (a) profil personnel détaillé, (b) plusieurs candidats en parallèle, (c) impact chiffré par catégorie de vie, (d) indépendance vis-à-vis des partis. C'est le créneau du projet.

## Architecture cible (à discuter/ajuster avec l'utilisateur avant de coder)

Proposition de structure, à valider :

```
/data
  /programmes
    <candidat_slug>/
      meta.json          # nom, parti, sources officielles, date de dernière maj
      propositions.json  # liste de propositions structurées par thème
  /themes.json            # référentiel des catégories (fiscalité, travail, logement, santé, droits...)
  /profils-schema.json    # schéma des champs de profil utilisateur

/src
  /engine        # moteur de calcul : profil + proposition -> impact estimé
  /ui            # interface (formulaire profil + affichage résultats)
  /ingestion     # scripts d'extraction/mise à jour des programmes depuis sources officielles

/docs
  methodologie.md   # règles de sourçage, règles de neutralité, processus de mise à jour
```

### Modèle de donnée d'une proposition (exemple de structure à affiner)

```json
{
  "id": "fisc-001",
  "candidat": "...",
  "theme": "fiscalite",
  "titre": "...",
  "resume_factuel": "...",
  "sources": [
    {"type": "primaire", "label": "Programme officiel", "url": "..."},
    {"type": "secondaire", "label": "Analyse presse", "url": "..."}
  ],
  "chiffrage_disponible": true,
  "hypotheses_calcul": "...",
  "date_derniere_verification": "2026-09-14"
}
```

### Modèle de profil utilisateur (exemple, à affiner)

Champs possibles : statut (salarié, indépendant, fonctionnaire, retraité, étudiant, sans emploi...), tranche de revenus, situation familiale, nombre d'enfants, logement (locataire/propriétaire), secteur d'activité, région, nationalité/statut administratif, etc. Rester au minimum nécessaire pour limiter la friction et les données sensibles collectées.

## Ce que Claude Code doit garder en tête à chaque session

1. **Ne jamais introduire de biais implicite** : formulations, ordre d'affichage (alphabétique par défaut, pas par score), poids des thèmes — tout doit rester équilibré entre candidats.
2. **Toute donnée de programme ajoutée doit avoir ses sources citées dans le fichier de données**, jamais codée en dur dans la logique applicative sans traçabilité.
3. **Le moteur de calcul doit être transparent** : privilégier des règles explicites et lisibles (if/formules documentées) plutôt qu'un modèle boîte noire, pour que chaque utilisateur puisse comprendre pourquoi tel impact est projeté.
4. **Pas de scraping de sites non autorisés** : vérifier les conditions d'utilisation avant toute extraction automatisée de données depuis des sites tiers (Komune, Pourquituvotes, etc.). Privilégier les sources officielles (programmes publiés en PDF/HTML par les candidats, Légifrance, data.gouv.fr) ou un partenariat explicite.
5. **Statut des programmes** : certains candidats n'ont pas encore publié de programme complet à cette date — le prévoir dans le modèle de données (champ de statut "provisoire / partiel / complet") plutôt que de combler les trous avec des suppositions.
6. **Stack technique** : à définir avec l'utilisateur (pas encore fixée à ce stade — ne pas présumer d'un framework sans lui demander).

## État actuel du projet

Le schéma de données, le moteur de calcul (`src/engine/`) et l'interface (`src/ui/`, React/Vite/TypeScript) sont construits et fonctionnels. Les 11 thèmes de `data/themes.json` sont désormais tous peuplés de données réelles et sourcées pour les trois candidats (Le Pen, Mélenchon, Philippe), soit 71 propositions au total — voir `docs/methodologie.md` pour les règles de sourçage appliquées et l'exception documentée sur deux thèmes du dossier Philippe. Ces données n'ont toutefois pas encore été relues ni validées par le porteur du projet. Prochaines étapes probables :
- Faire relire et valider le contenu par le porteur du projet (exactitude factuelle, neutralité du ton, cohérence entre candidats)
- Poursuivre l'audit de l'application uniforme de la convention `resume_factuel` / `hypotheses_calcul` (suivi déjà noté dans `docs/methodologie.md`)
- Explorer une intégration avec data.gouv.fr et/ou des scripts d'ingestion (`src/ingestion/`, non encore développés) pour la mise à jour continue des données au fil de la campagne
- Élargir la couverture (compléter les exceptions documentées si une meilleure source apparaît, ajouter d'autres candidats le cas échéant)
