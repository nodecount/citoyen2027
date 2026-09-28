import {
  Accessibility,
  Baby,
  Briefcase,
  Building,
  CalendarDays,
  Car,
  Church,
  CircleHelp,
  Clock,
  FileCheck,
  Flag,
  Globe,
  GraduationCap,
  Hammer,
  HandHeart,
  HeartHandshake,
  HeartPulse,
  Hourglass,
  House,
  KeyRound,
  Landmark,
  Leaf,
  MapPin,
  PiggyBank,
  Scale,
  School,
  Shield,
  ShieldAlert,
  Tag,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";

// Icône d'un thème, choisie par mots-clés de son identifiant : les thèmes diffèrent d'une base à l'autre, et une base
// ajoutée demain doit s'afficher sans code (icône générique à défaut). L'icône est décorative : le nom du thème est
// toujours écrit à côté.
const REGLES: Array<[RegExp, LucideIcon]> = [
  [/fiscal|finance/, Landmark],
  [/pouvoir-achat/, Wallet],
  [/retraite/, Hourglass],
  [/travail|emploi/, Briefcase],
  [/aides|social/, HeartHandshake],
  [/logement/, House],
  [/sante/, HeartPulse],
  [/education/, GraduationCap],
  [/defense/, ShieldAlert],
  [/securite|interieur|justice/, Shield],
  [/immigration|europe|international/, Globe],
  [/environnement/, Leaf],
  [/libertes|gouvernance/, Scale],
  [/etat/, Building],
];

export function iconeDuTheme(themeId: string): LucideIcon {
  return REGLES.find(([motif]) => motif.test(themeId))?.[1] ?? Tag;
}

// Icône d'une question du formulaire, par identifiant de critère : elle aide à repérer la question d'un coup d'œil.
// Décorative (le libellé de la question est toujours écrit) ; icône générique pour un critère ajouté demain.
const ICONES_QUESTIONS: Record<string, LucideIcon> = {
  tranche_age: CalendarDays,
  statut_professionnel: Briefcase,
  tranche_revenus: Wallet,
  situation_familiale: Users,
  nombre_enfants: Baby,
  logement: House,
  territoire: MapPin,
  metier: Wrench,
  nationalite: Flag,
  statut_sejour: FileCheck,
  aides_percues: HeartHandshake,
  handicap: Accessibility,
  tranche_patrimoine: PiggyBank,
  logements_hors_residence: Building,
  logement_social: Building,
  projet_achat: KeyRound,
  vehicule: Car,
  metier_penible: Hammer,
  carriere_longue: Clock,
  aidant_familial: HandHeart,
  enfants_scolarises: School,
  ne_en_france_parents_etrangers: Globe,
  port_signes_religieux: Church,
};

export function iconeDeQuestion(champId: string): LucideIcon {
  return ICONES_QUESTIONS[champId] ?? CircleHelp;
}

export function IconeTheme({ themeId, taille = 18 }: { themeId: string; taille?: number }) {
  const Icone = iconeDuTheme(themeId);
  return <Icone size={taille} aria-hidden="true" focusable="false" className="icone-theme" />;
}
