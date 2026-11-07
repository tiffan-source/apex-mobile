import { legendeProgression } from '@empreinte-studio/noyau';
import type { Task } from './objective';

/*
 * La progression d'un objectif, lue par ce qui est fait (cahier de migration d'Apex, § 4). Étapes et pas sont
 * indépendants : aucun ordre entre eux, rien n'est « en cours » ni « à venir ». Fait ou non fait, c'est le serveur
 * qui le dit (`done`) : ici, on ne fait que compter et écrire.
 */

/** Ce qu'une liste de pas compte : faits, à faire. */
export type StepProgress = {
  readonly done: number;
  readonly toDo: number;
};

/** Ce qui est fait sur le total. */
export type TaskCount = {
  readonly done: number;
  readonly total: number;
};

/** Le texte d'une étape sans pas. */
export const EMPTY_STAGE_DETAIL = "Aucun pas pour l'instant";

/** Ce qu'une liste de pas compte. */
export function taskProgress(tasks: readonly Pick<Task, 'done'>[]): StepProgress {
  const done = tasks.filter((task) => task.done).length;
  return { done, toDo: tasks.length - done };
}

/** « 4 pas faits · 3 à faire » (legendeProgression d'Empreinte), ou le texte d'une étape vide. */
export function stageDetail(progress: StepProgress): string {
  return legendeProgression({ faits: progress.done, aFaire: progress.toDo }) || EMPTY_STAGE_DETAIL;
}

/** Ce qui est fait sur le total d'une liste de pas. */
export function countTasks(tasks: readonly Task[]): TaskCount {
  return { done: tasks.filter((task) => task.done).length, total: tasks.length };
}

/** Ce que le serveur dit d'une étape, dans son repère : « Étape · à faire ». */
export function stageStateLabel(done: boolean): string {
  return done ? 'faite' : 'à faire';
}

/** Ce que le serveur dit d'une étape, seul sur sa ligne : « À faire ». */
export function stageStateTitle(done: boolean): string {
  return done ? 'Faite' : 'À faire';
}
