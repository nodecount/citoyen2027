# Parcours du simulateur en deux zones — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** remplacer les quatre écrans du simulateur par un écran à trois blocs (situation · « Mon candidat idéal » · convictions), avec onglets Questions/Candidats par côté, anneau de précision et révélation confirmée.

**Architecture :** la logique (progression, états, onglets, texte de confirmation) est en fonctions pures testées à part ; les blocs sont des composants présentationnels contrôlés (états passés en props, donc testables en rendu statique) ; `PageThemes` garde l'état (`vue`, `ideal`, onglets) et branche le tout. Le pas à pas, les convictions et les cartes de thèmes sont **réutilisés tels quels** et s'ouvrent en pleine largeur avec un bouton de retour au tableau de bord (choix du builder, voir spec « Laissé au builder »).

**Tech Stack :** React 18, Vite, TypeScript, vitest (`renderToStaticMarkup`, pas de testing-library), lucide-react, CSS (`src/index.css` + un fichier CSS par composant, comme `src/ui/pasAPas.css`).

**Spec :** `docs/superpowers/specs/2026-10-30-parcours-deux-zones-design.md`

## Global Constraints

- Moteur de score, règles d'égalité, mode aveugle, mémoire des réponses (`reponses-visiteur`) et des convictions, questionnaire : **inchangés**.
- Tant que la suggestion n'est pas révélée, **aucun vrai nom, slug, parti ni portrait de candidat dans le HTML** (y compris `aria-label`, `title`, `alt`). Le nom affiché est la constante `XXXXXX YYYYYY` derrière un flou CSS. Le flou n'est jamais la seule protection.
- Libellés fixés : « Mon candidat idéal », « Révéler », « Revenir aux questions », « Questions », « Candidats », « Commencer » / « Continuer », « Oui, révéler », « Continuer à répondre ».
- Seuil du bouton « Révéler » : **au moins 1 réponse** (situation ou convictions). À 0 réponse : bouton `disabled`.
- Pourcentage : (questions de situation répondues + sujets de convictions répondus) / (questions visibles + sujets proposés), arrondi à l'entier, **jamais 100 tant qu'il reste une réponse manquante**, 0 si le total est 0. Il n'est affiché que **non révélé** ; révélé, seul l'anneau reste.
- Textes : jamais sous 1 rem, pas de jargon (« score », « indicateur »…), vouvoiement, phrases courtes. Rouge réservé aux boutons destructeurs (`bouton-effacer`). La couleur ne porte jamais seule une information.
- Mobile (écran étroit) : ordre **suggestion, situation, convictions**.
- Toute modification de réponse ou de conviction, tout effacement, tout changement de base, et « Revenir aux questions » : suggestion **refloutée avec nouvelles lettres** (`recommencer()` de `etatIdeal.ts`) et les deux onglets repassent sur *Questions*.
- Accessibilité : `role="tablist"/"tab"/"tabpanel"`, onglet verrouillé `disabled` + `aria-disabled="true"`, anneau `role="progressbar"` avec `aria-valuenow`, focus visible.
- Commits en français, terminés par `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Aucune identité réelle dans le HTML non révélé, **y compris** les onglets *Candidats* (verrouillés : leur contenu n'est même pas rendu) et le bloc central avec un `combine` de plusieurs ex æquo.
2. À 0 réponse : « Révéler » inactif et la modale de confirmation inatteignable ; dénominateurs nuls (base sans sujets étiquetés, questionnaire vide) : pas de `NaN`, pas de division par zéro.
3. Une question conditionnelle qui apparaît ou disparaît change le dénominateur : le pourcentage reste cohérent (jamais 100 avec une question sans réponse).
4. Visiteur de retour avec réponses gardées (ancienne clé `etape-simulateur` éventuellement présente) : arrive sur le tableau de bord, **non révélé**, sans erreur si `localStorage` est refusé.
5. Effacer, changer de base ou modifier une réponse pendant que la suggestion est révélée : floutée, onglets *Questions*, aucun onglet *Candidats* ouvert sur des données refloutées.
6. Côté convictions sans résultat (aucune position, ou mesures non étiquetées) : l'onglet *Candidats* de droite dit pourquoi au lieu d'un top vide.

## File Structure

| Fichier | Rôle |
|---|---|
| `src/ui/progression.ts` (créer) | `progression()`, `messageRevelation()` : pur |
| `src/ui/compteurs.ts` (créer) | `compterAvancement()` : décomptes (déplacé de `ParcoursSimulateur.tsx`) |
| `src/ui/etatZones.ts` (créer) | onglets et états de la suggestion : pur |
| `src/ui/AnneauPrecision.tsx` (créer) | anneau + disque |
| `src/ui/ZoneOnglets.tsx` (créer) | coque d'un bloc latéral à deux onglets |
| `src/ui/PanneauCandidats.tsx` (créer) | contenu de l'onglet *Candidats* (top 3 + modale de détail) |
| `src/ui/BlocSuggestion.tsx` (créer) | bloc central bleu |
| `src/ui/EcranDeuxZones.tsx` (créer) | assemblage des trois blocs + confirmation + aide |
| `src/ui/deuxZones.css` (créer) | styles des composants ci-dessus |
| `src/ui/CardCandidatIdeal.tsx` (modifier) | exporter `ColonneTop`, `BlocAbsent` ; retirer la card, `CentreIdeal`, `BandeauRevelation` en fin de plan |
| `src/ui/ModaleConfirmation.tsx` (modifier) | prop facultative `libelleAnnuler` |
| `src/ui/ParcoursSimulateur.tsx` (réduire) | ne garde que `IntroEtape`, `IntroMesures`, `BarreRetour` |
| `src/ui/PageThemes.tsx` (modifier) | état `vue`, branchement |
| `src/ui/memoireEtape.ts` + test (supprimer) | l'étape n'existe plus |
| `CLAUDE.md`, `src/ui/PageAPropos.tsx` | documentation et aide |

---

### Task 1: Progression et texte de confirmation (pur)

**Files:**
- Create: `src/ui/progression.ts`
- Test: `src/ui/progression.test.ts`

**Interfaces:**
- Produces:
  - `interface Comptes { repondues: number; total: number }`
  - `interface Progression extends Comptes { pourcent: number }`
  - `progression(situation: Comptes, convictions: Comptes): Progression` — somme des deux, `pourcent` selon la règle des Global Constraints.
  - `sourceDeLaSuggestion(situation: Comptes, convictions: Comptes): "situation" | "convictions" | "les deux" | null` — null à 0 réponse.
  - `messageRevelation(situation: Comptes, convictions: Comptes): string`

- [ ] **Step 1: Écrire les tests** (`progression.test.ts`) :
  - `progression({repondues:9,total:18},{repondues:0,total:35}).pourcent` vaut `17` (9/53).
  - `progression({repondues:18,total:18},{repondues:27,total:35}).pourcent` vaut `85`.
  - `progression({repondues:0,total:0},{repondues:0,total:0})` vaut `{repondues:0,total:0,pourcent:0}` (pas de NaN).
  - 52 réponses sur 53 : `pourcent` vaut `98` ; `{repondues:199,total:200}` (99,5 arrondi à 100) donne `99`, jamais 100 ; `{repondues:53,total:53}` donne `100`.
  - `sourceDeLaSuggestion` : `"situation"`, `"convictions"`, `"les deux"`, `null`.
  - `messageRevelation({repondues:9,total:18},{repondues:0,total:35})` contient `17 % de précision`, `9 réponses sur 53 questions` et `côté situation seulement` ; avec les deux côtés répondus, contient `situation et convictions`.
- [ ] **Step 2: Lancer** `npx vitest run src/ui/progression.test.ts` → échec (module absent).
- [ ] **Step 3: Implémenter** les trois fonctions dans `src/ui/progression.ts` (singulier « 1 réponse sur 53 questions » à l'accord près ; vouvoiement).
- [ ] **Step 4: Lancer** le test → PASS.
- [ ] **Step 5: Commit** `git add src/ui/progression.ts src/ui/progression.test.ts` — « Progression de la suggestion et texte de confirmation ».

### Task 2: Décomptes déplacés hors de `ParcoursSimulateur`

**Files:**
- Create: `src/ui/compteurs.ts`
- Test: `src/ui/compteurs.test.ts`
- Modify: `src/ui/ParcoursSimulateur.tsx:93-106` (la fonction `compteurs` devient un import)

**Interfaces:**
- Produces: `compterAvancement(questionnaire: Questionnaire, profil: ProfilPartiel, convictions: Convictions, propositions: Proposition[] | null): { visibles: ChampProfil[]; repondues: number; questions: number; convictions: number; sujets: number }` — **même logique** que l'actuelle `compteurs` (questions générales + de thèmes dédoublonnées par `id`, filtrées par `questionsVisibles`).

- [ ] **Step 1: Tests** : sur `chargerBase("agregateurs")` avec `profil = {}` : `repondues` 0, `questions` > 0 ; avec `{ tranche_age: "30_49" }` : `repondues` 1 ; avec `convictions = { positions: { ia: "plus_ia" }, exemplarite: false }` : `convictions` 1 et `sujets` ≥ 1 ; avec `propositions = null` : `sujets` vaut `sujetsDisponibles(null).length` (pas d'exception).
- [ ] **Step 2:** lancer → échec.
- [ ] **Step 3:** déplacer la fonction dans `compteurs.ts` sous le nom `compterAvancement` ; `ParcoursSimulateur.tsx` l'importe (comportement identique).
- [ ] **Step 4:** `npx vitest run src/ui/compteurs.test.ts src/ui/PageThemes.test.tsx` → PASS.
- [ ] **Step 5: Commit** — « Décomptes du parcours dans leur propre module ».

### Task 3: État des onglets et de la suggestion (pur)

**Files:**
- Create: `src/ui/etatZones.ts`
- Test: `src/ui/etatZones.test.ts`

**Interfaces:**
- Produces:
  - `type Onglet = "questions" | "candidats"`
  - `interface OngletsZones { gauche: Onglet; droite: Onglet }`
  - `const ONGLETS_QUESTIONS: OngletsZones` (les deux sur `"questions"`)
  - `type EtatSuggestion = "vide" | "partiel" | "revele"`
  - `etatSuggestion(repondues: number, revele: boolean): EtatSuggestion` — `"revele"` si `revele`, sinon `"vide"` à 0, `"partiel"` dès 1.
  - `apresRevelation(): OngletsZones` (les deux sur `"candidats"`).
  - `choisirOnglet(o: OngletsZones, zone: "gauche" | "droite", onglet: Onglet, revele: boolean): OngletsZones` — refuse `"candidats"` quand `!revele` (renvoie `o` inchangé) ; sinon change seulement `zone`.

- [ ] **Step 1: Tests** : les quatre cas d'`etatSuggestion` (0/faux → vide ; 1/faux → partiel ; 0/vrai et 5/vrai → revele) ; `apresRevelation()` → candidats/candidats ; `choisirOnglet(ONGLETS_QUESTIONS,"gauche","candidats",false)` renvoie le même objet ; `choisirOnglet(apresRevelation(),"gauche","questions",true)` → `{gauche:"questions",droite:"candidats"}` (onglets indépendants).
- [ ] **Step 2–4:** échec, implémentation, PASS.
- [ ] **Step 5: Commit** — « État des onglets des deux zones ».

### Task 4: Anneau de précision

**Files:**
- Create: `src/ui/AnneauPrecision.tsx`, `src/ui/deuxZones.css` (premières règles : `.anneau`, `.anneau-fond`, `.anneau-valeur`, `.anneau-disque`)
- Test: `src/ui/AnneauPrecision.test.tsx`

**Interfaces:**
- Produces: `AnneauPrecision({ pourcent, revele, children }: { pourcent: number; revele: boolean; children?: ReactNode })` — SVG `viewBox="0 0 100 100"`, rayon 45, `strokeDasharray` à la circonférence (`2 * Math.PI * 45`) et `strokeDashoffset` proportionnel ; `role="progressbar"`, `aria-valuemin=0`, `aria-valuemax=100`, `aria-valuenow={pourcent}`, `aria-label="Précision de la suggestion"`. Disque blanc **sans pointillés** : non révélé, il contient `{pourcent} %` et « de précision » ; révélé, il contient `children` (portrait) et **aucun `%`**.

- [ ] **Step 1: Tests** : `pourcent=17, revele=false` → contient `aria-valuenow="17"` et `17 %` et `de précision` ; `revele=true` avec `children=<b>AB</b>` → contient `<b>AB</b>`, contient toujours `aria-valuenow`, et **ne contient pas** `%` dans le disque (isoler `.anneau-disque`) ; la feuille `deuxZones.css` (lue avec `readFileSync`) ne contient pas `dashed`.
- [ ] **Step 2–4:** échec, implémentation, PASS.
- [ ] **Step 5: Commit** — « Anneau de précision ».

### Task 5: Coque d'un bloc latéral à deux onglets

**Files:**
- Create: `src/ui/ZoneOnglets.tsx`
- Test: `src/ui/ZoneOnglets.test.tsx`

**Interfaces:**
- Produces: `ZoneOnglets({ zone, onglet, candidatsOuverts, onChoisir, questions, candidats }: { zone: "situation" | "convictions"; onglet: Onglet; candidatsOuverts: boolean; onChoisir: (o: Onglet) => void; questions: ReactNode; candidats: ReactNode })`
- Consumes: `Onglet` (Task 3).
- Comportement : `role="tablist"` avec deux `role="tab"` « Questions » et « Candidats ». Candidats verrouillé (`!candidatsOuverts`) : `disabled`, `aria-disabled="true"`, cadenas (icône `Lock` de lucide) ; **le contenu `candidats` n'est pas rendu** tant que verrouillé. Un seul `role="tabpanel"` rendu (celui de l'onglet actif), `aria-labelledby` vers son onglet. Classe `zone--situation` / `zone--convictions`.

- [ ] **Step 1: Tests** : verrouillé → `aria-disabled="true"` sur Candidats et la chaîne `SECRET` passée dans `candidats` est absente du HTML ; ouvert + `onglet="candidats"` → `aria-selected="true"` sur Candidats, `SECRET` présent, le contenu `questions` absent.
- [ ] **Step 2–4:** échec, implémentation, PASS.
- [ ] **Step 5: Commit** — « Bloc latéral à onglets Questions et Candidats ».

### Task 6: Onglet « Candidats » (top 3 + détail)

**Files:**
- Modify: `src/ui/CardCandidatIdeal.tsx` — ajouter `export` à `ColonneTop` (l.327) et `BlocAbsent` (l.394) ; aucun changement de comportement.
- Create: `src/ui/PanneauCandidats.tsx`
- Test: `src/ui/PanneauCandidats.test.tsx`

**Interfaces:**
- Produces: `PanneauCandidats({ critere, resultat, positionsChoisies = false }: { critere: "situation" | "convictions"; resultat: ResultatAffiche | null; positionsChoisies?: boolean })` — toujours rendu **révélé** (`revele={true}` en interne : il n'est monté que lorsque l'onglet est ouvert). Garde l'état de la ligne ouverte (`ModaleDetail`, `useCallback` pour `onFermer`, comme `CardCandidatIdeal`).
  - `resultat` non nul → `<ColonneTop>`.
  - `resultat` nul, `critere="convictions"` → `<BlocAbsent positionsChoisies>` (explique la raison).
  - `resultat` nul, `critere="situation"` → `<p className="hint">Pas encore de résultat : répondez d'abord à au moins une question.</p>`.
