#!/usr/bin/env python3
"""Met à jour data/casier-politique.json depuis casier-politique.fr.

Source : les données ouvertes du site (dépôt https://codeberg.org/raphael-jolivet/crapulopedia, fichiers data/out/affaires-out.csv
et data/out/politicians.csv), plutôt que les pages du site, qui sont générées par un serveur NiceGUI. Les données sont publiées
sous licence CC BY-NC-SA 4.0 (Raphaël Jolivet) : attribution obligatoire, usage non commercial, partage dans les mêmes conditions.

On ne garde que les candidats du projet (CANDIDATS). Rien n'est interprété : les champs du site sont repris tels quels, avec leurs
unités (prison et inéligibilité en mois, amende en euros) et l'état du recours donné par le site (definitif, appel, cassation).
Une absence du candidat dans le fichier n'est jamais une absence de condamnation.

Usage :  python scripts/casier_politique.py            (écrit le fichier)
         python scripts/casier_politique.py --verifier (n'écrit rien, signale tout écart avec le fichier actuel)
"""
import argparse
import csv
import io
import json
import sys
import unicodedata
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

DEPOT = "https://codeberg.org/api/v1/repos/raphael-jolivet/crapulopedia/raw"
URL_AFFAIRES = f"{DEPOT}/data/out/affaires-out.csv?ref=main"
URL_POLITICIENS = f"{DEPOT}/data/out/politicians.csv?ref=main"
SITE = "https://casier-politique.fr/"
LICENCE = "CC BY-NC-SA 4.0"
URL_LICENCE = "https://creativecommons.org/licenses/by-nc-sa/4.0/"
SORTIE = Path(__file__).resolve().parent.parent / "data" / "casier-politique.json"

# Candidat (dossier de data/bases/*/programmes) -> nom tel qu'il s'écrit sur le site (comparaison sans accents ni casse).
CANDIDATS = {
    "arthaud": "Nathalie Arthaud",
    "attal": "Gabriel Attal",
    "dupont-aignan": "Nicolas Dupont-Aignan",
    "faure": "Olivier Faure",
    "glucksmann": "Raphaël Glucksmann",
    "le-pen": "Marine Le Pen",
    "lisnard": "David Lisnard",
    "melenchon": "Jean-Luc Mélenchon",
    "philippe": "Édouard Philippe",
    "retailleau": "Bruno Retailleau",
    "roussel": "Fabien Roussel",
    "ruffin": "François Ruffin",
    "tondelier": "Marine Tondelier",
    "zemmour": "Éric Zemmour",
}


def telecharger(url: str) -> str:
    requete = urllib.request.Request(url, headers={"User-Agent": "citoyen2027-casier/1.0 (https://github.com/nodecount/citoyen2027)"})
    with urllib.request.urlopen(requete, timeout=60) as reponse:
        return reponse.read().decode("utf-8")


def cle(nom: str) -> str:
    sans_accents = "".join(c for c in unicodedata.normalize("NFD", nom) if unicodedata.category(c) != "Mn")
    return " ".join(sans_accents.casefold().split())


def entier(valeur: str) -> int:
    return int(float(valeur)) if valeur.strip() else 0


def construire(csv_affaires: str, csv_politiciens: str) -> dict:
    identifiants = {cle(ligne["name"]): ligne["id"] for ligne in csv.DictReader(io.StringIO(csv_politiciens))}
    par_nom = {cle(nom): slug for slug, nom in CANDIDATS.items()}
    candidats: dict[str, dict] = {}
    for ligne in csv.DictReader(io.StringIO(csv_affaires)):
        slug = par_nom.get(cle(ligne["politician"]))
        if slug is None:
            continue
        identifiant = identifiants.get(cle(ligne["politician"]))
        fiche = f"{SITE}p/{urllib.parse.quote(identifiant + '_' + ligne['politician'].strip())}" if identifiant else None
        fiche_candidat = candidats.setdefault(slug, {"nom_sur_le_site": ligne["politician"].strip(), "fiche": fiche, "parti_sur_le_site": ligne["party"], "affaires": []})
        fiche_candidat["affaires"].append(
            {
                "annee": entier(ligne["annee"]),
                "affaire": ligne["affaire"].strip(),
                "recours": ligne["recours"].strip(),
                "prison_mois": entier(ligne["prison_total"]),
                "prison_avec_sursis_mois": entier(ligne["prison_sursis"]),
                "amende_euros": entier(ligne["amende_total"]),
                "amende_avec_sursis_euros": entier(ligne["amende_sursis"]),
                "ineligibilite_mois": entier(ligne["ineligibilite_total"]),
                "ineligibilite_avec_sursis_mois": entier(ligne["ineligibilite_sursis"]),
            }
        )
    for fiche_candidat in candidats.values():
        fiche_candidat["affaires"].sort(key=lambda a: (-a["annee"], a["affaire"]))
    return {
        "source": f"casier-politique.fr ({SITE}), de Raphaël Jolivet, données ouvertes du dépôt https://codeberg.org/raphael-jolivet/crapulopedia (data/out/affaires-out.csv). Licence {LICENCE} ({URL_LICENCE}) : attribution, usage non commercial, partage dans les mêmes conditions. Généré par scripts/casier_politique.py.",
        "licence": LICENCE,
        "date": date.today().isoformat(),
        "avertissement": "Reprise telle quelle des champs du site (prison et inéligibilité en mois, amende en euros ; recours : definitif, appel ou cassation). Le site ne donne ni la juridiction, ni la date exacte, ni la source de chaque décision. Un candidat absent n'est pas un candidat sans condamnation.",
        "candidats": dict(sorted(candidats.items())),
    }


def main() -> None:
    analyseur = argparse.ArgumentParser()
    analyseur.add_argument("--verifier", action="store_true", help="n'écrit rien : liste les écarts avec le fichier actuel")
    options = analyseur.parse_args()
    donnees = construire(telecharger(URL_AFFAIRES), telecharger(URL_POLITICIENS))
    for slug in CANDIDATS:
        affaires = donnees["candidats"].get(slug, {}).get("affaires", [])
        etats = ", ".join(sorted({a["recours"] for a in affaires}))
        print(f"{slug:15} {len(affaires)} affaire(s)" + (f"  [{etats}]" if etats else ""))
    if options.verifier:
        actuel = json.loads(SORTIE.read_text(encoding="utf-8")).get("candidats", {}) if SORTIE.exists() else {}
        ecarts = sorted(slug for slug in {*actuel, *donnees["candidats"]} if actuel.get(slug) != donnees["candidats"].get(slug))
        print("Aucun écart." if not ecarts else "Écarts pour : " + ", ".join(ecarts))
        sys.exit(1 if ecarts else 0)
    SORTIE.write_text(json.dumps(donnees, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Écrit : {SORTIE}")


if __name__ == "__main__":
    main()
