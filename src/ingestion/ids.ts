// Identifiants de propositions : slug, abréviation du thème, index sur 3 chiffres.
const ABREVIATIONS_THEME: Record<string, string> = {
  fiscalite: "fisc",
  "pouvoir-achat": "pa",
  travail: "trav",
  "aides-etat": "aides",
  "libertes-fondamentales": "lib",
  sante: "sante",
  securite: "secu",
  immigration: "immi",
  education: "educ",
  environnement: "envi",
  logement: "logt",
  retraites: "retr",
};

export function genererIdProposition(slug: string, themeId: string, index: number): string {
  const abreviation = ABREVIATIONS_THEME[themeId] ?? themeId;
  return `${slug}-${abreviation}-${String(index).padStart(3, "0")}`;
}

