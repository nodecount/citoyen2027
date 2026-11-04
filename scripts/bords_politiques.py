#!/usr/bin/env python3
"""Met à jour data/bords-politiques.json depuis Wikipédia.

Source : « Liste de partis politiques en France », section « Partis nationaux ».
L'article range chaque parti sous un titre de niveau 3 (Droite, Centre droit, Centre, …) : ce titre est le bord du parti.
Deux titres composés sont ramenés à un seul bord (NORMALISATION) : le projet n'affiche que les sept bords ci-dessous.

Usage :  python scripts/bords_politiques.py            (écrit le fichier)
         python scripts/bords_politiques.py --verifier (n'écrit rien, signale tout écart avec le fichier actuel)

Pour ajouter un candidat : ajouter une ligne à PARTIS (slug du dossier -> titre de l'article Wikipédia de son parti, tel qu'il
apparaît dans le lien [[…]] de la liste), puis relancer.
"""
import argparse
import json
import re
import sys
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

ARTICLE = "Liste_de_partis_politiques_en_France"
URL_ARTICLE = f"https://fr.wikipedia.org/wiki/{ARTICLE}"
URL_BRUT = f"https://fr.wikipedia.org/w/index.php?title={ARTICLE}&action=raw"
SORTIE = Path(__file__).resolve().parent.parent / "data" / "bords-politiques.json"

# Candidat (dossier de data/bases/*/programmes) -> parti, par le titre de son article Wikipédia.
PARTIS = {
    "arthaud": "Lutte ouvrière",
    "melenchon": "La France insoumise",
    "roussel": "Parti communiste français",
    "ruffin": "Debout !",
    "tondelier": "Les Écologistes",
    "faure": "Parti socialiste (France)",
    "glucksmann": "Place publique (parti politique)",
    "attal": "Renaissance (parti)",
    "philippe": "Horizons",
    "retailleau": "Les Républicains",
    "lisnard": "Les Républicains",
    "dupont-aignan": "Debout la France",
    "le-pen": "Rassemblement national",
    "zemmour": "Reconquête (parti politique)",
}

# Titres de l'article -> bord affiché. Les autres titres sont repris tels quels.
NORMALISATION = {
    "Gauche et gauche radicale": "Gauche",
    "Droite radicale et extrême droite": "Extrême droite",
}


def telecharger() -> str:
    requete = urllib.request.Request(URL_BRUT, headers={"User-Agent": "citoyen2027-bords/1.0 (https://github.com/nodecount/citoyen2027)"})
    with urllib.request.urlopen(requete, timeout=30) as reponse:
        return reponse.read().decode("utf-8")


def sections_des_partis_nationaux(wikitexte: str) -> dict[str, str]:
    """titre d'article du parti -> titre de la section où l'article le range (partis nationaux seulement)."""
    resultat: dict[str, str] = {}
    dans_nationaux = False
    section = None
    for ligne in wikitexte.splitlines():
        titre = re.match(r"^(={2,4})\s*([^=]+?)\s*\1\s*$", ligne) or re.match(r"^(={2,4})\s*(.+?)\s*\1\s*$", ligne)
        if titre:
            niveau, texte = len(titre.group(1)), re.sub(r"<ref.*", "", titre.group(2)).strip()
            if niveau == 2:
                dans_nationaux = texte.startswith("Partis nationaux")
                section = None
            elif niveau == 3 and dans_nationaux:
                section = texte
            continue
        # Une entrée de liste : le premier lien est le parti ; les sous-entrées (**) sont des partis à part entière.
        if dans_nationaux and section and ligne.lstrip().startswith("*"):
            lien = re.search(r"\[\[([^\]|#]+)", ligne)
            if lien:
                resultat.setdefault(lien.group(1).strip().replace("_", " "), section)
    return resultat


def construire(wikitexte: str) -> dict:
    sections = sections_des_partis_nationaux(wikitexte)
    bords, details, manquants = {}, {}, []
    for slug, parti in PARTIS.items():
        section = sections.get(parti)
        if section is None:
            manquants.append(f"{slug} ({parti})")
            continue
        bords[slug] = NORMALISATION.get(section, section)
        details[slug] = {"parti_wikipedia": parti, "section": section}
    if manquants:
        sys.exit("Parti introuvable dans la liste des partis nationaux : " + ", ".join(manquants))
    return {
        "source": f"Wikipédia, « Liste de partis politiques en France » ({URL_ARTICLE}), section « Partis nationaux ». Le bord est celui de la section où l'article range le parti du candidat ; attribué au parti, jamais au candidat seul. Généré par scripts/bords_politiques.py.",
        "date": date.today().isoformat(),
        "bords": bords,
        "details": details,
    }


def main() -> None:
    analyseur = argparse.ArgumentParser()
    analyseur.add_argument("--verifier", action="store_true", help="n'écrit rien : liste les écarts avec le fichier actuel")
    options = analyseur.parse_args()
    donnees = construire(telecharger())
    for slug, bord in donnees["bords"].items():
        brut = donnees["details"][slug]["section"]
        print(f"{slug:15} {bord}" + ("" if brut == bord else f"   (section « {brut} »)"))
    if options.verifier:
        actuel = json.loads(SORTIE.read_text(encoding="utf-8")).get("bords", {}) if SORTIE.exists() else {}
        ecarts = {s: (actuel.get(s), b) for s, b in donnees["bords"].items() if actuel.get(s) != b}
        print("Aucun écart." if not ecarts else "Écarts (actuel -> Wikipédia) : " + json.dumps(ecarts, ensure_ascii=False))
        sys.exit(1 if ecarts else 0)
    SORTIE.write_text(json.dumps(donnees, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Écrit : {SORTIE}")


if __name__ == "__main__":
    main()
