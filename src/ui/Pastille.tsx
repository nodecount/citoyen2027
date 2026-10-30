import portraitsJson from "../../data/portraits.json";
import { PREFIXE_ANONYME } from "./aveugle";
import { initiales } from "./portrait";

export interface Portrait {
  fichier: string;
  wikidata: string;
  auteur: string;
  licence: string;
  licence_url: string;
  source_url: string;
}

// Photos sous licence libre copiées dans static/ (voir src/scraping/run-portraits.ts) : servies par le site lui-même,
// aucune requête vers un service tiers pendant la visite.
export const PORTRAITS = portraitsJson as Record<string, Portrait>;

interface PastilleProps {
  slug: string;
  nom: string;
  className?: string;
  // Quand la pastille porte seule une information (candidat sans mesure, non cliquable), elle a un nom accessible ;
  // sinon elle est décorative (le nom est déjà porté par le bouton ou écrit à côté).
  libelle?: string;
}

// Photo du candidat dans un cercle, ou ses initiales s'il n'y a pas de photo libre (même forme pour tous).
export function Pastille({ slug, nom, className, libelle }: PastilleProps) {
  const photo = PORTRAITS[slug];
  // Mode « à l'aveugle » : la lettre du candidat, jamais ses initiales ni sa photo.
  const contenu = slug.startsWith(PREFIXE_ANONYME) ? slug.slice(PREFIXE_ANONYME.length) : initiales(nom);
  const classes = ["pastille", photo ? "pastille--photo" : "", className ?? ""].filter(Boolean).join(" ");
  const accessibilite = libelle ? { role: "img", "aria-label": libelle, title: libelle } : { "aria-hidden": true as const };
  return (
    <span className={classes} {...accessibilite}>
      {photo ? <img src={`${import.meta.env.BASE_URL}${photo.fichier}`} alt="" loading="lazy" decoding="async" /> : contenu}
    </span>
  );
}
