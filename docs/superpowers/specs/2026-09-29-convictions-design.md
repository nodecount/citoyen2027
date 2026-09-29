# Axe « Convictions » — design

Date : 2026-09-29. Statut : à relire par le porteur du projet.

## Intention (dite par le porteur du projet)

Le visiteur veut pouvoir exprimer des **principes et convictions** qui ne sont pas des effets de mesures sur sa situation :
« un candidat qui montre l'exemple et n'a pas de casier », « un candidat qui pense à relever le niveau social des autres,
pas seulement le mien ». Décisions du 2026-09-29 :

1. **Axe séparé, sans score.** Jamais fusionné avec les badges « Ma situation » (qui mesurent l'effet matériel sur le
   visiteur). Aucun score global, aucun classement de candidats, aucune moyenne entre axes.
2. **Casier en faits sourcés.** L'exemplarité s'exprime par un constat factuel, attribué, daté et lié à sa source, jamais
   par un jugement.

## Principes (découlent de CLAUDE.md)

- Mêmes règles, même méthode, pour tous les candidats. Ordre alphabétique (ou mélangé en mode aveugle).
- Questions facultatives ; réponses gardées dans le navigateur (mêmes garde-fous que `reponses-visiteur`), jamais transmises.
- **Absence de donnée ≠ absence de condamnation.** Un candidat dont l'intégrité n'a pas été vérifiée est « non vérifié »,
  jamais « sans condamnation ».
- Le sens (favorable/défavorable) n'est jamais fixé par le modèle d'ingestion : table de règles dans le code.

## Deux familles de questions

### A. Valeurs sociales (rattachées aux mesures)

Ex. « Je veux un candidat dont les mesures relèvent le niveau de vie des plus modestes. » Chaque question est liée à un
critère de la table de règles du moteur (cibles + dimension + sens d'effet déjà structurés dans `effets`), par exemple
« public visé = revenus modestes ET effet favorable sur le revenu ». Le moteur produit, **par thème**, un constat à
quatre niveaux identique à l'existant (mêmes mots, mêmes symboles) mais lu depuis le point de vue « autres personnes »
(le profil du visiteur n'intervient pas). Réutilise `projeterTheme` avec un « profil de conviction » au lieu du profil du
visiteur ; aucun nouveau moteur.
Limite : ne s'applique qu'aux mesures qui ont des `effets` structurés (donc rares dans `agregateurs`) ; les autres
apparaissent « sans indicateur ».

### B. Exemplarité et intégrité (rattachées à des faits)

Ex. « Je tiens à un candidat sans condamnation définitive. » Pas de calcul : un **constat factuel** par candidat.

Données : `data/integrite/<slug>.json` (les faits portent sur la personne, donc communs à toutes les bases) :

```json
{
  "slug": "…",
  "verifie_le": "2026-09-29",
  "sources_consultees": [{"nom": "…", "annee": 2026, "url": "…"}],
  "condamnations_definitives": [
    {"nature": "…", "juridiction": "…", "date_decision": "…", "peine": "…", "source": {"nom": "…", "annee": 2026, "url": "…"}}
  ]
}
```

États possibles pour un candidat, affichés en mots + symbole (jamais par la couleur seule) :
- **Condamnation(s) définitive(s) recensée(s)** : nature, juridiction, date, lien vers la source.
- **Aucune condamnation définitive recensée** : seulement si `verifie_le` et `sources_consultees` sont renseignés ; la
  mention dit « d'après les sources consultées le <date> » (jamais une affirmation absolue).
- **Non vérifié** : pas de fichier, ou fichier sans sources.

Règles de sourçage (garde-fous juridiques et de neutralité) :
- **Condamnations définitives seulement** (décision passée en force de chose jugée). Ni mises en examen, ni enquêtes, ni
  condamnations en première instance avec appel pendant, ni classements : hors périmètre v1.
- Deux sources dont une **primaire** (décision de justice, Légifrance, communiqué officiel d'une juridiction) ou une source
  de presse de référence pour la seconde ; même seuil pour tous.
- Attribué et daté ; jamais de qualificatif, jamais de commentaire. Une condamnation effacée (amnistie, réhabilitation) est
  traitée selon la loi : à trancher avec une relecture juridique avant publication.
- **Aucune donnée n'est saisie sans source relue par le porteur du projet.** Cette spec ne fournit aucun fait sur aucun
  candidat.

## Interface

- Nouveau mode d'affichage (à côté d'« Explorer » et « Simuler ») ou onglet « Mes convictions » : trois modes seraient
  lourds ; recommandation : un **bloc « Mes convictions »** dans la page du simulateur, ouvert depuis le récapitulatif,
  avec les deux familles de questions, et un **panneau par candidat** dans le détail (« Convictions : valeurs sociales ·
  intégrité »), séparé des onglets de mesures. À trancher à l'implémentation selon la place disponible.
- Les badges « Ma situation » restent inchangés. Le constat « valeurs sociales » a sa propre légende ; le constat
  « intégrité » n'a pas de couleur d'indicateur (rouge = dégradant est réservé aux effets).
- Le tiroir de portraits ne change pas (aucun classement sur cet axe).
- **Mode aveugle** : l'intégrité identifie le candidat (jurisprudence publique) ; elle est masquée tant que les noms le
  sont, et les valeurs sociales restent affichées (elles ne dépendent que des mesures).
- Formulation du filtre : le visiteur voit les faits ; l'outil ne dit jamais « ce candidat ne remplit pas votre critère ».

## Architecture

- `src/convictions.ts` : catalogue des questions de convictions (id, famille, libellé, finalité, critère lié pour la
  famille A). Volontairement séparé de `data/profils-schema.json` (qui décrit le profil matériel).
- `src/engine/convictions.ts` : famille A, réutilisation de `projeterTheme`. Famille B : lecture de `integrite`.
- `src/data/integrite.ts` : chargement et validation stricte (une condamnation sans source est refusée ; `verifie_le`
  obligatoire pour « aucune condamnation recensée »).
- `src/ui/Convictions.tsx` : questions + panneau candidat. Mémoire : `localStorage`, clé `convictions-visiteur`
  (même mécanique et mêmes garde-fous que `memoireReponses.ts`, effaçable).
- `docs/methodologie.md` : règles de l'axe (périmètre juridique, sourçage, absence de donnée).

## Tests

- Le moteur famille A donne le même niveau pour la même mesure quel que soit le candidat (mêmes règles pour tous).
- Un candidat sans fichier `integrite` n'est jamais « aucune condamnation ».
- La validation refuse une condamnation sans source, une source sans URL, et une date manquante.
- Aucun score ni ordre par indicateur : l'ordre d'affichage reste alphabétique (mélangé en aveugle).
- Mode aveugle : aucun nom, aucune juridiction identifiante ni URL de source dans le rendu de l'axe intégrité.
- Réponses gardées seulement dans le navigateur ; effacement complet.

## Hors périmètre (v1)

Mises en examen, enquêtes, procédures en cours ; jugements moraux ; score ou classement ; collecte automatisée des
condamnations par un modèle (la saisie est manuelle, sourcée, relue) ; convictions sur d'autres thèmes que les deux
familles ci-dessus.

## Points ouverts (à trancher à la relecture)

1. Placement dans l'interface : bloc dans le simulateur ou mode dédié.
2. Traitement des condamnations effacées (amnistie, réhabilitation) : avis juridique.
3. Qui collecte et relit les faits d'intégrité, et à quel rythme de mise à jour (ex. avant chaque mise en ligne).
4. Liste exacte des questions de valeurs sociales (à partir des critères réellement présents dans les `effets`).