- Consumes: `ResultatAffiche`, `LigneClassement`, `ColonneTop`, `BlocAbsent`, `ModaleDetail` de `CardCandidatIdeal.tsx`.

- [ ] **Step 1: Tests** (construire un `ResultatAffiche` à la main, comme dans `CardCandidatIdeal.test.tsx` : réutiliser ses fabriques si exportées, sinon les recopier) : avec un classement de 3 places → 3 `<li>`, le nom réel de chaque identité présent, `aria-haspopup="dialog"` sur les lignes ; `resultat=null, critere="convictions", positionsChoisies=false` → contient `choisissez au moins une position` ; `positionsChoisies=true` → contient `pas encore été étudiées` ; `critere="situation"` → contient `répondez d'abord`.
- [ ] **Step 2–4:** échec, implémentation, PASS ; lancer aussi `npx vitest run src/ui/CardCandidatIdeal.test.tsx` (rien ne casse).
- [ ] **Step 5: Commit** — « Onglet Candidats : top 3 et détail ».

### Task 7: Bouton de confirmation (libellé d'annulation)

**Files:**
- Modify: `src/ui/ModaleConfirmation.tsx` — prop facultative `libelleAnnuler?: string` (défaut « Annuler »), utilisée par le bouton d'annulation.
- Test: `src/ui/ModaleConfirmation.test.tsx` (ajouter un cas)

