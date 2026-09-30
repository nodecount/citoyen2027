export type ModeIngestion = "corpus" | "recherche-web";
// « api » : API payante (crédit). « cli » : commande `claude -p`, sur l'abonnement (mode corpus seulement).
export type MoteurIngestion = "api" | "cli";

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
  // Ne refait que la synthèse (texte « en quoi le programme touche le thème ») des mesures déjà enregistrées :
  // quelques centimes, sans relire les documents ni ré-extraire.
  syntheseSeule: boolean;
  // Refait contrôles, relecture et synthèse à partir des extractions DÉJÀ payées (cache), sans jamais rappeler
  // l'extraction : quelques centimes par thème, utile après un changement des règles de contrôle.
  retraiter: boolean;
  moteur: MoteurIngestion;
  // Moteur « cli » : plafond du nombre d'appels du run (les fenêtres de quota de l'abonnement remplacent le solde en euros).
  maxAppels?: number;
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
    syntheseSeule: false,
    retraiter: false,
    moteur: "api",
  };

  for (const argument of argv) {
    if (argument === "--force") {
      options.force = true;
    } else if (argument === "--dry-run") {
      options.dryRun = true;
    } else if (argument === "--retraiter") {
      options.retraiter = true;
    } else if (argument === "--synthese-seule") {
      options.syntheseSeule = true;
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
    } else if (argument.startsWith("--moteur=")) {
      const moteur = argument.slice("--moteur=".length);
      if (moteur !== "api" && moteur !== "cli") throw new Error(`--moteur inconnu (« ${moteur} ») : « api » ou « cli » attendu`);
      options.moteur = moteur;
    } else if (argument.startsWith("--max-appels=")) {
      const n = Number(argument.slice("--max-appels=".length));
      if (!Number.isInteger(n) || n <= 0) throw new Error("--max-appels invalide : un entier strictement positif est attendu");
      options.maxAppels = n;
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
