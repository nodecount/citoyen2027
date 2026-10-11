# Simulation d'électorats : qui désigne le simulateur ?

Généré par `src/simulation/run-electorats.ts` le 2026-10-11. Même contenu que la page « Tests de situations » du site (accessible depuis la modale de choix de la base, avec verdicts saisissables) : cette version écrite sert de trace datée.

Chaque électorat répond au formulaire « ma situation » et choisit des positions dans « mes convictions », puis passe dans **le calcul exact de la page de résultat** (mêmes fonctions que l'application) sur chacune des deux bases. « Sans condamnation » n'est pas coché.

Lecture d'une cellule : `Nom (+score = N pour − M contre, sur K)` : le score est le nombre de thèmes (situation) ou de croisements sujet × thème (convictions) favorables moins défavorables ; K est le nombre de thèmes ou croisements où le candidat a un résultat. Les ex æquo sont tous listés. « Suivants » : les trois meilleurs scores après le ou les gagnants, pour juger si l'écart est net.

**À arbitrer** : pour chaque ligne, le candidat désigné correspond-il à ce qu'attendrait cet électorat ? Colonne « Verdict » à remplir.

## Tableau des résultats

| Électorat | Base | Selon la situation | Suivants (situation) | Selon les convictions | Suivants (convictions) | Verdict |
|---|---|---|---|---|---|---|
| Étudiant urbain progressiste | officielle | **Jean-Luc Mélenchon** (+5 = 5 pour − 0 contre, sur 12) | Marine Le Pen (+3), Gabriel Attal (+1), Édouard Philippe (+1) | **Jean-Luc Mélenchon** (+26 = 26 pour − 0 contre, sur 26) | Gabriel Attal (-8), Édouard Philippe (-8), Bruno Retailleau (-12) |  |
| Étudiant urbain progressiste | agregateurs | **Raphaël Glucksmann** (+2 = 3 pour − 1 contre, sur 7) ; **Jean-Luc Mélenchon** (+2 = 2 pour − 0 contre, sur 7) ; **PARTI SOCIALISTE** (+2 = 2 pour − 0 contre, sur 5) | Marine Le Pen (+1), Marine Tondelier (+1), Éric Zemmour (+1) | **Jean-Luc Mélenchon** (+18 = 19 pour − 1 contre, sur 20) | PARTI SOCIALISTE (+6), Marine Tondelier (+6), Raphaël Glucksmann (+3) |  |
| Cadre libéral, propriétaire | officielle | **Édouard Philippe** (+4 = 4 pour − 0 contre, sur 7) | Jean-Luc Mélenchon (+3), Marine Le Pen (+2), Gabriel Attal (+1) | **Édouard Philippe** (+4 = 5 pour − 1 contre, sur 6) | Gabriel Attal (+1), Marine Le Pen (-1), Bruno Retailleau (-1) |  |
| Cadre libéral, propriétaire | agregateurs | **Raphaël Glucksmann** (+2 = 3 pour − 1 contre, sur 7) ; **Jean-Luc Mélenchon** (+2 = 2 pour − 0 contre, sur 7) ; **Marine Tondelier** (+2 = 2 pour − 0 contre, sur 4) ; **Éric Zemmour** (+2 = 2 pour − 0 contre, sur 6) | Gabriel Attal (+1), Marine Le Pen (+1), Emmanuel Maurel (+1) | **Bruno Retailleau** (+12 = 15 pour − 3 contre, sur 18) | Gabriel Attal (+7), Edouard Philippe (+4), David Lisnard (0) |  |
| Retraité rural conservateur | officielle | **Jean-Luc Mélenchon** (+3 = 4 pour − 1 contre, sur 12) | Gabriel Attal (+2), Marine Le Pen (+2), Bruno Retailleau (+1) | **Marine Le Pen** (+11 = 11 pour − 0 contre, sur 11) ; **Bruno Retailleau** (+11 = 11 pour − 0 contre, sur 11) | Édouard Philippe (+10), Gabriel Attal (+6), Jean-Luc Mélenchon (-18) |  |
| Retraité rural conservateur | agregateurs | **Jean-Luc Mélenchon** (+2 = 2 pour − 0 contre, sur 7) | Raphaël Glucksmann (+1), Marine Le Pen (+1), Emmanuel Maurel (+1) | **Marine Le Pen** (+12 = 12 pour − 0 contre, sur 12) | Bruno Retailleau (+10), Éric Zemmour (+10), Nicolas Dupont-Aignan (+8) |  |
| Famille salariée modeste, 3 enfants | officielle | **Marine Le Pen** (+4 = 4 pour − 0 contre, sur 9) ; **Jean-Luc Mélenchon** (+4 = 5 pour − 1 contre, sur 11) ; **Édouard Philippe** (+4 = 4 pour − 0 contre, sur 7) | Gabriel Attal (+3), Bruno Retailleau (+2) | **Jean-Luc Mélenchon** (+12 = 15 pour − 3 contre, sur 18) | Bruno Retailleau (+4), Gabriel Attal (+2), Marine Le Pen (0) |  |
| Famille salariée modeste, 3 enfants | agregateurs | **Raphaël Glucksmann** (+3 = 4 pour − 1 contre, sur 7) | Jean-Luc Mélenchon (+2), PARTI SOCIALISTE (+2), Marine Tondelier (+2) | **Jean-Luc Mélenchon** (+16 = 17 pour − 1 contre, sur 18) | Marine Le Pen (+6), Nicolas Dupont-Aignan (+4), Raphaël Glucksmann (+4) |  |
| Parent isolé précaire | officielle | **Jean-Luc Mélenchon** (+6 = 6 pour − 0 contre, sur 10) | Marine Le Pen (+3), Édouard Philippe (+3), Gabriel Attal (+1) | **Jean-Luc Mélenchon** (+16 = 16 pour − 0 contre, sur 16) | Gabriel Attal (-1), Bruno Retailleau (-2), Marine Le Pen (-3) |  |
| Parent isolé précaire | agregateurs | **Raphaël Glucksmann** (+2 = 3 pour − 1 contre, sur 7) ; **Jean-Luc Mélenchon** (+2 = 2 pour − 0 contre, sur 7) ; **PARTI SOCIALISTE** (+2 = 2 pour − 0 contre, sur 5) ; **Éric Zemmour** (+2 = 2 pour − 0 contre, sur 6) | Olivier Faure (+1), Marine Le Pen (+1), Marine Tondelier (+1) | **Jean-Luc Mélenchon** (+15 = 15 pour − 0 contre, sur 15) | PARTI SOCIALISTE (+5), Marine Tondelier (+5), Olivier Faure (+1) |  |
| Artisan indépendant | officielle | **Édouard Philippe** (+4 = 4 pour − 0 contre, sur 8) | Gabriel Attal (+2), Marine Le Pen (+2), Jean-Luc Mélenchon (+2) | **Marine Le Pen** (+4 = 7 pour − 3 contre, sur 10) ; **Édouard Philippe** (+4 = 4 pour − 0 contre, sur 4) | Bruno Retailleau (+3), Gabriel Attal (-1), Jean-Luc Mélenchon (-14) |  |
| Artisan indépendant | agregateurs | **Jean-Luc Mélenchon** (+2 = 2 pour − 0 contre, sur 6) | Gabriel Attal (+1), Philippe Brun (+1), Olivier Faure (+1) | **Bruno Retailleau** (+13 = 13 pour − 0 contre, sur 13) | Gabriel Attal (+7), Edouard Philippe (+2), David Lisnard (+1) |  |
| Enseignant écologiste | officielle | **Jean-Luc Mélenchon** (+6 = 6 pour − 0 contre, sur 12) | Marine Le Pen (+4), Édouard Philippe (+4), Gabriel Attal (+3) | **Jean-Luc Mélenchon** (+15 = 16 pour − 1 contre, sur 16) | Gabriel Attal (+2), Bruno Retailleau (-5), Édouard Philippe (-6) |  |
| Enseignant écologiste | agregateurs | **Jean-Luc Mélenchon** (+4 = 4 pour − 0 contre, sur 7) | Raphaël Glucksmann (+3), Marine Le Pen (+3), PARTI SOCIALISTE (+3) | **Jean-Luc Mélenchon** (+12 = 14 pour − 2 contre, sur 15) | Marine Tondelier (+4), Raphaël Glucksmann (+2), PARTI SOCIALISTE (+2) |  |
| Agriculteur | officielle | **Gabriel Attal** (+4 = 4 pour − 0 contre, sur 9) ; **Jean-Luc Mélenchon** (+4 = 5 pour − 1 contre, sur 12) ; **Édouard Philippe** (+4 = 4 pour − 0 contre, sur 8) | Marine Le Pen (+3), Bruno Retailleau (0) | **Bruno Retailleau** (+11 = 11 pour − 0 contre, sur 11) | Marine Le Pen (+10), Édouard Philippe (+6), Gabriel Attal (-2) |  |
| Agriculteur | agregateurs | **Jean-Luc Mélenchon** (+4 = 4 pour − 0 contre, sur 6) | Marine Le Pen (+3), Gabriel Attal (+1), Philippe Brun (+1) | **Marine Le Pen** (+11 = 12 pour − 1 contre, sur 12) | Bruno Retailleau (+10), Éric Zemmour (+7), Nicolas Dupont-Aignan (+5) |  |
| Résident étranger hors UE | officielle | **Jean-Luc Mélenchon** (+5 = 5 pour − 0 contre, sur 12) | Édouard Philippe (+4), Marine Le Pen (+3), Gabriel Attal (+1) | **Jean-Luc Mélenchon** (+13 = 14 pour − 1 contre, sur 14) | Édouard Philippe (-5), Gabriel Attal (-6), Marine Le Pen (-7) |  |
| Résident étranger hors UE | agregateurs | **PARTI SOCIALISTE** (+3 = 3 pour − 0 contre, sur 5) | Raphaël Glucksmann (+2), Jean-Luc Mélenchon (+2), Marine Tondelier (+2) | **Jean-Luc Mélenchon** (+8 = 9 pour − 1 contre, sur 10) | PARTI SOCIALISTE (+1), Fabien Roussel (+1), Marine Tondelier (+1) |  |
| Retraitée modeste aidante | officielle | **Jean-Luc Mélenchon** (+3 = 3 pour − 0 contre, sur 12) | Gabriel Attal (+2), Marine Le Pen (+2), Bruno Retailleau (+1) | **Gabriel Attal** (+4 = 4 pour − 0 contre, sur 4) | Marine Le Pen (+2), Jean-Luc Mélenchon (+1), Édouard Philippe (0) |  |
| Retraitée modeste aidante | agregateurs | **Éric Zemmour** (+3 = 3 pour − 0 contre, sur 6) | Jean-Luc Mélenchon (+2), PARTI SOCIALISTE (+2), Raphaël Glucksmann (+1) | **Éric Zemmour** (+5 = 5 pour − 0 contre, sur 5) | Raphaël Glucksmann (+4), Marine Le Pen (+4), Marine Tondelier (+4) |  |
| Chef d'entreprise | officielle | **Édouard Philippe** (+4 = 4 pour − 0 contre, sur 8) | Marine Le Pen (+3), Jean-Luc Mélenchon (+2), Gabriel Attal (+1) | **Marine Le Pen** (+6 = 8 pour − 2 contre, sur 10) | Gabriel Attal (+3), Édouard Philippe (+1), Bruno Retailleau (0) |  |
| Chef d'entreprise | agregateurs | **Jean-Luc Mélenchon** (+2 = 2 pour − 0 contre, sur 7) | Gabriel Attal (+1), Raphaël Glucksmann (+1), Marine Le Pen (+1) | **Bruno Retailleau** (+11 = 12 pour − 1 contre, sur 13) | Gabriel Attal (+6), Éric Zemmour (+4), Edouard Philippe (+2) |  |

## Profils simulés

### Étudiant urbain progressiste

Moins de 30 ans, étudiant, petit budget, locataire en grande ville, sans voiture.

- **Réponses au formulaire** : tranche_age = moins_30 · statut_professionnel = etudiant · tranche_revenus = moins_1200 · situation_familiale = celibataire · nombre_enfants = 0 · logement = locataire · territoire = grande_ville · vehicule = aucun · nationalite = francaise
- **Convictions** : Énergies renouvelables et transition écologique → Accélérer la transition écologique · Nucléaire → Sortir du nucléaire · Immigration → Plus d'ouverture · Fiscalité et dépense publique → Plus de redistribution · Très hauts patrimoines et revenus → Taxer davantage les ultra-riches · Sécurité et justice → Priorité à la prévention · Libertés et société → Plus de libertés individuelles · Organisation de la santé → Renforcer l'hôpital public et réguler l'installation des médecins · Logement → Encadrer les loyers et construire du logement social · Cannabis → Légaliser ou dépénaliser le cannabis · Europe → Plus d'intégration européenne · Armement de la police → Désarmer la police ou limiter son armement · Temps de travail → Réduire le temps de travail · SMIC et salaires → Augmenter fortement le SMIC et les salaires · Droit du sol et nationalité → Garder ou élargir le droit du sol
- **Réponses retenues par base** (une question absente d'une base y est ignorée) : officielle : 9 réponses ; agregateurs : 9 réponses

### Cadre libéral, propriétaire

30-49 ans, salarié à plus de 5 000 €, marié, un enfant, propriétaire en grande ville.

- **Réponses au formulaire** : tranche_age = 30_49 · statut_professionnel = salarie · tranche_revenus = plus_5000 · situation_familiale = marie_pacse · nombre_enfants = 1 · logement = proprietaire · territoire = grande_ville · vehicule = thermique · nationalite = francaise · tranche_patrimoine = 500k_1_3m
- **Convictions** : Nucléaire → Garder et développer le nucléaire · Fiscalité et dépense publique → Moins d'impôts et moins de dépense publique · Travail et retraites → Travailler plus longtemps · Organisation de la santé → Plus de liberté et de place au privé en santé · Logement → Libérer l'offre de logement privée · Commerce et protection de l'économie → Défendre le libre-échange et l'ouverture · Intelligence artificielle → Encourager davantage l'IA · Dette et déficit → Réduire la dette et le déficit en priorité · Fonctionnaires et services publics → Réduire le nombre de fonctionnaires · Très hauts patrimoines et revenus → Ne pas alourdir leur fiscalité · Aides sociales et chômage → Conditionner les aides, durcir l'indemnisation · Europe → Plus d'intégration européenne
- **Réponses retenues par base** (une question absente d'une base y est ignorée) : officielle : 10 réponses ; agregateurs : 10 réponses

### Retraité rural conservateur

65 ans et plus, retraité (pension 1 300-2 000 €), propriétaire en zone rurale, voiture thermique.

- **Réponses au formulaire** : tranche_age = 65_plus · statut_professionnel = retraite · montant_pension = 1300_2000 · tranche_revenus = 1200_2000 · situation_familiale = marie_pacse · nombre_enfants = 0 · logement = proprietaire · territoire = rural · vehicule = thermique · usage_autoroute = oui · nationalite = francaise
- **Convictions** : Immigration → Plus de restriction · Sécurité et justice → Priorité à la répression · Nucléaire → Garder et développer le nucléaire · Énergies renouvelables et transition écologique → Freiner ou assouplir la transition écologique · Libertés et société → Plus de cadre collectif · Prison → Plus de places de prison et des peines plus longues · Voiture et déplacements → Défendre la voiture (supprimer les restrictions) · Laïcité et signes religieux → Étendre les interdits au nom de la laïcité · Droit du sol et nationalité → Restreindre le droit du sol et l'accès à la nationalité · Europe → Moins d'Europe, plus de souveraineté nationale · Surveillance et vie privée → Étendre la surveillance pour la sécurité · Fin de vie → Ne pas légaliser l'aide active à mourir · Discipline à l'école → Plus d'autorité et de sanctions
- **Réponses retenues par base** (une question absente d'une base y est ignorée) : officielle : 10 réponses ; agregateurs : 10 réponses

### Famille salariée modeste, 3 enfants

30-49 ans, salarié 1 200-2 000 €, en couple avec 3 enfants, locataire en ville moyenne, voiture thermique.

- **Réponses au formulaire** : tranche_age = 30_49 · statut_professionnel = salarie · tranche_revenus = 1200_2000 · situation_familiale = en_couple · nombre_enfants = 3 · logement = locataire · territoire = ville_moyenne · vehicule = thermique · usage_autoroute = non · nationalite = francaise · aides_percues = allocations_familiales · enfants_scolarises = maternelle_primaire, college
- **Convictions** : SMIC et salaires → Augmenter fortement le SMIC et les salaires · Fiscalité et dépense publique → Plus de redistribution · Commerce et protection de l'économie → Protéger l'économie nationale · Travail et retraites → Conserver l'âge actuel de départ · Fonctionnaires et services publics → Recruter et renforcer les services publics · Organisation de la santé → Renforcer l'hôpital public et réguler l'installation des médecins · Logement → Encadrer les loyers et construire du logement social · Immigration → Plus de restriction
- **Réponses retenues par base** (une question absente d'une base y est ignorée) : officielle : 12 réponses ; agregateurs : 11 réponses

### Parent isolé précaire

30-49 ans, sans emploi, moins de 1 200 €, parent isolé de 2 enfants (dont un de moins de 3 ans), locataire HLM en quartier prioritaire, RSA et aide au logement.

- **Réponses au formulaire** : tranche_age = 30_49 · statut_professionnel = sans_emploi · tranche_revenus = moins_1200 · situation_familiale = celibataire · nombre_enfants = 2 · parent_isole = oui · enfant_moins_3_ans = oui · logement = locataire · logement_social = oui · territoire = quartier_prioritaire · nationalite = francaise · aides_percues = rsa, aide_logement, allocations_familiales · enfants_scolarises = maternelle_primaire
- **Convictions** : Aides sociales et chômage → Garantir les droits sociaux sans contrepartie renforcée · Fiscalité et dépense publique → Plus de redistribution · Organisation de la santé → Renforcer l'hôpital public et réguler l'installation des médecins · Logement → Encadrer les loyers et construire du logement social · Fonctionnaires et services publics → Recruter et renforcer les services publics · Sécurité et justice → Priorité à la prévention · SMIC et salaires → Augmenter fortement le SMIC et les salaires
- **Réponses retenues par base** (une question absente d'une base y est ignorée) : officielle : 12 réponses ; agregateurs : 12 réponses

### Artisan indépendant

50-64 ans, indépendant 3 000-5 000 €, marié avec 2 enfants, propriétaire en ville moyenne, voiture thermique.

- **Réponses au formulaire** : tranche_age = 50_64 · statut_professionnel = independant · tranche_revenus = 3000_5000 · situation_familiale = marie_pacse · nombre_enfants = 2 · logement = proprietaire · territoire = ville_moyenne · vehicule = thermique · usage_autoroute = oui · nationalite = francaise · metier_penible = oui
- **Convictions** : Fiscalité et dépense publique → Moins d'impôts et moins de dépense publique · SMIC et salaires → Ne pas imposer de hausse, alléger le coût du travail · Temps de travail → Travailler davantage · Fonctionnaires et services publics → Réduire le nombre de fonctionnaires · Dette et déficit → Réduire la dette et le déficit en priorité · Agriculture et environnement → Alléger les normes agricoles et environnementales · Voiture et déplacements → Défendre la voiture (supprimer les restrictions) · Nucléaire → Garder et développer le nucléaire · Aides sociales et chômage → Conditionner les aides, durcir l'indemnisation
- **Réponses retenues par base** (une question absente d'une base y est ignorée) : officielle : 10 réponses ; agregateurs : 10 réponses

### Enseignant écologiste

30-49 ans, enseignant fonctionnaire 2 000-3 000 €, en couple avec 2 enfants scolarisés, locataire en grande ville, véhicule électrique ou hybride.

- **Réponses au formulaire** : tranche_age = 30_49 · statut_professionnel = fonctionnaire · metier = enseignant · tranche_revenus = 2000_3000 · situation_familiale = en_couple · nombre_enfants = 2 · logement = locataire · territoire = grande_ville · vehicule = electrique_hybride · usage_autoroute = non · nationalite = francaise · enfants_scolarises = college, lycee
- **Convictions** : Fonctionnaires et services publics → Recruter et renforcer les services publics · Nucléaire → Sortir du nucléaire · Énergies renouvelables et transition écologique → Accélérer la transition écologique · Fiscalité et dépense publique → Plus de redistribution · Sécurité et justice → Priorité à la prévention · Manifestations → Protéger le droit de manifester · Système éducatif → Revoir en profondeur le système éducatif · Discipline à l'école → Une école plus bienveillante et inclusive · Voiture et déplacements → Restreindre la voiture, développer les transports · Europe → Plus d'intégration européenne
- **Réponses retenues par base** (une question absente d'une base y est ignorée) : officielle : 12 réponses ; agregateurs : 11 réponses

### Agriculteur

50-64 ans, agriculteur indépendant 1 200-2 000 €, marié avec 2 enfants, propriétaire en zone rurale, voiture thermique.

- **Réponses au formulaire** : tranche_age = 50_64 · statut_professionnel = independant · metier = agriculteur · tranche_revenus = 1200_2000 · situation_familiale = marie_pacse · nombre_enfants = 2 · logement = proprietaire · territoire = rural · vehicule = thermique · usage_autoroute = non · nationalite = francaise · metier_penible = oui · carriere_longue = oui
- **Convictions** : Agriculture et environnement → Alléger les normes agricoles et environnementales · Énergies renouvelables et transition écologique → Freiner ou assouplir la transition écologique · Europe → Moins d'Europe, plus de souveraineté nationale · Commerce et protection de l'économie → Protéger l'économie nationale · Fiscalité et dépense publique → Moins d'impôts et moins de dépense publique · Voiture et déplacements → Défendre la voiture (supprimer les restrictions) · Immigration → Plus de restriction · Nucléaire → Garder et développer le nucléaire
- **Réponses retenues par base** (une question absente d'une base y est ignorée) : officielle : 13 réponses ; agregateurs : 12 réponses

### Résident étranger hors UE

30-49 ans, salarié 1 200-2 000 €, nationalité hors UE avec titre de séjour de longue durée depuis plus de 5 ans, locataire en grande ville.

- **Réponses au formulaire** : tranche_age = 30_49 · statut_professionnel = salarie · tranche_revenus = 1200_2000 · situation_familiale = en_couple · nombre_enfants = 1 · logement = locataire · territoire = grande_ville · vehicule = aucun · nationalite = hors_ue · statut_sejour = titre_long_sejour · anciennete_france = 5_ans_et_plus
- **Convictions** : Immigration → Plus d'ouverture · Droit du sol et nationalité → Garder ou élargir le droit du sol · Laïcité et signes religieux → Garder une laïcité de liberté · Libertés et société → Plus de libertés individuelles · Fiscalité et dépense publique → Plus de redistribution
- **Réponses retenues par base** (une question absente d'une base y est ignorée) : officielle : 11 réponses ; agregateurs : 10 réponses

### Retraitée modeste aidante

65 ans et plus, retraitée (pension moins de 1 000 €), locataire en zone rurale, aide un proche dépendant, difficulté à trouver un médecin.

- **Réponses au formulaire** : tranche_age = 65_plus · statut_professionnel = retraite · montant_pension = moins_1000 · tranche_revenus = moins_1200 · situation_familiale = celibataire · nombre_enfants = 0 · logement = locataire · territoire = rural · vehicule = thermique · usage_autoroute = non · nationalite = francaise · aidant_familial = oui · desert_medical = oui · handicap = non
- **Convictions** : Fin de vie → Ne pas légaliser l'aide active à mourir · Organisation de la santé → Renforcer l'hôpital public et réguler l'installation des médecins · Travail et retraites → Conserver l'âge actuel de départ · Fonctionnaires et services publics → Recruter et renforcer les services publics · Libertés et société → Plus de cadre collectif
- **Réponses retenues par base** (une question absente d'une base y est ignorée) : officielle : 12 réponses ; agregateurs : 13 réponses

### Chef d'entreprise

50-64 ans, chef d'entreprise à plus de 5 000 €, marié avec 2 enfants, propriétaire en ville moyenne, voiture thermique.

- **Réponses au formulaire** : tranche_age = 50_64 · statut_professionnel = chef_entreprise · tranche_revenus = plus_5000 · situation_familiale = marie_pacse · nombre_enfants = 2 · logement = proprietaire · territoire = ville_moyenne · vehicule = thermique · usage_autoroute = oui · nationalite = francaise · tranche_patrimoine = 500k_1_3m
- **Convictions** : Entreprises → Alléger la fiscalité et les charges des entreprises · Fiscalité et dépense publique → Moins d'impôts et moins de dépense publique · Très hauts patrimoines et revenus → Ne pas alourdir leur fiscalité · SMIC et salaires → Ne pas imposer de hausse, alléger le coût du travail · Temps de travail → Travailler davantage · Aides sociales et chômage → Conditionner les aides, durcir l'indemnisation · Dette et déficit → Réduire la dette et le déficit en priorité · Commerce et protection de l'économie → Défendre le libre-échange et l'ouverture
- **Réponses retenues par base** (une question absente d'une base y est ignorée) : officielle : 11 réponses ; agregateurs : 10 réponses

