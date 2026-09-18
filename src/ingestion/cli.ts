export interface OptionsCLI {
  candidats: string[];
  themes?: string[];
  refresh?: { slug: string; theme?: string };
  force?: boolean;
}

export function analyserArguments(argv: string[]): OptionsCLI {
  const options: OptionsCLI = { candidats: [] };

  for (const argument of argv) {
    if (argument === "--force") {
      options.force = true;
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
