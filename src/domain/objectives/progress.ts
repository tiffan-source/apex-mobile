import { legendeProgression, type EtatEtape, type EtatPas } from '@empreinte-studio/noyau';
import type { Task } from './objective';

/*
 * La progression d'un objectif, lue par ce qui est fait (cahier de migration d'Apex, § 4) :
 * - une étape est faite quand elle a au moins un pas et que tous ses pas sont faits ;
 * - la première étape non faite est en cours (une seule par objectif), les suivantes sont à venir ;
 * - dans l'étape en cours, le premier pas non fait est en cours ;
 * - un objectif est accompli quand il a au moins un pas et que tous sont faits.
 */

export type StageState = EtatEtape;
export type TaskState = EtatPas;

/** Ce qu'on compte : faits, un en cours, à venir (sans compter celui en cours). */
export type StepProgress = {
  readonly done: number;
  readonly inProgress: boolean;
  readonly upcoming: number;
};

/** Ce qui est fait sur le total. */
export type TaskCount = {
  readonly done: number;
  readonly total: number;
};

/** Le texte d'une étape sans pas. */
export const EMPTY_STAGE_DETAIL = "Aucun pas pour l'instant";

function allDone(tasks: readonly Task[]): boolean {
  return tasks.length > 0 && tasks.every((task) => task.done);
}

/** Une étape est faite quand elle a au moins un pas et que tous ses pas sont faits. */
export function isStageDone(tasks: readonly Task[]): boolean {
  return allDone(tasks);
}

/** Un objectif est accompli quand il a au moins un pas et que tous ses pas sont faits. */
export function isAccomplished(tasks: readonly Task[]): boolean {
  return allDone(tasks);
}

/** L'état de chaque étape, à partir de ses pas : faite, puis une seule en cours, puis à venir. */
export function stageStates(tasksByStage: readonly (readonly Task[])[]): StageState[] {
  let currentGiven = false;
  return tasksByStage.map((tasks) => {
    if (isStageDone(tasks)) return 'faite';
    if (!currentGiven) {
      currentGiven = true;
      return 'en-cours';
    }
    return 'a-venir';
  });
}

/**
 * L'état de chaque pas d'une étape : fait, puis, dans l'étape en cours seulement, le premier pas non fait
 * est en cours ; les autres pas non faits sont à venir.
 */
export function taskStates(tasks: readonly Task[], stageState: StageState): TaskState[] {
  let currentGiven = stageState !== 'en-cours';
  return tasks.map((task) => {
    if (task.done) return 'fait';
    if (!currentGiven) {
      currentGiven = true;
      return 'en-cours';
    }
    return 'a-venir';
  });
}

/** Ce qu'on compte à partir des états des pas. */
export function progressFromStates(states: readonly TaskState[]): StepProgress {
  return {
    done: states.filter((state) => state === 'fait').length,
    inProgress: states.includes('en-cours'),
    upcoming: states.filter((state) => state === 'a-venir').length,
  };
}

/** « 4 pas faits · 3 à venir » (legendeProgression d'Empreinte), ou le texte d'une étape vide. */
export function stageDetail(progress: StepProgress): string {
  const legend = legendeProgression({
    faits: progress.done,
    enCours: progress.inProgress ? 1 : 0,
    aVenir: progress.upcoming,
  });
  return legend || EMPTY_STAGE_DETAIL;
}

/** Ce qui est fait sur le total d'une liste de pas. */
export function countTasks(tasks: readonly Task[]): TaskCount {
  return { done: tasks.filter((task) => task.done).length, total: tasks.length };
}

/** Le premier pas non fait de l'étape en cours, sinon le premier pas non fait de l'objectif. */
export function nextTaskOf(
  currentStageTasks: readonly Task[] | null,
  objectiveTasks: readonly Task[],
): Task | null {
  return currentStageTasks?.find((task) => !task.done) ?? objectiveTasks.find((task) => !task.done) ?? null;
}

/** L'état d'une étape dans son repère : « Étape 3 · en cours ». */
export const STAGE_STATE_LABELS: Readonly<Record<StageState, string>> = {
  faite: 'faite',
  'en-cours': 'en cours',
  'a-venir': 'à venir',
};

/** L'état d'une étape seul sur sa ligne : « En cours ». */
export const STAGE_STATE_TITLES: Readonly<Record<StageState, string>> = {
  faite: 'Faite',
  'en-cours': 'En cours',
  'a-venir': 'À venir',
};
