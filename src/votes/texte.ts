// Texte d'une loi telle que publiée par l'Assemblée nationale (page « opendata » d'un texte adopté) : HTML → texte brut →
// articles. Le texte reste celui de la source, mot pour mot (seuls les balises, entités et espaces sont normalisés), parce
// que les effets structurés ensuite doivent citer des extraits retrouvés dans ce texte.

// Lettres accentuées et ponctuation que les pages du Sénat écrivent en entités (« S&eacute;nat ») : les remplacer par une espace
// ferait perdre les accents, donc les extraits cités ne se retrouveraient plus mot pour mot. Toute autre entité inconnue devient une espace.
const ENTITES: Record<string, string> = {
  eacute: "é", egrave: "è", ecirc: "ê", euml: "ë", agrave: "à", acirc: "â", auml: "ä", icirc: "î", iuml: "ï", ocirc: "ô", ouml: "ö",
  ugrave: "ù", ucirc: "û", uuml: "ü", ccedil: "ç", Eacute: "É", Egrave: "È", Ecirc: "Ê", Agrave: "À", Acirc: "Â", Icirc: "Î", Ocirc: "Ô",
  Ugrave: "Ù", Ucirc: "Û", Ccedil: "Ç", oelig: "œ", OElig: "Œ", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", ndash: "–", mdash: "—",
  hellip: "…", deg: "°", euro: "€", middot: "·", sect: "§",
};

function decoderEntite(_entite: string, nom: string): string {
  if (nom.startsWith("#")) {
    const code = nom[1] === "x" || nom[1] === "X" ? parseInt(nom.slice(2), 16) : parseInt(nom.slice(1), 10);
    return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : " ";
  }
  return ENTITES[nom] ?? " ";
}
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
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, decoderEntite)
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
