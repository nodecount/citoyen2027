# Ingestion « lire une fois, interroger douze fois » — Design

Date : 2026-09-26
Statut : en cours de réalisation. Remplace le mode « recherche web par le modèle », trop cher (≈ 15 € pour
un seul thème d'un seul candidat) et dont la vérification ne lisait aucune page.

## Principe

Notre code, pas le modèle, va chercher les documents officiels. Le modèle ne lit que du texte que nous lui
donnons, sans outil web, en un seul tour.

```
meta.json (documents)            corpus (texte extrait, mis en cache)
   │                                   │
   ▼                                   ▼
récupérer + extraire  ──►  1 appel par thème  ──►  contrôles déterministes  ──►  relecture ciblée
 (HTML/PDF, cache disque)   (corpus en cache de     (extrait mot pour mot        (le modèle ne voit que
                             prompt : lu 1 fois,      dans le texte extrait)        les passages cités)
                             relu 11 fois à ~10 %)
```

## Décisions de conception

1. **Documents déclarés dans `meta.json`** (`documents` : id, url, nom court, année du document). Le nom
   et l'année d'une source viennent de nos données, jamais du modèle : plus de « nom · année » inventé.
2. **Extraction locale** : HTML → texte ; PDF → texte avec repères de page (`pdf-parse`). Un PDF qui
   contient très peu de texte par page est signalé « image, OCR nécessaire » et exclu. Cache disque
   `cache/sources/` (ignoré par git : on ne republie pas les documents).
3. **Un appel par candidat × thème, sans outil**. Le corpus est un bloc de prompt marqué `cache_control` :
   le préfixe (règles + corpus) est identique d'un thème à l'autre, donc lu une fois puis relu au tarif du
   cache. Sortie bornée (≈ 8 000 jetons) : plus de « max_tokens » atteint sur un thème chargé.
4. **Preuve obligatoire pour chaque mesure et chaque effet** : `{document, page, extrait}` avec l'extrait
   copié mot pour mot. Contrôle déterministe : l'extrait est retrouvé dans le texte extrait du document cité
   (comparaison tolérante à la casse, aux accents et à la ponctuation, stricte sur les mots).
5. **Relecture ciblée** : le modèle reçoit la mesure et, pour chaque preuve, les ~600 caractères autour de
   l'extrait *dans notre texte* (pas d'outil, pas de page à aller chercher). Quelques milliers de jetons.
6. **Plafond de coût dur** : avant tout appel, estimation en jetons et en euros ; refus si le budget
   (`--budget`, 2 € par défaut) serait dépassé ; cumul réel après chaque appel ; `--dry-run` n'appelle rien.
7. **Journal** conservé : une entrée par candidat × thème, y compris les thèmes sans mesure.

## Changement de règle à valider

CLAUDE.md dit « viser au moins deux sources, dont une primaire ». Avec un corpus, beaucoup de mesures
n'apparaissent que dans **un** document officiel. La règle devient : **une source primaire suffit si son
extrait est vérifié mot pour mot par le code** ; une seconde source est ajoutée quand elle existe
(`SOURCES_MINIMUM = 1`, constante isolée). Une extraction vérifiée mot pour mot est une preuve plus forte que
deux sources citées mais non relues (ce que faisait l'ancienne relecture).

## Ce qui ne change pas

Schéma des propositions (`effets`, sources « nom · année »), étape de synthèse, moteur de projection,
interface. Le mode « recherche web » est conservé sous `--mode=recherche-web`, avec avertissement de coût.

## Hors périmètre (arbitrages à venir)

Pages rendues par JavaScript, OCR des PDF en image, affichage des candidats sans programme.
