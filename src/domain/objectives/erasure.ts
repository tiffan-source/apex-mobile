import type { Objective, Task } from './objective';
import { stageName } from './objective-detail';
import { countTasks, type StepProgress, type TaskCount } from './progress';
import { stagesOf, tasksInSubtree } from './tree';

/*
 * Ce qu'un effacement emporte, pour la feuille qui le confirme (maquette « Effacer ») : une étape part avec ses pas,
 * un objectif avec ses étapes, leurs pas et sa conversation avec Akari. Le pas dont la trace est à l'écran
 * (`leaving`) ne compte plus : il part déjà. Effacer a trois poids : un pas part tout de suite et sa trace laisse le
 * temps de le remettre ; une étape part après une validation ; un objectif, quand on a réécrit son nom.
 */

/** Ce que l'effacement d'une étape emporte, et ce qu'il laisse sur l'arête. */
export type StageErasure = {
  /** Son nom, même quand elle n'en a pas (« Étape sans nom »). */
  readonly name: string;
  /** Les autres étapes de l'arête, faites ou à faire : ce qui reste. */
  readonly remaining: StepProgress;
  /** Les étapes de l'arête, celle qui part comprise. */
  readonly stageCount: number;
  /** Ses pas, ceux de ses sous-objectifs compris. */
  readonly tasks: TaskCount;
};

/** Ce que l'effacement d'un objectif emporte (sa conversation avec Akari part aussi). */
export type ObjectiveErasure = {
  /** Son nom, à réécrire pour confirmer. */
  readonly title: string;
  readonly stageCount: number;
  /** Ses pas, toutes étapes confondues. */
  readonly tasks: TaskCount;
};

/** Les pas d'un sous-arbre, sans celui qui part déjà. */
function carriedTasks(
  objectiveId: string,
  objectives: readonly Objective[],
  tasks: readonly Task[],
  leaving: string | null,
): TaskCount {
  return countTasks(tasksInSubtree(objectiveId, objectives, tasks).filter((task) => task.id !== leaving));
}

/** Ce que l'effacement d'une étape emporte ; undefined si ce n'est pas une étape connue. */
export function stageErasure(
  stageId: string,
  objectives: readonly Objective[],
  tasks: readonly Task[],
  leaving: string | null = null,
): StageErasure | undefined {
  const stage = objectives.find((objective) => objective.id === stageId);
  if (!stage || stage.parentId === null) return undefined;
  const others = stagesOf(stage.parentId, objectives).filter((objective) => objective.id !== stage.id);
  const done = others.filter((objective) => objective.done).length;
  return {
    name: stageName(stage.title),
    remaining: { done, toDo: others.length - done },
    stageCount: others.length + 1,
    tasks: carriedTasks(stage.id, objectives, tasks, leaving),
  };
}

/** Ce que l'effacement d'un objectif emporte ; undefined si ce n'est pas un objectif racine connu. */
export function objectiveErasure(
  objectiveId: string,
  objectives: readonly Objective[],
  tasks: readonly Task[],
  leaving: string | null = null,
): ObjectiveErasure | undefined {
  const objective = objectives.find((item) => item.id === objectiveId && item.parentId === null);
  if (!objective) return undefined;
  return {
    title: objective.title,
    stageCount: stagesOf(objective.id, objectives).length,
    tasks: carriedTasks(objective.id, objectives, tasks, leaving),
  };
}
