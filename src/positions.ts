// Convictions par sujet (décision du 2026-10-01) : pour chaque grand sujet, le visiteur choisit la position qui lui parle,
// ou ne dit rien (« pas d'avis » est l'état de départ, jamais une position). Le catalogue est FIXE et validé par le porteur
// du projet : mêmes sujets pour tous les candidats, chaque sujet offre des positions opposées (aucune n'est mise en avant),
// et la description de chaque position est celle que reçoit le modèle qui étiquette les mesures.

export interface PositionConviction {
  id: string;
  libelle: string;
  // Ce que défend une mesure pour relever de cette position (donnée au modèle qui étiquette : jamais d'interprétation libre).
  definition: string;
}

export interface SujetConviction {
  id: string;
  libelle: string;
  question: string;
  positions: PositionConviction[];
}

export const SUJETS_CONVICTION: SujetConviction[] = [
  {
    // Décision du 2026-10-04 : l'ancien sujet « ecologie » mêlait des positions qui ne s'opposent pas (nucléaire et
    // renouvelables peuvent être défendus ensemble) ; il est scindé en deux sujets aux positions réellement opposées.
    id: "nucleaire",
    libelle: "Nucléaire",
    question: "Sur le nucléaire, quelle position vous parle le plus ?",
    positions: [
      { id: "sortir_nucleaire", libelle: "Sortir du nucléaire", definition: "arrêter ou programmer l'arrêt de la production d'électricité nucléaire (fermeture de réacteurs, abandon de nouvelles centrales)" },
      { id: "garder_nucleaire", libelle: "Garder et développer le nucléaire", definition: "maintenir, prolonger ou développer le parc nucléaire (nouveaux réacteurs, prolongation de centrales)" },
    ],
  },
  {
    id: "renouvelables",
    libelle: "Énergies renouvelables et transition écologique",
    question: "Sur les énergies renouvelables et la transition écologique, quelle position vous parle le plus ?",
    positions: [
      { id: "plus_renouvelables", libelle: "Aller plus vite sur la transition écologique", definition: "développer les énergies renouvelables (éolien, solaire, hydraulique…), renforcer les normes ou la sobriété environnementales, ou faire de la transition écologique une priorité" },
      { id: "freiner_transition", libelle: "Aller moins vite sur la transition écologique", definition: "limiter ou ralentir le développement des renouvelables (moratoire, suppression d'aides), assouplir ou supprimer des normes et contraintes environnementales" },
    ],
  },
  {
    id: "ia",
    libelle: "Intelligence artificielle",
    question: "Sur l'intelligence artificielle, quelle position vous parle le plus ?",
    positions: [
      { id: "plus_ia", libelle: "Encourager davantage l'IA", definition: "soutenir, financer ou accélérer le développement et l'usage de l'intelligence artificielle" },
      { id: "encadrer_ia", libelle: "Encadrer et limiter l'IA", definition: "réguler, restreindre ou interdire certains développements ou usages de l'intelligence artificielle" },
    ],
  },
  {
    id: "europe",
    libelle: "Europe",
    question: "Sur l'Europe, quelle position vous parle le plus ?",
    positions: [
      { id: "plus_europe", libelle: "Plus d'intégration européenne", definition: "renforcer les compétences, le budget ou les politiques communes de l'Union européenne" },
      { id: "souverainete", libelle: "Moins d'Europe, plus de souveraineté nationale", definition: "reprendre des compétences à l'Union européenne, déroger à ses règles ou en réduire le rôle au profit de la souveraineté nationale" },
    ],
  },
  {
    id: "immigration",
    libelle: "Immigration",
    question: "Sur l'immigration, quelle position vous parle le plus ?",
    positions: [
      { id: "ouverture", libelle: "Plus d'ouverture", definition: "faciliter l'accueil, la régularisation ou l'accès aux droits des personnes étrangères" },
      { id: "restriction", libelle: "Plus de restriction", definition: "limiter l'immigration, durcir les conditions d'entrée, de séjour, d'accès aux droits ou à la nationalité" },
    ],
  },
  {
    id: "fiscalite",
    libelle: "Fiscalité et dépense publique",
    question: "Sur les impôts et la dépense publique, quelle position vous parle le plus ?",
    positions: [
      { id: "redistribution", libelle: "Plus de redistribution", definition: "augmenter des impôts ou des prélèvements sur les plus aisés ou le capital, ou étendre des dépenses et prestations de solidarité" },
      { id: "baisse_impots", libelle: "Moins d'impôts et moins de dépense publique", definition: "baisser des impôts ou des prélèvements, ou réduire la dépense publique ou le nombre de fonctionnaires" },
    ],
  },
  {
    id: "securite",
    libelle: "Sécurité et justice",
    question: "Sur la sécurité et la justice, quelle position vous parle le plus ?",
    positions: [
      { id: "repression", libelle: "Priorité à la répression", definition: "durcir les peines, renforcer les moyens de la police, de la prison ou les pouvoirs de sanction" },
      { id: "prevention", libelle: "Priorité à la prévention", definition: "privilégier la prévention, l'éducation, l'insertion, les peines alternatives ou la réinsertion plutôt que la sanction" },
    ],
  },
  {
    id: "travail",
    libelle: "Travail et retraites",
    question: "Sur le travail et les retraites, quelle position vous parle le plus ?",
    positions: [
      { id: "travailler_plus", libelle: "Travailler plus longtemps", definition: "reculer ou durcir l'âge ou la durée de cotisation pour la retraite, ou allonger le temps de travail" },
      { id: "age_actuel", libelle: "Conserver l'âge actuel de départ", definition: "maintenir ou ramener l'âge légal de départ à la retraite, sans l'allonger" },
      { id: "travailler_moins", libelle: "Travailler moins longtemps", definition: "avancer l'âge de départ à la retraite, réduire la durée de cotisation ou le temps de travail" },
    ],
  },
  {
    id: "libertes",
    libelle: "Libertés et société",
    question: "Sur les libertés et la société, quelle position vous parle le plus ?",
    positions: [
      { id: "libertes_indiv", libelle: "Plus de libertés individuelles", definition: "étendre des libertés ou des droits individuels (choix de vie, expression, vie privée, nouveaux droits) ou lever des interdits" },
      { id: "cadre_collectif", libelle: "Plus de cadre collectif", definition: "renforcer des règles communes, des interdits ou l'autorité de l'État sur les comportements, l'ordre moral ou l'identité collective" },
    ],
  },
  // --- Sujets précis ajoutés le 2026-10-06 à la demande du porteur du projet (les neuf premiers sont larges ; ceux-ci
  // posent la question comme un citoyen se la pose). Même règle : deux positions opposées, aucune mise en avant.
  // À RELIRE par le porteur du projet : la formulation de chaque position décide de ce que le modèle étiquette.
  {
    id: "police_armement",
    libelle: "Armement de la police",
    question: "Sur l'armement de la police, quelle position vous parle le plus ?",
    positions: [
      { id: "police_armee", libelle: "Garder ou renforcer l'armement de la police", definition: "maintenir ou renforcer l'armement et les moyens d'intervention de la police (armes, lanceurs de balles de défense, grenades, pistolets à impulsion électrique)" },
      { id: "police_desarmee", libelle: "Désarmer la police ou limiter son armement", definition: "retirer ou limiter des armes de la police (lanceurs de balles de défense, grenades, armes létales) ou encadrer plus strictement leur usage" },
    ],
  },
  {
    id: "ultra_riches",
    libelle: "Très hauts patrimoines et revenus",
    question: "Sur les très hauts patrimoines et revenus, quelle position vous parle le plus ?",
    positions: [
      { id: "taxer_ultra_riches", libelle: "Taxer davantage les ultra-riches", definition: "créer ou augmenter un impôt sur les très hauts patrimoines, revenus, héritages ou profits (impôt sur la fortune, taxe plancher, tranche supérieure d'impôt)" },
      { id: "ne_pas_taxer_ultra_riches", libelle: "Ne pas alourdir leur fiscalité", definition: "refuser ou supprimer un impôt sur les très hauts patrimoines, revenus, héritages ou le capital, ou alléger leur fiscalité (prélèvement forfaitaire, suppression de l'impôt sur la fortune)" },
    ],
  },
  {
    id: "ecole_organisation",
    libelle: "Système éducatif",
    question: "Sur le système éducatif, quelle position vous parle le plus ?",
    positions: [
      { id: "reformer_ecole", libelle: "Revoir en profondeur le système éducatif", definition: "refondre l'organisation, les programmes, les rythmes ou le statut de l'école (nouvelle structure, autonomie des établissements, réforme du collège, du lycée ou du baccalauréat)" },
      { id: "ecole_continuite", libelle: "Garder le cadre actuel et le consolider", definition: "conserver l'organisation actuelle de l'école et la consolider (moyens, effectifs, fondamentaux) sans en refondre la structure" },
    ],
  },
  {
    id: "ecole_discipline",
    libelle: "Discipline à l'école",
    question: "Sur la discipline à l'école, quelle position vous parle le plus ?",
    positions: [
      { id: "ecole_exigence", libelle: "Plus d'autorité et de sanctions", definition: "durcir la discipline à l'école : sanctions, exclusions, uniforme, internats, redoublement ou évaluation plus exigeante" },
      { id: "ecole_bienveillance", libelle: "Plus de bienveillance et d'accompagnement", definition: "privilégier l'accompagnement, la médiation, l'inclusion et la réduction des sanctions à l'école" },
    ],
  },
  {
    id: "manifestations",
    libelle: "Manifestations",
    question: "Sur les manifestations, quelle position vous parle le plus ?",
    positions: [
      { id: "maintien_ordre_ferme", libelle: "Plus de fermeté face aux violences en manifestation", definition: "durcir l'encadrement ou les sanctions : interpellations, interdictions de manifester, peines contre les casseurs et manifestants violents, y compris les mineurs et les jeunes" },
      { id: "droit_manifester", libelle: "Protéger le droit de manifester", definition: "garantir ou élargir le droit de manifester, limiter l'usage de la force par la police et les interpellations préventives" },
    ],
  },
  {
    id: "parents_mineurs",
    libelle: "Parents de mineurs délinquants",
    question: "Sur les parents de mineurs délinquants, quelle position vous parle le plus ?",
    positions: [
      { id: "sanctionner_parents", libelle: "Sanctionner les parents (amendes, allocations)", definition: "prévoir des sanctions financières ou pénales pour les parents de mineurs délinquants (amendes, suppression ou suspension d'allocations, stage parental obligatoire)" },
      { id: "accompagner_parents", libelle: "Accompagner les familles plutôt que les sanctionner", definition: "privilégier le soutien éducatif et social aux parents plutôt que des sanctions financières ou pénales" },
    ],
  },
  {
    id: "justice_mineurs",
    libelle: "Justice des mineurs",
    question: "Sur la justice des mineurs, quelle position vous parle le plus ?",
    positions: [
      { id: "durcir_justice_mineurs", libelle: "Durcir la justice des mineurs", definition: "abaisser la majorité pénale, supprimer ou limiter l'excuse de minorité, alourdir les peines des mineurs ou créer des centres fermés" },
      { id: "priorite_educative", libelle: "Garder la priorité à l'éducatif", definition: "maintenir ou renforcer la primauté de l'éducatif dans la justice des mineurs et les alternatives à l'enfermement" },
    ],
  },
  {
    id: "prison",
    libelle: "Prison",
    question: "Sur la prison, quelle position vous parle le plus ?",
    positions: [
      { id: "plus_de_prison", libelle: "Plus de places de prison et des peines plus longues", definition: "construire des places de prison, instaurer des peines planchers, allonger les peines ou limiter les aménagements de peine" },
      { id: "alternatives_prison", libelle: "Moins de prison, plus d'alternatives", definition: "réduire la population carcérale, développer les peines alternatives (travail d'intérêt général, bracelet électronique) ou lutter contre la surpopulation" },
    ],
  },
  {
    id: "salaires",
    libelle: "SMIC et salaires",
    question: "Sur le SMIC et les salaires, quelle position vous parle le plus ?",
    positions: [
      { id: "hausse_smic", libelle: "Augmenter fortement le SMIC et les salaires", definition: "revaloriser nettement le SMIC, indexer les salaires sur les prix ou imposer une hausse des salaires" },
      { id: "moderer_salaires", libelle: "Ne pas imposer de hausse, alléger le coût du travail", definition: "refuser une hausse imposée du SMIC ou des salaires et privilégier la baisse des cotisations ou des primes défiscalisées" },
    ],
  },
  {
    id: "temps_travail",
    libelle: "Temps de travail",
    question: "Sur le temps de travail, quelle position vous parle le plus ?",
    positions: [
      { id: "reduire_temps_travail", libelle: "Réduire le temps de travail", definition: "réduire la durée légale du travail (32 heures, semaine de quatre jours, sixième semaine de congés)" },
      { id: "travailler_davantage", libelle: "Travailler davantage", definition: "encourager ou défiscaliser les heures supplémentaires, assouplir ou supprimer les 35 heures, allonger la durée du travail" },
    ],
  },
  {
    id: "aides_sociales",
    libelle: "Aides sociales et chômage",
    question: "Sur les aides sociales et le chômage, quelle position vous parle le plus ?",
    positions: [
      { id: "conditionner_aides", libelle: "Ajouter des conditions aux aides et à l'indemnisation", definition: "imposer une activité en contrepartie du RSA, rendre l'assurance chômage plus dégressive ou plus stricte, renforcer les contrôles" },
      { id: "proteger_droits_sociaux", libelle: "Garder les aides et l'indemnisation telles qu'elles sont", definition: "maintenir ou étendre l'assurance chômage et les minima sociaux, sans contrepartie supplémentaire ; relever les minima" },
    ],
  },
  {
    id: "fonction_publique",
    libelle: "Fonctionnaires et services publics",
    question: "Sur les fonctionnaires et les services publics, quelle position vous parle le plus ?",
    positions: [
      { id: "moins_fonctionnaires", libelle: "Réduire le nombre de fonctionnaires", definition: "supprimer des postes de fonctionnaires, geler les embauches ou mettre fin au statut" },
      { id: "plus_services_publics", libelle: "Recruter et renforcer les services publics", definition: "créer des postes dans les services publics (hôpital, école, police, justice) ou renforcer leurs moyens" },
    ],
  },
  {
    id: "sante_organisation",
    libelle: "Organisation de la santé",
    question: "Sur l'organisation de la santé, quelle position vous parle le plus ?",
    positions: [
      { id: "hopital_public", libelle: "Renforcer l'hôpital public et réguler l'installation des médecins", definition: "donner plus de moyens à l'hôpital public, réguler l'installation des médecins ou développer des centres de santé publics" },
      { id: "liberte_sante", libelle: "Plus de liberté et de place au privé en santé", definition: "maintenir la liberté d'installation des médecins, développer le secteur privé ou les complémentaires, donner plus d'autonomie aux établissements" },
    ],
  },
  {
    id: "logement",
    libelle: "Logement",
    question: "Sur le logement, quelle position vous parle le plus ?",
    positions: [
      { id: "encadrer_logement", libelle: "Encadrer les loyers et construire du logement social", definition: "encadrer les loyers, imposer ou développer le logement social, taxer les logements vacants ou réguler les locations touristiques" },
      { id: "liberer_offre_logement", libelle: "Libérer l'offre de logement privée", definition: "alléger la fiscalité ou les contraintes des propriétaires, supprimer l'encadrement des loyers, assouplir les normes ou encourager l'investissement locatif" },
    ],
  },
  {
    id: "droit_du_sol",
    libelle: "Droit du sol et nationalité",
    question: "Sur le droit du sol et la nationalité, quelle position vous parle le plus ?",
    positions: [
      { id: "droit_sol_maintenu", libelle: "Garder ou élargir le droit du sol", definition: "maintenir ou élargir l'acquisition de la nationalité française par la naissance ou la résidence en France" },
      { id: "droit_sol_restreint", libelle: "Restreindre le droit du sol et l'accès à la nationalité", definition: "durcir ou supprimer le droit du sol, renforcer les conditions de naturalisation ou étendre la déchéance de nationalité" },
    ],
  },
  {
    id: "laicite",
    libelle: "Laïcité et signes religieux",
    question: "Sur la laïcité et les signes religieux, quelle position vous parle le plus ?",
    positions: [
      { id: "liberte_religieuse", libelle: "Garder la laïcité actuelle", definition: "maintenir la liberté de porter des signes religieux dans l'espace public et s'opposer à de nouveaux interdits" },
      { id: "laicite_stricte", libelle: "Étendre les règles de laïcité", definition: "interdire ou restreindre le port de signes religieux (voile, foulard) dans davantage de lieux ou renforcer la neutralité dans l'espace public" },
    ],
  },
  {
    id: "fin_de_vie",
    libelle: "Fin de vie",
    question: "Sur la fin de vie, quelle position vous parle le plus ?",
    positions: [
      { id: "aide_active_mourir", libelle: "Légaliser l'aide active à mourir", definition: "autoriser l'euthanasie ou le suicide assisté, dans un cadre légal" },
      { id: "soins_palliatifs", libelle: "Ne pas légaliser l'aide active à mourir", definition: "refuser l'euthanasie et le suicide assisté et privilégier les soins palliatifs" },
    ],
  },
  {
    id: "cannabis",
    libelle: "Cannabis",
    question: "Sur le cannabis, quelle position vous parle le plus ?",
    positions: [
      { id: "legaliser_cannabis", libelle: "Légaliser ou dépénaliser le cannabis", definition: "légaliser, réguler la vente ou dépénaliser l'usage du cannabis" },
      { id: "interdit_cannabis", libelle: "Maintenir ou durcir l'interdiction", definition: "maintenir ou durcir l'interdiction et les sanctions contre l'usage et le trafic de cannabis" },
    ],
  },
  {
    id: "defense",
    libelle: "Défense et armée",
    question: "Sur la défense et l'armée, quelle position vous parle le plus ?",
    positions: [
      { id: "plus_defense", libelle: "Augmenter l'effort militaire", definition: "augmenter le budget de la défense, réarmer ou rétablir un service national ou militaire" },
      { id: "moins_defense", libelle: "Ne pas augmenter l'effort militaire", definition: "refuser d'augmenter le budget militaire et privilégier la diplomatie, le désarmement ou d'autres dépenses" },
    ],
  },
  {
    id: "agriculture_normes",
    libelle: "Agriculture et environnement",
    question: "Sur l'agriculture et l'environnement, quelle position vous parle le plus ?",
    positions: [
      { id: "assouplir_normes_agri", libelle: "Alléger les normes agricoles et environnementales", definition: "assouplir ou supprimer des normes agricoles et environnementales (pesticides, eau, haies) ou simplifier les contraintes" },
      { id: "renforcer_normes_agri", libelle: "Renforcer la protection de l'environnement en agriculture", definition: "restreindre les pesticides, soutenir l'agriculture biologique ou imposer des normes environnementales plus strictes" },
    ],
  },
  {
    id: "voiture",
    libelle: "Voiture et déplacements",
    question: "Sur la voiture et les déplacements, quelle position vous parle le plus ?",
    positions: [
      { id: "defendre_voiture", libelle: "Moins de restrictions pour la voiture", definition: "supprimer ou assouplir les zones à faibles émissions, les restrictions de circulation et la fin des véhicules thermiques" },
      { id: "restreindre_voiture", libelle: "Plus de restrictions pour la voiture, plus de transports", definition: "maintenir ou renforcer les zones à faibles émissions, la fin des véhicules thermiques, ou donner la priorité aux transports collectifs et au vélo" },
    ],
  },
  {
    id: "institutions",
    libelle: "Institutions politiques",
    question: "Sur les institutions politiques, quelle position vous parle le plus ?",
    positions: [
      { id: "nouvelles_institutions", libelle: "Changer les institutions (VIe République, proportionnelle)", definition: "écrire une nouvelle constitution, instaurer la proportionnelle, le référendum d'initiative citoyenne ou une assemblée constituante" },
      { id: "institutions_actuelles", libelle: "Garder les institutions de la Ve République", definition: "maintenir les institutions de la Ve République, avec au plus des réformes limitées" },
    ],
  },
  {
    id: "surveillance",
    libelle: "Surveillance et vie privée",
    question: "Sur la surveillance et la vie privée, quelle position vous parle le plus ?",
    positions: [
      { id: "plus_surveillance", libelle: "Étendre la surveillance pour la sécurité", definition: "étendre la vidéosurveillance, la reconnaissance faciale, l'accès aux données ou aux messageries à des fins de sécurité" },
      { id: "vie_privee", libelle: "Protéger la vie privée", definition: "limiter la surveillance de masse, la reconnaissance faciale ou l'accès aux données et messageries, au nom de la vie privée" },
    ],
  },
  {
    id: "dette",
    libelle: "Dette et déficit",
    question: "Sur la dette et le déficit, quelle position vous parle le plus ?",
    positions: [
      { id: "reduire_dette", libelle: "Priorité à la réduction de la dette et du déficit", definition: "réduire le déficit et la dette publique en priorité (économies, règle budgétaire, désendettement)" },
      { id: "investir_dette", libelle: "Priorité à l'investissement, même avec plus de déficit", definition: "financer des investissements ou des dépenses publiques même au prix d'un déficit plus élevé, ou refuser l'austérité" },
    ],
  },
  {
    id: "commerce",
    libelle: "Commerce et protection de l'économie",
    question: "Sur le commerce et la protection de l'économie, quelle position vous parle le plus ?",
    positions: [
      { id: "protectionnisme", libelle: "Protéger l'économie nationale", definition: "taxer ou limiter les importations, imposer une préférence nationale ou européenne, protéger des secteurs ou relocaliser" },
      { id: "libre_echange", libelle: "Défendre le libre-échange et l'ouverture", definition: "défendre le libre-échange, signer ou maintenir des accords commerciaux, s'opposer aux barrières douanières" },
    ],
  },
  {
    id: "entreprises",
    libelle: "Entreprises",
    question: "Sur les entreprises, quelle position vous parle le plus ?",
    positions: [
      { id: "soutenir_entreprises", libelle: "Alléger la fiscalité et les charges des entreprises", definition: "baisser l'impôt sur les sociétés, les impôts de production ou les cotisations patronales, simplifier les règles, aider l'embauche ou l'investissement des entreprises" },
      { id: "encadrer_entreprises", libelle: "Faire davantage contribuer et encadrer les entreprises", definition: "taxer les superprofits ou les grandes entreprises, relever l'impôt sur les sociétés, conditionner les aides publiques, encadrer les dividendes, les licenciements ou les rémunérations" },
    ],
  },
  {
    // Décision du 2026-11-01 : la décentralisation (marges locales pour les communes, les préfets et les élus) est un axe distinct
    // des « Institutions politiques » (Ve ou VIe République) ; plusieurs candidats la portent (Lisnard en tête).
    id: "decentralisation",
    libelle: "Décentralisation et pouvoir local",
    question: "Sur la décentralisation et le pouvoir local, quelle position vous parle le plus ?",
    positions: [
      { id: "decentraliser", libelle: "Donner plus de pouvoir aux communes et aux territoires", definition: "transférer des compétences, des moyens ou des marges de décision aux communes, aux départements, aux régions ou aux préfets, ou supprimer des agences nationales au profit des élus locaux" },
      { id: "etat_central", libelle: "Garder un État central fort et des règles communes", definition: "maintenir ou renforcer les compétences de l'État national, l'uniformité des règles et le contrôle central sur les collectivités" },
    ],
  },
  // Décision du 2026-11-01 (audit des questions, après le cas Lisnard) : quatre axes que des mesures de plusieurs candidats portent
  // et qu'aucun sujet ne capturait. Les libellés de chaque paire sont parallèles et neutres (aucun côté n'est plus valorisant).
  {
    id: "simplification",
    libelle: "Simplification et normes",
    question: "Sur la simplification des normes et des démarches, quelle position vous parle le plus ?",
    positions: [
      { id: "simplifier_normes", libelle: "Simplifier et réduire les normes et les démarches", definition: "supprimer, regrouper ou alléger des normes, des codes, des procédures ou des autorisations ; réduire la bureaucratie ; interdire la surtransposition des textes européens" },
      { id: "maintenir_normes", libelle: "Maintenir ou renforcer les règles et leur contrôle", definition: "maintenir ou renforcer des normes, des contrôles et des sanctions administratives, ou créer de nouvelles règles protectrices" },
    ],
  },
  {
    id: "prix_publics",
    libelle: "Prix et services publics",
    question: "Sur les prix et la propriété des services essentiels, quelle position vous parle le plus ?",
    positions: [
      { id: "encadrer_prix", libelle: "Encadrer les prix et reprendre la main publique", definition: "encadrer ou plafonner des prix ou des marges, renationaliser ou garder sous contrôle public des services essentiels (autoroutes, énergie, transports), lutter contre les monopoles" },
      { id: "marche_prix", libelle: "Laisser les prix et les services au marché", definition: "refuser l'encadrement des prix, privatiser ou ouvrir à la concurrence des services, laisser jouer le marché" },
    ],
  },
  {
    id: "droit_travail",
    libelle: "Droit du travail",
    question: "Sur le droit du travail, quelle position vous parle le plus ?",
    positions: [
      { id: "proteger_salaries", libelle: "Protéger davantage les salariés", definition: "limiter les CDD et la précarité, renforcer la protection contre le licenciement, les conditions de travail et les droits des salariés" },
      { id: "assouplir_travail", libelle: "Assouplir le droit du travail", definition: "assouplir le droit du travail, faciliter les contrats, les licenciements ou l'organisation du travail pour les entreprises" },
    ],
  },
  {
    id: "systeme_retraite",
    libelle: "Système de retraite",
    question: "Sur le système de retraite, quelle position vous parle le plus ?",
    positions: [
      { id: "repartition", libelle: "Garder la retraite par répartition", definition: "maintenir ou renforcer le système de retraite par répartition (financé par les cotisations actuelles), sans part individuelle" },
      { id: "capitalisation", libelle: "Ajouter une part de capitalisation ou de choix individuel", definition: "introduire ou développer la capitalisation, des comptes individuels, le déblocage ou le choix individuel d'une épargne retraite" },
    ],
  },
  {
    // Décision du 2026-10-18 : Parcoursup est un sujet d'actualité (mobilisation lycéenne et étudiante d'octobre 2026) et
    // six mesures de la base agregateurs le traitent dans des sens opposés ; « Système éducatif » ne le couvrait pas.
    id: "enseignement_superieur",
    libelle: "Accès à l'enseignement supérieur",
    question: "Sur l'accès à l'enseignement supérieur (Parcoursup), quelle position vous parle le plus ?",
    positions: [
      { id: "selection_superieur", libelle: "Garder une sélection à l'entrée, fondée sur le mérite", definition: "maintenir ou renforcer une sélection à l'entrée des formations supérieures, au mérite ou sur dossier (Parcoursup conservé ou refondé au seul mérite, examen d'entrée, numerus clausus)" },
      { id: "acces_libre_superieur", libelle: "Ouvrir l'accès sans sélection", definition: "supprimer ou remplacer Parcoursup par un accès sans sélection ou une orientation sans algorithme ni lettre de motivation, ouvrir davantage de places dans les universités" },
    ],
  },
];

// Choix du visiteur : identifiant de sujet → identifiant de position. Un sujet absent = « pas d'avis ».
export type ChoixPositions = Record<string, string>;

export function trouverSujet(id: string): SujetConviction | undefined {
  return SUJETS_CONVICTION.find((s) => s.id === id);
}

export function trouverPosition(sujetId: string, positionId: string): PositionConviction | undefined {
  return trouverSujet(sujetId)?.positions.find((p) => p.id === positionId);
}

// Position qu'une MESURE défend, établie par le modèle d'étiquetage puis vérifiée (extrait retrouvé mot pour mot).
export interface PositionMesure {
  sujet: string;
  position: string;
  source_url: string;
  extrait: string;
}

export function validerPositionMesure(brut: unknown): brut is PositionMesure {
  if (typeof brut !== "object" || brut === null) return false;
  const p = brut as Record<string, unknown>;
  return (
    typeof p.sujet === "string" &&
    typeof p.position === "string" &&
    trouverPosition(p.sujet, p.position) !== undefined &&
    typeof p.source_url === "string" &&
    p.source_url.length > 0 &&
    typeof p.extrait === "string" &&
    p.extrait.trim().length >= 10
  );
}
