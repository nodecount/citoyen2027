import { Eraser, Eye, ListChecks, ListOrdered, Lock } from "lucide-react";
import { PanneauProgression } from "./PanneauProgression";
import { ActionPied } from "./ModaleTravail";
import { PasAPas, type EtapeQuestion } from "./PasAPas";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { compterReponses, estRepondue, questionsVisibles, type SectionTheme } from "../questionnaire";
import { mettreAJourReponse, type ProfilPartiel } from "../profil";
import type { ChampProfil } from "../types";
import { SectionQuestions, type SurReponse } from "./Questions";

interface PageQuestionsGeneralesProps {
  // Les questions de la base active (sert à retirer une réponse devenue sans objet quand une question conditionnelle disparaît).
  champs: ChampProfil[];
  questions: ChampProfil[];
  profilInitial: ProfilPartiel;
  onValider: (profil: ProfilPartiel) => void;
  onAnnuler: () => void;
  // Formulaire ouvert au-dessus des thèmes (page du simulateur) plutôt que page à part : titre de section, questions
  // en cartes compactes, actions en tête (toujours à portée), bouton « Fermer ».
  integre?: boolean;
  // Efface toutes les réponses (proposé seulement quand il y en a déjà d'enregistrées).
  onEffacer?: () => void;
  // Questions propres à chaque thème (affichées seulement une fois le formulaire général validé), avec le profil courant
  // et le rappel qui applique chaque réponse immédiatement.
  sectionsThemes?: SectionTheme[];
  profilThemes?: ProfilPartiel;
  onReponseTheme?: SurReponse;
  // Formulaire intégré : commence une question à la fois (défaut) ou directement sur la grille de toutes les questions.
  pasAPasInitial?: boolean;
}