- [ ] **Step 1: Test** : `ouverte` avec `libelleAnnuler="Continuer à répondre"` → HTML contient ce libellé et plus « Annuler » ; sans la prop → « Annuler » (non-régression).
- [ ] **Step 2–4:** échec, implémentation, PASS.
- [ ] **Step 5: Commit** — « Libellé d'annulation de la confirmation configurable ».

### Task 8: Bloc central « Mon candidat idéal »

**Files:**
- Create: `src/ui/BlocSuggestion.tsx`
- Test: `src/ui/BlocSuggestion.test.tsx`
- Modify: `src/ui/deuxZones.css` (règles `.suggestion`, fond bleu `linear-gradient(160deg, var(--bleu-fonce), var(--bleu))`, `.suggestion-nom--flou { filter: blur(5px); user-select: none }`, `.bouton-revele` blanc/bleu foncé, `.bouton-fantome` fond `rgba(255,255,255,.15)` **sans bordure**)

**Interfaces:**
- Produces: `BlocSuggestion(props: { etat: EtatSuggestion; pourcent: number; comptesTexte: string; source: "situation" | "convictions" | "les deux" | null; combine: ResultatAffiche | null; pourcentRevele: number; onReveler: () => void; onRevenir: () => void })`
- Consumes: `EtatSuggestion` (Task 3), `AnneauPrecision` (Task 4), `ResultatAffiche`, `Pastille`, `partiAffichable`.
- Comportement, de haut en bas : `<h2>Mon candidat idéal</h2>` (jamais modifié) ; `AnneauPrecision` (révélé : portrait du premier gagnant via `Pastille`, sinon initiales) ; nom : non révélé = `<h3 className="suggestion-nom--flou" aria-hidden="true">XXXXXX YYYYYY</h3>`, **jamais** le nom de `combine` ; révélé = nom + parti de chaque gagnant (ex æquo : tous, comme `CentreIdeal`) ; si `combine.gagnants.length > 1` non révélé, seulement « N candidats à égalité » ; `combine` sans gagnant (égalité parfaite / tous écartés) : phrases de `CentreIdeal` ; ligne de source (« Calculé sur votre situation seule » / « …vos convictions seules » / « …votre situation et vos convictions » ; état vide : « Répondez à une question, d'un côté ou de l'autre, pour débloquer la suggestion. ») ; bouton selon l'état — `vide` : « Révéler » `disabled` ; `partiel` : « Révéler » plein blanc ; `revele` : bouton fantôme « Revenir aux questions » avec sous-texte « Révélé · précision {pourcentRevele} % » (**seul endroit où le % reste visible une fois révélé**).

