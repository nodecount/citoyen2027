#!/usr/bin/env python3
"""Met à jour data/bords-politiques.json depuis 2027etmoi (data.gouv.fr).

Source : « Candidatures à l'élection présidentielle 2027 — statuts sourcés », publié par 2027etmoi sous Licence Ouverte 2.0.
Chaque candidat y porte un `bloc` (gauche, ecolo, centre, droite, extdroite, souverainiste, autre), un parti, un statut
(declare, pressenti, renonce) et une source datée. Les identifiants sont ceux de nos dossiers data/bases/*/programmes.

Un bloc « autre » n'est pas un bord politique : le candidat n'a alors aucun bord affiché (jamais « Autre »).

Usage :  python scripts/bords_politiques.py            (écrit le fichier)
         python scripts/bords_politiques.py --verifier (n'écrit rien, signale tout écart avec le fichier actuel)

Ajouter un candidat : créer son dossier dans data/bases/<base>/programmes avec l'identifiant 2027etmoi, puis relancer.
"""
import argparse
import json
import sys
import urllib.request
from pathlib import Path

URL_DATASET = "https://www.data.gouv.fr/datasets/candidatures-a-lelection-presidentielle-2027-statuts-sources"
URL_DONNEES = "https://2027etmoi.fr/data/candidats.json"
RACINE = Path(__file__).resolve().parent.parent
SORTIE = RACINE / "data" / "bords-politiques.json"

# bloc 2027etmoi -> bord affiché. Un bloc absent d'ici (« autre ») ne donne aucun bord.
BORDS = {
    "gauche": "Gauche",
    "ecolo": "Écologie",
    "centre": "Centre",
    "droite": "Droite",
    "extdroite": "Extrême droite",
    "souverainiste": "Souverainiste",
}


def telecharger() -> dict:
    requete = urllib.request.Request(URL_DONNEES, headers={"User-Agent": "citoyen2027-bords/2.0 (https://github.com/nodecount/citoyen2027)"})
    with urllib.request.urlopen(requete, timeout=30) as reponse:
        return json.loads(reponse.read().decode("utf-8"))


def slugs_du_projet() -> list[str]:
    return sorted({dossier.name for dossier in RACINE.glob("data/bases/*/programmes/*") if dossier.is_dir()})


def construire(source: dict) -> dict:
    par_id = {c["id"]: c for c in source["candidats"]}
    manquants = [s for s in slugs_du_projet() if s not in par_id]
    if manquants:
        sys.exit("Candidat absent de la source 2027etmoi : " + ", ".join(manquants))
    bords, details = {}, {}
    for slug in slugs_du_projet():
        c = par_id[slug]
        details[slug] = {"parti_2027etmoi": c["parti"], "bloc": c["bloc"], "statut": c["statut"]}
        if c["bloc"] in BORDS:
            bords[slug] = BORDS[c["bloc"]]
        elif c["bloc"] != "autre":
            sys.exit(f"Bloc inconnu pour {slug} : « {c['bloc']} » (ajouter au dictionnaire BORDS ou le traiter comme « autre »)")
    return {
        "source": f"2027etmoi, « Candidatures à l'élection présidentielle 2027 — statuts sourcés » ({URL_DATASET}), Licence Ouverte 2.0. Le bord est le bloc que la source donne au candidat ; un bloc « autre » n'affiche aucun bord. Généré par scripts/bords_politiques.py.",
        "date": source["mise_a_jour"],
        "bords": bords,
        "details": details,
    }


def main() -> None:
    analyseur = argparse.ArgumentParser()
    analyseur.add_argument("--verifier", action="store_true", help="n'écrit rien : liste les écarts avec le fichier actuel")
    options = analyseur.parse_args()
    donnees = construire(telecharger())
    for slug, detail in donnees["details"].items():
        print(f"{slug:15} {donnees['bords'].get(slug, '(aucun bord)'):15} {detail['parti_2027etmoi']} [{detail['statut']}]")
    if options.verifier:
        actuel = json.loads(SORTIE.read_text(encoding="utf-8")).get("bords", {}) if SORTIE.exists() else {}
        ecarts = {s: (actuel.get(s), donnees["bords"].get(s)) for s in sorted(set(actuel) | set(donnees["bords"])) if actuel.get(s) != donnees["bords"].get(s)}
        print("Aucun écart." if not ecarts else "Écarts (actuel -> 2027etmoi) : " + json.dumps(ecarts, ensure_ascii=False))
        sys.exit(1 if ecarts else 0)
    SORTIE.write_text(json.dumps(donnees, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Écrit : {SORTIE}")


if __name__ == "__main__":
    main()