// Les questions générales : utiles à plusieurs thèmes, posées d'abord et une seule fois. Les réponses sont un BROUILLON
// tant que le visiteur n'a pas enregistré : c'est l'enregistrement qui fait apparaître (ou met à jour) les indicateurs
// sur les portraits. Le visiteur peut y revenir à tout moment pour changer ou compléter ses réponses ; ensuite, chaque
// thème permet de préciser d'autres informations, à son rythme.
export default function PageQuestionsGenerales({ champs, questions, profilInitial, onValider, onAnnuler, integre = false, onEffacer, sectionsThemes = [], profilThemes = profilInitial, onReponseTheme, pasAPasInitial = true }: PageQuestionsGeneralesProps) {
  const [brouillon, setBrouillon] = useState<ProfilPartiel>(profilInitial);
  const { repondues, total } = compterReponses(questions, brouillon);
  // Actif par défaut : les questions sans réponse sont mises en valeur dès l'arrivée, le visiteur peut le désactiver.
  const [manquantesEnValeur, setManquantesEnValeur] = useState(true);

  // Enregistrement automatique (formulaire intégré) : chaque modification est appliquée après une courte pause, sans bouton.
  // « enregistrement » pendant la pause, « enregistre » une fois appliquée ; rien n'est affiché tant que rien n'a changé.
  const premierRendu = useRef(true);
  const surValider = useRef(onValider);
  surValider.current = onValider;
  useEffect(() => {
    if (!integre) return;
    if (premierRendu.current) {
      premierRendu.current = false;
      return;
    }
    const minuteur = setTimeout(() => {
      surValider.current(brouillon);
    }, 500);
    return () => clearTimeout(minuteur);
  }, [brouillon, integre]);

  function repondre(champ: ChampProfil, brut: string | string[]) {
    setBrouillon((precedent) => mettreAJourReponse(precedent, champ, brut, champs));
  }

  // Formulaire intégré : par défaut une question par écran (générales d'abord, puis celles de chaque thème) ; le visiteur peut
  // basculer sur la grille de toutes les questions. Une réponse générale va au brouillon (enregistré après une courte pause),
  // une réponse de thème s'applique tout de suite.
  const [pasAPas, setPasAPas] = useState(pasAPasInitial);
  const idsGenerales = new Set(questions.map((q) => q.id));
  const profilFile: ProfilPartiel = { ...profilThemes };
  for (const q of questions) {
    if (brouillon[q.id] === undefined) delete profilFile[q.id];
    else profilFile[q.id] = brouillon[q.id];
  }
  const file: EtapeQuestion[] = [
    // Une question générale sert plusieurs thèmes : elle porte le libellé « Question générale » (toutes les questions en ont un).
    ...questionsVisibles(questions, profilFile).map((champ) => ({ champ, theme: "Question générale" })),
    ...sectionsThemes.flatMap(({ theme, questions: qs }) => questionsVisibles(qs, profilFile).map((champ) => ({ champ, theme: theme.libelle, themeId: theme.id }))),
  ];
  // Formulaire intégré : le panneau compte la file entière (générales + thèmes), une question à la fois COMME en grille (la grille
  // montre aussi les questions de thèmes) : même pourcentage dans les deux modes, et le même que le tableau de bord.
  const affiche = integre ? { repondues: file.filter((e) => estRepondue(e.champ, profilFile)).length, total: file.length } : { repondues, total };
  function repondreEtape(etape: EtapeQuestion, brut: string | string[]) {
    if (idsGenerales.has(etape.champ.id)) repondre(etape.champ, brut);
    else onReponseTheme?.(etape.champ, brut);
  }

  function valider(event: FormEvent) {
    event.preventDefault();
    onValider(brouillon);
  }

  const progression = `${repondues} réponse${repondues > 1 ? "s" : ""} sur ${total} question${total > 1 ? "s" : ""}`;
  const compte = `${affiche.repondues} question${affiche.repondues > 1 ? "s" : ""} répondue${affiche.repondues > 1 ? "s" : ""} sur ${affiche.total}`;
  const actions = (
    <div className="actions">
      {!integre && <button type="submit">Enregistrer et voir les indicateurs</button>}
      {!integre && (
        <button type="button" className="secondaire" onClick={onAnnuler}>
          Retour aux thèmes
        </button>
      )}
      {!integre && onEffacer && (
        <button type="button" className="secondaire" onClick={onEffacer}>
          <Eraser size={18} aria-hidden="true" focusable="false" />
          Effacer mes réponses
        </button>
      )}
    </div>
  );

  return (
    <>
    {/* Formulaire intégré : la progression dans une div à part, au-dessus de celle des questions ; l'indicateur d'enregistrement,
        hors des divs, en bas à droite sous le formulaire ; l'effacement est en bas de l'écran (PageThemes). */}
    {integre && <PanneauProgression repondues={affiche.repondues} total={affiche.total} compte={compte} manquantesEnValeur={manquantesEnValeur} onManquantes={setManquantesEnValeur} manquantesAffichees={!pasAPas} />}
    <form onSubmit={valider} className={`questionnaire${integre ? " questionnaire--integre" : ""}`} id={integre ? "formulaire-general" : undefined} aria-label={integre ? "Ma situation" : undefined}>
      {integre ? null : <h1>Ma situation</h1>}
      {integre ? null : (
        <>
          <ul className="aide-formulaire">
            <li>
              <ListChecks aria-hidden="true" />
              <span>
                Les questions sont toutes <strong>facultatives</strong> : répondez à celles que vous voulez. Une question sans
                réponse n'est jamais comptée comme « non ».
              </span>
            </li>
            <li>
              <Lock aria-hidden="true" />
              <span>
                Vos réponses restent <strong>dans votre navigateur</strong> : jamais envoyées, gardées pour votre prochaine
                visite tant que vous ne les effacez pas.
              </span>
            </li>
            <li>
              <Eye aria-hidden="true" />
              <span>
                Une fois enregistrées, les indicateurs apparaissent autour des portraits ; vous pourrez préciser d'autres
                informations thème par thème.
              </span>
            </li>
          </ul>
          <p className="progression" aria-live="polite">
            {progression}
          </p>
        </>
      )}
      {integre && pasAPas && <PasAPas etapes={file} profil={profilFile} onReponse={repondreEtape} onToutVoir={() => setPasAPas(false)} />}
      {integre && !pasAPas && (
        <ActionPied>
          <button type="button" className="secondaire pas-a-pas-retour" onClick={() => setPasAPas(true)}>
          <ListOrdered size={18} aria-hidden="true" focusable="false" />
          Répondre une question à la fois
        </button>
        </ActionPied>
      )}
      {!(integre && pasAPas) && (
      <div className={integre ? "grille-questions" : undefined}>
      <SectionQuestions questions={questions} profil={brouillon} onReponse={repondre} idPrefixe={integre ? "general-ouvert" : "general"} carte={integre} mettreEnValeurManquantes={manquantesEnValeur} />
      {/* Questions propres à un thème, rangées par thème : toutes visibles ici (répondues ou non) pour pouvoir les revoir
          et les modifier ; chaque réponse s'applique tout de suite, sans attendre l'enregistrement. */}
      {sectionsThemes.map(({ theme, questions: questionsTheme }) => {
        if (questionsVisibles(questionsTheme, profilThemes).length === 0) return null;
        return (
          <section key={theme.id} className="questionnaire-theme" aria-labelledby={`form-theme-${theme.id}`}>
            <h3 id={`form-theme-${theme.id}`}>{theme.libelle}</h3>
            <SectionQuestions questions={questionsTheme} profil={profilThemes} onReponse={onReponseTheme!} idPrefixe={`form-theme-${theme.id}`} carte={integre} mettreEnValeurManquantes={manquantesEnValeur} />
          </section>
        );
      })}
      </div>
      )}
      {!integre && actions}
    </form>
    </>
  );
}