- [ ] **Step 1: Tests** (4 états) :
  - `vide` : contient `Mon candidat idéal`, `XXXXXX YYYYYY`, `0 %`, bouton `disabled` « Révéler ».
  - `partiel` avec un `combine` dont `identite` est `null` : bouton « Révéler » non `disabled`, contient `17 %`.
  - **`partiel` avec un `combine` dont les `gagnants[0].identite` sont renseignées (nom `Zoé Exemple`)** : le HTML ne contient ni `Zoé Exemple`, ni le slug, ni le parti.
  - `revele` : contient le nom, `Revenir aux questions`, `Révélé · précision 85 %`, et le disque de l'anneau ne contient pas `%`.
- [ ] **Step 2–4:** échec, implémentation, PASS.
- [ ] **Step 5: Commit** — « Bloc central de la suggestion ».

### Task 9: Écran à trois blocs

**Files:**
- Create: `src/ui/EcranDeuxZones.tsx`
- Test: `src/ui/EcranDeuxZones.test.tsx`
- Modify: `src/ui/deuxZones.css` (grille `.deux-zones { display:grid; grid-template-columns: 1fr 1.1fr 1fr; gap:.8rem }` ; `@media (max-width: 52rem)` : une colonne, `.suggestion { order: -1 }`)

**Interfaces:**
- Produces: `EcranDeuxZones(props)` avec
  ```ts
  interface EcranDeuxZonesProps {
    situation: Comptes; convictions: Comptes;          // décomptes (Task 1)
    resultatSituation: ResultatAffiche | null;
    resultatConvictions: ResultatAffiche | null;
    combine: ResultatAffiche | null;
    positionsChoisies: boolean;
    revele: boolean;
    onglets: OngletsZones;
    mesuresAccessibles: boolean;                        // le lien « Voir les mesures adaptées » n'apparaît que s'il y a des réponses
    peutEffacerReponses: boolean; peutEffacerConvictions: boolean;
    onReveler: () => void;                              // appelé APRÈS confirmation
    onRevenir: () => void;
    onChoisirOnglet: (zone: "gauche" | "droite", o: Onglet) => void;
    onOuvrir: (vue: "situation" | "themes" | "convictions") => void;
    onEffacerReponses: () => void; onEffacerConvictions: () => void;
    confirmationOuverteInitiale?: boolean;              // tests
  }
  ```
