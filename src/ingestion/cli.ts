export type ModeIngestion = "corpus" | "recherche-web";

export interface OptionsCLI {
  candidats: string[];
  themes?: string[];
  refresh?: { slug: string; theme?: string };
  force?: boolean;
  // « corpus » (défaut) : notre code lit les documents, le modèle interroge le texte. « recherche-web » : ancien
  // mode où le modèle cherche lui-même sur le web — très cher, conservé pour mémoire.
  mode: ModeIngestion;
  // Plafond dur de dépense, en euros. Défaut prudent : un candidat complet en mode corpus tient largement dedans.
  budgetEur: number;
  // Affiche le plan et le coût estimé sans appeler l'API payante.
  dryRun: boolean;
  actualiserSources: boolean;
}

export const BUDGET_PAR_DEFAUT_EUR = 2;

function lireBudget(valeur: string): number {
  const nombre = Number(valeur.replace(",", "."));
  if (!Number.isFinite(nombre) || nombre <= 0) {
    throw new Error(`--budget invalide (« ${valeur} ») : un montant en euros strictement positif est attendu`);
  }
  return nombre;
}

export function analyserArguments(argv: string[]): OptionsCLI {
  const options: OptionsCLI = {
    candidats: [],
    mode: "corpus",
    budgetEur: BUDGET_PAR_DEFAUT_EUR,
    dryRun: false,
    actualiserSources: false,
  };

  for (const argument of argv) {
    if (argument === "--force") {
      options.force = true;
    } else if (argument === "--dry-run") {
      options.dryRun = true;
    } else if (argument === "--actualiser-sources") {
      options.actualiserSources = true;
    } else if (argument.startsWith("--budget=")) {
      options.budgetEur = lireBudget(argument.slice("--budget=".length));
    } else if (argument.startsWith("--mode=")) {
      const mode = argument.slice("--mode=".length);
      if (mode !== "corpus" && mode !== "recherche-web") {
        throw new Error(`--mode inconnu (« ${mode} ») : « corpus » ou « recherche-web » attendu`);
      }
      options.mode = mode;
    } else if (argument.startsWith("--candidats=")) {
      options.candidats = argument.slice("--candidats=".length).split(",").filter(Boolean);
    } else if (argument.startsWith("--themes=")) {
      options.themes = argument.slice("--themes=".length).split(",").filter(Boolean);
    } else if (argument.startsWith("--refresh=")) {
      const valeur = argument.slice("--refresh=".length);
      const [slug, theme] = valeur.split(":");
      options.refresh = { slug, theme: theme || undefined };
    }
  }

  return options;
}
