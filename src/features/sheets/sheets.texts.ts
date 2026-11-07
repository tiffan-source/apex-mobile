import { VOIX_EFFACEMENT, compter } from '@empreinte-studio/noyau';
import { TITRES_QUADRANTS, type Quadrant } from '@/domain/objectives/eisenhower';
import type { TaskCount } from '@/domain/objectives/progress';
import { keepTogether, typesetTexts } from '@/domain/shared/typography';

/** « fait » ou « faits ». */
const done = (count: number) => (count >= 2 ? 'faits' : 'fait');

/**
 * Ce qu'une étape emporte, sous l'aperçu de l'arête (maquette « Effacer », mobile) :
 * « Endurance emporte ses 7 pas, dont 4 faits. Ça ne se récupère pas. »
 */
function stageCarries(name: string, tasks: TaskCount): string {
  const carried =
    tasks.total === 0
      ? `${name} sort du plan.`
      : tasks.total === 1
        ? `${name} emporte son pas${tasks.done === 1 ? ', déjà fait' : ''}.`
        : `${name} emporte ses ${tasks.total} pas${tasks.done > 0 ? `, dont ${tasks.done} ${done(tasks.done)}` : ''}.`;
  return `${carried} ${VOIX_EFFACEMENT.sansRetour}`;
}

/**
 * Ce qu'un objectif emporte, comme sur le web :
 * « Ses 6 étapes, ses 21 pas dont 9 faits et ta conversation avec Akari partent avec lui. Ça ne se récupère pas. »
 */
function objectiveCarries(stageCount: number, tasks: TaskCount): string {
  const parts: string[] = [];
  if (stageCount === 1) parts.push('son étape');
  else if (stageCount >= 2) parts.push(`ses ${stageCount} étapes`);
  if (tasks.total === 1) parts.push('son pas');
  else if (tasks.total >= 2) {
    parts.push(`ses ${tasks.total} pas${tasks.done > 0 ? ` dont ${tasks.done} ${done(tasks.done)}` : ''}`);
  }
  parts.push('ta conversation avec Akari');
  const listed = parts.length === 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} et ${parts.at(-1)}`;
  const verb = parts.length === 1 ? 'part' : 'partent';
  return `${listed.charAt(0).toUpperCase()}${listed.slice(1)} ${verb} avec lui. ${VOIX_EFFACEMENT.sansRetour}`;
}

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
    /** La sortie discrète, au pied de la feuille. */
    exitQuestion: "Cet objectif n'a plus sa place ?",
    erase: "Effacer l'objectif",
  },
  /** La feuille qui confirme l'effacement d'un objectif : on réécrit son nom. */
  eraseObjective: {
    title: 'Effacer cet objectif ?',
    confirm: "Effacer l'objectif",
    keep: "Garder l'objectif",
    carries: objectiveCarries,
  },
  /** La feuille qui valide l'effacement d'une étape. */
  eraseStage: {
    title: 'Effacer cette étape de ton plan ?',
    confirm: "Effacer l'étape",
    keep: "Garder l'étape",
    /** Ce que devient l'arête, sous son aperçu : « Ton arête passe de 6 à 5 étapes. » */
    arete: (stageCount: number) =>
      stageCount <= 1
        ? "Ton arête n'aura plus d'étape."
        : `Ton arête passe de ${stageCount} à ${compter(stageCount - 1, 'étape')}.`,
    carries: stageCarries,
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
    /** La sortie discrète, au pied de la feuille « Modifier le pas » : le geste visible, sans glisser. */
    erase: 'Effacer ce pas',
  },
  gone: {
    objective: 'Je ne retrouve plus cet objectif. Recharge tes objectifs, puis réessaie.',
    stage: 'Je ne retrouve plus cette étape. Recharge tes objectifs, puis réessaie.',
    task: 'Je ne retrouve plus ce pas. Recharge tes objectifs, puis réessaie.',
  },
} as const);