- Consumes: Tasks 1, 3, 5, 6, 7, 8 ; `ModaleConfirmation` ; `ModaleAideScore` (exportée de `CardCandidatIdeal.tsx`).
- Comportement : gauche = `ZoneOnglets zone="situation"` ; onglet Questions : titre « Ma situation », « N questions sur M », barre, bouton « Commencer » (0 réponse) ou « Continuer » (`onOuvrir("situation")`), lien « → Voir les mesures adaptées » si `mesuresAccessibles` (`onOuvrir("themes")`), « Effacer mes réponses » (`bouton-effacer`) si `peutEffacerReponses` ; droite symétrique (barre verte, « N sujets sur M », « Un sujet sans avis ne compte pas. », `onOuvrir("convictions")`, « Effacer mes convictions »). Onglet Candidats : `PanneauCandidats`. « Révéler » ouvre `ModaleConfirmation` (titre « Révéler votre candidat idéal ? », message = `messageRevelation`, `libelleConfirmer="Oui, révéler"`, `libelleAnnuler="Continuer à répondre"`) ; la confirmation appelle `onReveler`. Un bouton « Comment est calculé le score ? » ouvre `ModaleAideScore`. `candidatsOuverts = revele` pour les deux zones.

- [ ] **Step 1: Tests** (rendu statique) :
  - Départ (0 réponse, non révélé) : contient « Commencer » deux fois, « 0 question sur 18 » et « 0 sujet sur 35 » (adapter aux totaux passés), `disabled` sur « Révéler », les deux onglets Candidats `aria-disabled="true"`, pas de lien « Voir les mesures adaptées ».
  - Un côté rempli : « Continuer », lien « Voir les mesures adaptées », « Révéler » actif, et ligne « Calculé sur votre situation seule ».
  - Révélé (`onglets` candidats/candidats) : deux classements affichés (noms réels des `resultat*` de test), bouton « Revenir aux questions », pas de « Commencer ».
  - Révélé, `onglets = {gauche:"questions", droite:"candidats"}` : les questions à gauche, le classement convictions à droite.
  - `confirmationOuverteInitiale` : contient `Révéler votre candidat idéal ?`, `Oui, révéler`, `Continuer à répondre` et le message `… de précision`.
  - Non révélé avec des résultats **portant des identités** : aucun nom réel dans le HTML (Review Focus 1).
