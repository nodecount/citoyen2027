import {
  Briefcase,
  Building,
  Globe,
  GraduationCap,
  HeartHandshake,
  HeartPulse,
  Hourglass,
  House,
  Landmark,
  Leaf,
  Scale,
  Shield,
  ShieldAlert,
  Tag,
  Wallet,
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

export function IconeTheme({ themeId, taille = 18 }: { themeId: string; taille?: number }) {
  const Icone = iconeDuTheme(themeId);
  return <Icone size={taille} aria-hidden="true" focusable="false" className="icone-theme" />;
}
