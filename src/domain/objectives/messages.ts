import { typesetTexts } from '../shared/typography';

/*
 * Les phrases que les gestes sur les objectifs disent à la personne, dans la voix d'Empreinte : tutoiement,
 * phrases courtes, jamais « erreur », « échec », « succès », « supprimer » ni point d'exclamation.
 * Les réussites sont annoncées aux lecteurs d'écran ; ce qui n'a pas marché est signalé dans l'écran, avec ce
 * qu'il faut faire ensuite. « Pas » ouvre rarement une phrase : « Pas ajouté. » se lirait « non ajouté ».
 * On efface, on ne supprime pas ; un pas effacé ne s'annonce pas : sa trace le dit déjà.
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
  stageErased: 'Étape effacée.',
  objectiveErased: 'Objectif effacé.',
} as const);

/** Les signalements : ce qui n'a pas marché, et quoi faire. */
export const FAILURE_REPORTS = typesetTexts({
  createObjective: "Je n'ai pas pu enregistrer cet objectif. Vérifie ta connexion, puis réessaie.",
  editObjective: "Je n'ai pas pu enregistrer tes modifications. Vérifie ta connexion, puis réessaie.",
  addStage: "Je n'ai pas pu ajouter cette étape. Vérifie ta connexion, puis réessaie.",
  addTask: "Je n'ai pas pu enregistrer ce pas. Vérifie ta connexion, puis réessaie.",
  editTask: "Je n'ai pas pu enregistrer ce pas. Vérifie ta connexion, puis réessaie.",
  toggleTask: "Je n'ai pas pu enregistrer ce pas. Vérifie ta connexion, puis réessaie.",
  eraseTask: "Je n'ai pas pu effacer ce pas : il est revenu à sa place. Vérifie ta connexion, puis réessaie.",
  eraseStage:
    "Je n'ai pas pu effacer cette étape : elle est revenue à sa place. Vérifie ta connexion, puis réessaie.",
  eraseObjective:
    "Je n'ai pas pu effacer cet objectif : il est revenu parmi tes objectifs. Vérifie ta connexion, puis réessaie.",
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