- [ ] **Step 2–4:** échec, implémentation, PASS.
- [ ] **Step 5: Commit** — « Écran à trois blocs du simulateur ».

### Task 10: Brancher `PageThemes` (état `vue`) et retirer les quatre étapes

**Files:**
- Modify: `src/ui/ParcoursSimulateur.tsx` — supprimer `Etapes`, `NavEtape`, `BandeauPertinence`, `RecapReponses`, le type `Etape` et `ETAPES` ; `IntroEtape` accepte `etape: "situation" | "themes" | "convictions"` ; ajouter `BarreRetour({ onRetour, haut }: { onRetour: () => void; haut?: boolean })` (bouton `secondaire` « ← Retour à mon candidat idéal », classe `barre-retour`).
- Modify: `src/ui/PageThemes.tsx`
- Delete: `src/ui/memoireEtape.ts`, `src/ui/memoireEtape.test.ts`
- Modify: `src/ui/PageThemes.test.tsx`

**Interfaces:**
- Produces: `export type Vue = "zones" | "situation" | "themes" | "convictions"` (dans `ParcoursSimulateur.tsx`) ; prop `vueInitiale?: Vue` de `PageThemes` à la place de `etapeInitiale` (défaut `"zones"` ; `releveInitial` est conservé pour les tests et ouvre aussi `apresRevelation()`).
- Consumes: `EcranDeuxZones`, `compterAvancement`, `progression`, `etatZones`, `recommencer`/`etatPourBase`.

