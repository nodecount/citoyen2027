// Texte d'une loi telle que publiée par l'Assemblée nationale (page « opendata » d'un texte adopté) : HTML → texte brut →
// articles. Le texte reste celui de la source, mot pour mot (seuls les balises, entités et espaces sont normalisés), parce
// que les effets structurés ensuite doivent citer des extraits retrouvés dans ce texte.

export function htmlEnTexte(html: string): string {
  const corps = html.includes("<body") ? html.slice(html.indexOf("<body")) : html;
  return corps
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\/p>|<br\s*\/?>|<\/div>|<\/h\d>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&laquo;/g, "«")
    .replace(/&raquo;/g, "»")
    .replace(/&#?\w+;/g, " ")
    .replace(/[ \t  ]+/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "")
    .join("\n");
}

// « 1er », « premier », « 1 », « 3 bis »… → clé normalisée (« 1 », « 3 bis »).
export function numeroArticle(brut: string): string {
  const net = brut.trim().toLowerCase().replace(/\s+/g, " ");
  if (/^(premier|1er)$/.test(net)) return "1";
  return net.replace(/^(\d+)(er|e|ème)\b/, "$1");
}

const SUFFIXES = "bis|ter|quater|quinquies|sexies|septies|octies|nonies|decies|[a-z]";

export const MOTIF_TITRE_ARTICLE = new RegExp(`^article\\s+(premier|1er|\\d+(?:\\s+(?:${SUFFIXES}))?)\\s*(?:\\(.*\\))?\\s*$`, "i");

// Découpe en articles : une ligne « Article N » ouvre un article, qui court jusqu'à la ligne « Article » suivante ou jusqu'à
// un intitulé de division (TITRE, CHAPITRE, Section…) qui n'appartient pas à l'article. Un article apparaît une seule fois :
// si une clé se répète (ex. rappel dans un sommaire), c'est la version la plus longue qui est gardée.
export function decouperArticles(texte: string): Map<string, string> {
  const articles = new Map<string, string>();
  const lignes = texte.split("\n");
  let cle: string | null = null;
  let courant: string[] = [];
  const fermer = () => {
    if (cle === null) return;
    const corps = courant.join("\n").trim();
    if (corps.length > (articles.get(cle)?.length ?? 0)) articles.set(cle, corps);
  };
  for (const ligne of lignes) {
    const m = ligne.match(MOTIF_TITRE_ARTICLE);
    if (m) {
      fermer();
      cle = numeroArticle(m[1]);
      courant = [];
      continue;
    }
    if (cle !== null && /^(TITRE|CHAPITRE|SECTION|Section|Sous-section|Livre)\b/.test(ligne) && /^(TITRE|CHAPITRE|SECTION)\b/i.test(ligne)) {
      fermer();
      cle = null;
      courant = [];
      continue;
    }
    if (cle !== null) courant.push(ligne);
  }
  fermer();
  return articles;
}

// Le scrutin d'un article s'intitule « l'article 2 de la proposition de loi… » ; renvoie la clé normalisée, ou null si le
// scrutin ne porte pas sur un article du texte (amendement, article additionnel, motion, ensemble du texte…).
export function articleDuScrutin(titre: string): string | null {
  const m = titre.match(new RegExp(`^l'article\\s+(premier|1er|\\d+(?:\\s+(?:${SUFFIXES}))?)\\s+(?:de|du|des)\\b`, "i"));
  return m ? numeroArticle(m[1]) : null;
}
