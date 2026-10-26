import { TITRES_QUADRANTS, type Quadrant } from './eisenhower';
import { quoted, typesetTexts } from '../shared/typography';

/*
 * Les phrases que les gestes sur les objectifs disent à la personne, dans la voix d'Empreinte : tutoiement,
 * phrases courtes, jamais « erreur », « échec », « succès », « supprimer » ni point d'exclamation.
 * Les réussites sont annoncées aux lecteurs d'écran ; ce qui n'a pas marché est signalé dans l'écran, avec ce
 * qu'il faut faire ensuite. « Pas » ouvre rarement une phrase : « Pas ajouté. » se lirait « non ajouté ».
 */

/** Les annonces discrètes des réussites. */
export const SUCCESS_ANNOUNCEMENTS = typesetTexts({
  objectiveCreated: 'Ton objectif est en marche.',
  objectiveSaved: 'Modifications enregistrées.',
  stageAdded: 'Étape ajoutée.',
  taskAdded: 'Nouveau pas ajouté.',
  taskSaved: 'Ce pas est à jour.',
  taskDone: 'Un pas de plus.',
  taskUndone: 'Ce pas est de nouveau à faire.',
} as const);

/** L'annonce d'un pas déplacé dans la matrice : « Ce pas passe dans « À planifier ». » */
export function taskMovedAnnouncement(quadrant: Quadrant): string {
  return `Ce pas passe dans ${quoted(TITRES_QUADRANTS[quadrant])}.`;
}

/** Les signalements : ce qui n'a pas marché, et quoi faire. */
export const FAILURE_REPORTS = typesetTexts({
  createObjective: "Je n'ai pas pu enregistrer cet objectif. Vérifie ta connexion, puis réessaie.",
  editObjective: "Je n'ai pas pu enregistrer tes modifications. Vérifie ta connexion, puis réessaie.",
  addStage: "Je n'ai pas pu ajouter cette étape. Vérifie ta connexion, puis réessaie.",
  addTask: "Je n'ai pas pu enregistrer ce pas. Vérifie ta connexion, puis réessaie.",
  editTask: "Je n'ai pas pu enregistrer ce pas. Vérifie ta connexion, puis réessaie.",
  toggleTask: "Je n'ai pas pu enregistrer ce pas. Vérifie ta connexion, puis réessaie.",
  moveTask: "Je n'ai pas pu déplacer ce pas. Vérifie ta connexion, puis réessaie.",
  loadObjectives: "Je n'ai pas pu charger tes objectifs. Vérifie ta connexion, puis réessaie.",
  objectiveNotFound: 'Je ne retrouve plus cet objectif. Recharge tes objectifs, puis réessaie.',
  taskNotFound: 'Je ne retrouve plus ce pas. Recharge tes objectifs, puis réessaie.',
  tooManyRequests: 'Tu vas un peu vite pour moi. Attends une minute, puis réessaie.',
} as const);

/** Les gestes qui peuvent ne pas aboutir. */
export type FailedAction = Exclude<
  keyof typeof FAILURE_REPORTS,
  'objectiveNotFound' | 'taskNotFound' | 'tooManyRequests'
>;

/**
 * La phrase à signaler quand un geste n'aboutit pas. Le message du serveur (technique, en anglais) n'est
 * jamais montré : seul son code choisit la phrase.
 */
export function failureReport(action: FailedAction, errorCode?: string): string {
  switch (errorCode) {
    case 'OBJECTIVE_NOT_FOUND':
      return FAILURE_REPORTS.objectiveNotFound;
    case 'TASK_NOT_FOUND':
      return FAILURE_REPORTS.taskNotFound;
    case 'TOO_MANY_REQUESTS':
      return FAILURE_REPORTS.tooManyRequests;
    default:
      return FAILURE_REPORTS[action];
  }
}