Comportement attendu de `PageThemes` en mode simulateur :
- `vue` démarre toujours à `"zones"` (plus de mémorisation d'étape : le `useEffect` `memoriserEtape` disparaît).
- `"zones"` : `EcranDeuxZones` alimenté par `compterAvancement(base.questionnaire, profil, convictions, useContext(PropositionsBase))` et `progression()`. `resultatSituation`, `resultatConvictions`, `combine` : les `situationIdeale`, `convictionsIdeales`, `idealCumule` existants (inchangés). `mesuresAccessibles = personnalise`. Puis, sous les trois blocs, le `TableauResultat` existant quand `personnalise` (voir « Décision à confirmer » ci-dessous), **sans** le `bandeau`.
- `"situation"` / `"convictions"` : l'actuel `PageQuestionsGenerales` et `BlocConvictions` restent **montés en permanence mais `hidden`** hors de leur vue (pour ne perdre aucun brouillon, comme aujourd'hui), avec `BarreRetour haut` et `BarreRetour` en bas ; `IntroEtape` conservée. Plus de `NavEtape` ni de bouton « Effacer » en bas de ces vues.
- `"themes"` : `IntroMesures` + `VueThemes` existants, `BarreRetour` en haut et en bas.
- `onReveler` → `setIdeal({ ...ideal, revele: true })` + `setOnglets(apresRevelation())`. `onRevenir` → `setIdeal(recommencer())` + `setOnglets(ONGLETS_QUESTIONS)`. `invaliderIdeal` fait de même quand `revele`. Effacement confirmé : `vue="zones"`, onglets questions, `revele` faux. Changement de base : onglets remis à `ONGLETS_QUESTIONS` en plus de `etatPourBase`.
- Les deux `ModaleConfirmation` d'effacement existantes sont conservées ; `onEffacerReponses` / `onEffacerConvictions` les ouvrent.
- Exploration (`mode="exploration"`) : **aucun changement** (`VueThemes` seule).
- Supprimer les imports et variables devenus morts (`useEffect` de l'observateur du voile, `voileCardVisible`, `BandeauRevelation`, `CardCandidatIdeal`, `questionsRestantes`, `etapeDeDepart`…) ; `npx tsc -b` doit passer sans variable inutilisée.

- [ ] **Step 1: Réécrire les tests de `PageThemes.test.tsx`** : remplacer `etapeInitiale="themes"` par `vueInitiale="themes"`, `"resultat"` par `"zones"` (fabrique `page`). Remplacer le bloc `describe("card candidat idéal sur la page du simulateur")` par des tests du tableau de bord :
  - arrivée par défaut : contient `Mon candidat idéal`, `Commencer` ou `Continuer`, et **ni** `Étapes du simulateur` **ni** `carte-ideal` ; un visiteur avec réponses et convictions gardées arrive sur ce tableau, **non révélé** : contient `XXXXXX YYYYYY` et aucun nom de `noms` (liste des candidats de la base).
  - `vueInitiale="themes"` : contient `class="grille-themes"`, `masquons`, et `Si ce candidat était élu` ; `vueInitiale="situation"` : contient `class="section-secondaire panneau-progression"` et `Retour à mon candidat idéal` ; `vueInitiale="convictions"` : contient le bloc convictions.
  - `releveInitial` : contient les noms réels dans le tableau de bord, `Revenir aux questions`, pas de `XXXXXX YYYYYY`, et les cards de thèmes (vue `themes` + `releveInitial`) restent masquées (lettres, pas de photo).
  - `profil: {}` + non soumis : « Révéler » `disabled`.
  - exploration : pas de `Mon candidat idéal`.
  - Supprimer les tests spécifiques à `Étapes`, `NavEtape`, `BandeauPertinence`, `RecapReponses`, « Recommencer pour corriger ou compléter ».
- [ ] **Step 2:** `npx vitest run src/ui/PageThemes.test.tsx` → échec.
- [ ] **Step 3: Implémenter** selon le comportement ci-dessus.
- [ ] **Step 4:** `npx tsc -b` puis `npx vitest run` (toute la suite) → PASS.
- [ ] **Step 5: Commit** — « Simulateur : écran à trois blocs à la place des quatre étapes ».

**Décision à confirmer** (hors spec, signalée au porteur) : le `TableauResultat` (tableau des candidats par thème sous la card) est **conservé** sous les trois blocs, car la spec ne le supprime pas. Si le porteur le retire, supprimer le rendu et l'import sans autre impact.

### Task 11: Styles et vérification visuelle

**Files:**
- Modify: `src/ui/deuxZones.css` (compléter : onglets, barres, lignes, bouton fantôme, `.barre-retour`), `src/index.css` (retirer les règles mortes de `.etapes*`, `.nav-etape*`, `.carte-ideal*`, `.ideal-mer`, `.ideal-voile*`, `.recap-*`, `.bandeau-pertinence`, `.intro-decompte*` **après avoir vérifié par `grep` qu'aucun composant ne les utilise encore**)
- Modify: `src/ui/ZoneOnglets.tsx`, `src/ui/EcranDeuxZones.tsx` : importer `./deuxZones.css`.

- [ ] **Step 1:** `npm run dev`, ouvrir `/simulateur` (Chrome), vérifier à 1280 px puis 390 px : trois blocs côte à côte ; sur mobile, suggestion en tête puis situation puis convictions ; fond du bloc central bleu dans les quatre états ; disque sans pointillés ; nom flouté lisible comme flou ; texte ≥ 1 rem ; focus visible sur onglets et boutons.
- [ ] **Step 2:** parcourir : 0 réponse (bouton grisé) → répondre à une question (pas à pas, retour) → « Révéler » → modale → « Oui, révéler » (onglets Candidats ouverts, % disparu du disque, bouton fantôme sans bordure) → « Revenir aux questions » (flouté, % revenu, nouvelles lettres).
- [ ] **Step 3:** `npx tsc -b` et `npx vitest run` → PASS.
- [ ] **Step 4: Commit** — « Styles des deux zones, retrait des règles mortes ».

### Task 12: Nettoyage de la card, aide et documentation

**Files:**
- Modify: `src/ui/CardCandidatIdeal.tsx` — retirer le composant `CardCandidatIdeal`, `CentreIdeal`, `BandeauRevelation`, `TitreResultat` si inutilisé ; garder tout ce que d'autres fichiers importent (`ColonneTop`, `BlocAbsent`, `ModaleDetail`, `ModaleAideScore`, `PoursContres`, `Jauge`, `JaugeNote`, `RondScore`, `badgesDe`, `compterBadges`, `phraseTotal`, types). Mettre le commentaire d'en-tête à jour.
- Modify: `src/ui/CardCandidatIdeal.test.tsx` — supprimer les tests de la card et de `BandeauRevelation`, garder ceux des exports conservés.
- Modify: `ModaleAideScore` — section « La précision » : « Le pourcentage de précision est la part de vos questions et de vos sujets auxquels vous avez répondu. Il ne mesure pas la fiabilité du résultat. »
- Modify: `src/ui/PageAPropos.tsx` (chapitre « Limites et partis pris ») + `PageAPropos.test.tsx` : même phrase, testée.
- Modify: `CLAUDE.md` — réécrire « Parcours du simulateur en quatre écrans » en « Parcours du simulateur en un écran à trois blocs (décision du 2026-10-30) » : trois blocs, onglets, anneau, seuil de 1 réponse, révélation confirmée, retour aux questions qui reflouté, arrivée toujours sur le tableau non révélé (remplace « arrive sur le résultat ») ; adapter la mention de la card « candidat idéal — disposition du 2026-10-10 » (les tops sont maintenant dans les onglets *Candidats*).

- [ ] **Step 1:** tests d'abord (`PageAPropos.test.tsx` : contient « ne mesure pas la fiabilité » ; test de `ModaleAideScore` : contient « La précision »).
- [ ] **Step 2:** lancer → échec ; **Step 3:** implémenter ; **Step 4:** `npx tsc -b` et `npx vitest run` → PASS (toute la suite) ; `grep -rn "CardCandidatIdeal\b\|BandeauRevelation\|memoireEtape\|NavEtape\|RecapReponses\|BandeauPertinence" src` ne renvoie plus que des imports existants valides.
- [ ] **Step 5: Commit** — « Retrait de l'ancienne card, aide et documentation du parcours ».

---

## Self-review

- **Couverture du spec :** trois blocs (T8-9), onglets et verrou (T3, T5, T9), anneau et % (T1, T4), seuil 1 réponse (T3, T8), fond bleu permanent / titre fixe / nom flouté (T8), modale (T1, T7, T9), état révélé et bouton fantôme (T8), « Revenir aux questions » reflouté (T10), effacer (T9-10), onglets indépendants (T3), visite de retour (T10), mobile (T9, T11), aide / À propos / `CLAUDE.md` (T12), `PasAPas` inchangé (T10). `RecapReponses` et `BandeauPertinence` retirés comme décidé (T10).
- **Hors spec signalé :** conservation du `TableauResultat` (T10) ; ouverture du pas à pas / des convictions / des mesures en pleine largeur avec retour (laissé au builder).
- **Cohérence des noms :** `Comptes`, `Progression`, `OngletsZones`, `EtatSuggestion`, `Vue`, `compterAvancement`, `apresRevelation`, `ONGLETS_QUESTIONS`, `choisirOnglet`, `messageRevelation`, `sourceDeLaSuggestion` utilisés à l'identique dans toutes les tâches.
- **Limite connue des tests :** rendu statique uniquement (pas de clic). Les enchaînements (révéler → onglets, revenir → flou) sont couverts par les fonctions pures (T3) et par le rendu de chaque état contrôlé (T9, T10) ; le parcours complet est vérifié à la main en T11.
