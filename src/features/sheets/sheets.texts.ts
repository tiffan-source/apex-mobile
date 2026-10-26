import { TITRES_QUADRANTS, type Quadrant } from '@/domain/objectives/eisenhower';
import { keepTogether, typesetTexts } from '@/domain/shared/typography';

/** Les textes des feuilles de l'arête, repris du client web. */
export const SHEETS_TEXTS = typesetTexts({
  save: 'Enregistrer',
  add: 'Ajouter',
  cancel: 'Annuler',
  close: 'Fermer',
  chooseDate: 'Choisis une date',
  loading: 'Chargement de tes objectifs…',
  editObjective: {
    title: "Modifier l'objectif",
    name: 'Ce que tu veux construire',
    description: 'En quelques mots',
    why: 'Pourquoi ça compte pour toi',
    dueDate: 'Pour quand',
    dueDateHelp: "Une date, même approximative. L'horizon se lit au mois.",
    removeDueDate: "Retirer l'horizon",
  },
  addStage: {
    title: 'Ajouter une étape',
    name: "Le nom de l'étape",
    help: 'Une étape rassemble quelques pas. Par exemple : Endurance.',
  },
  editStage: {
    title: "Modifier l'étape",
    name: "Le nom de l'étape",
    description: 'En quelques mots',
    dueDate: 'Pour quand',
    dueDateHelp: "L'échéance de cette étape, même approximative.",
    removeDueDate: "Retirer l'échéance",
  },
  task: {
    addTitle: 'Ajouter un pas',
    editTitle: 'Modifier le pas',
    name: 'Le pas',
    help: 'Une action concrète, que tu peux faire en une fois.',
    stage: 'Étape',
    chooseStage: 'Choisis une étape',
    placeInStage: 'Range ce pas dans une étape de ton arête.',
    noStage: 'Ajoute une étape à ton objectif pour y ranger ce pas.',
    importance: 'Importance',
    urgency: 'Urgence',
    quadrant: (quadrant: Quadrant) =>
      `Dans la matrice, ce pas se range dans « ${keepTogether(TITRES_QUADRANTS[quadrant])} ».`,
  },
  gone: {
    objective: 'Je ne retrouve plus cet objectif. Recharge tes objectifs, puis réessaie.',
    stage: 'Je ne retrouve plus cette étape. Recharge tes objectifs, puis réessaie.',
    task: 'Je ne retrouve plus ce pas. Recharge tes objectifs, puis réessaie.',
  },
} as const);
