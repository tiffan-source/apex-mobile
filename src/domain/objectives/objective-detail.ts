import type { EtapeArete } from '@empreinte-studio/noyau';
import { formatHorizon } from '../shared/dates';
import { quadrantOf, type Quadrant } from './eisenhower';
import type { Objective, Task } from './objective';
import { countTasks, stageDetail, taskProgress, type StepProgress, type TaskCount } from './progress';
import { stagesOf, tasksInSubtree } from './tree';

/*
 * La vue détaillée d'un objectif pour l'écran de l'arête (cahier de migration d'Apex, § 4).
 * Trois niveaux : l'objectif, ses étapes (sous-objectifs directs), leurs pas. Les sous-objectifs plus
 * profonds ne sont pas montrés : leurs pas comptent dans leur étape.
 * Étapes et pas sont indépendants : aucun ordre entre eux, l'écran n'en choisit aucun.
 */

/** Le nom d'une étape qui n'en a pas (données anciennes) : elle reste lisible partout. */
export const UNTITLED_STAGE = 'Étape sans nom';

/** Le nom affiché d'une étape : son titre, ou « Étape sans nom » s'il est vide. */
export function stageName(title: string): string {
  return title.trim() || UNTITLED_STAGE;
}

/** Un pas dans l'arête. */
export type StageTaskView = {
  readonly id: string;
  readonly title: string;
  readonly done: boolean;
  readonly importance: number;
  readonly urgency: number;
  /** L'objectif qui porte réellement le pas (l'étape, ou un sous-objectif plus profond). */
  readonly objectiveId: string;
  readonly quadrant: Quadrant;
};

/** Une étape d'un objectif. */
export type StageView = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly dueDate: string | null;
  /** « Jusqu'en mai », ou vide. */
  readonly horizon: string;
  /** Faite ou à faire, d'après le serveur. */
  readonly done: boolean;
  /** Ses pas, y compris ceux de ses sous-objectifs plus profonds. */
  readonly tasks: readonly StageTaskView[];
  readonly progress: StepProgress;
  /** « 4 pas faits · 3 à faire », ou « Aucun pas pour l'instant ». */
  readonly detail: string;
};

/** Une étape sur l'arête, avec son id pour retrouver l'étape choisie. */
export type AreteStage = EtapeArete & { readonly id: string };

export type ObjectiveDetail = {
  readonly objective: {
    readonly id: string;
    readonly title: string;
    readonly why: string;
    readonly description: string;
    readonly dueDate: string | null;
    readonly horizon: string;
  };
  readonly stages: readonly StageView[];
  /** Les pas posés directement sur l'objectif, à ranger dans une étape. */
  readonly tasksWithoutStage: readonly StageTaskView[];
  /** Les étapes pour l'arête. */
  readonly aretes: readonly AreteStage[];
  readonly taskCount: TaskCount;
};

function toStageTasks(tasks: readonly Task[]): StageTaskView[] {
  return tasks.map((task) => ({
    id: task.id,
    title: task.title,
    done: task.done,
    importance: task.importance,
    urgency: task.urgency,
    objectiveId: task.objectiveId,
    quadrant: quadrantOf(task),
  }));
}

/** La vue détaillée d'un objectif racine ; undefined s'il n'est pas connu (ou si l'id est celui d'une étape). */
export function toObjectiveDetail(
  objectiveId: string,
  objectives: readonly Objective[],
  tasks: readonly Task[],
  now: Date = new Date(),
): ObjectiveDetail | undefined {
  const objective = objectives.find((item) => item.id === objectiveId && item.parentId === null);
  if (!objective) return undefined;

  const stages: StageView[] = stagesOf(objectiveId, objectives).map((stage) => {
    const stageTasks = tasksInSubtree(stage.id, objectives, tasks);
    const progress = taskProgress(stageTasks);
    return {
      id: stage.id,
      title: stage.title,
      description: stage.description,
      dueDate: stage.dueDate,
      horizon: formatHorizon(stage.dueDate, now),
      done: stage.done,
      tasks: toStageTasks(stageTasks),
      progress,
      detail: stageDetail(progress),
    };
  });

  return {
    objective: {
      id: objective.id,
      title: objective.title,
      why: objective.why,
      description: objective.description,
      dueDate: objective.dueDate,
      horizon: formatHorizon(objective.dueDate, now),
    },
    stages,
    tasksWithoutStage: toStageTasks(tasks.filter((task) => task.objectiveId === objectiveId)),
    aretes: stages.map((stage) => ({ id: stage.id, nom: stageName(stage.title), faite: stage.done })),
    taskCount: countTasks(tasksInSubtree(objectiveId, objectives, tasks)),
  };
}

/**
 * L'étape quand un de ses pas part (sa trace est à l'écran, à sa place) : il ne compte plus dans ce qu'elle a de
 * fait et d'à faire. Ses pas restent tous dans la liste, pour que la trace garde la place du pas.
 */
export function stageWithout(stage: StageView, leaving: string | null): StageView {
  if (leaving === null || !stage.tasks.some((task) => task.id === leaving)) return stage;
  const progress = taskProgress(stage.tasks.filter((task) => task.id !== leaving));
  return { ...stage, progress, detail: stageDetail(progress) };
}

/** Une étape à choisir (la feuille d'un pas). */
export type StageOption = { readonly id: string; readonly label: string };

/** Les étapes d'un objectif, à choisir, avec un nom même quand elles n'en ont pas. */
export function stageOptions(objectiveId: string, objectives: readonly Objective[]): StageOption[] {
  return stagesOf(objectiveId, objectives).map((stage) => ({ id: stage.id, label: stageName(stage.title) }));
}

/**
 * L'étape ouverte à côté de l'arête : celle que la personne a choisie, tant qu'elle existe. L'écran n'en ouvre
 * aucune de lui-même.
 */
export function openStageId(chosen: string | null, detail: ObjectiveDetail | undefined): string | null {
  return chosen !== null && detail?.stages.some((stage) => stage.id === chosen) ? chosen : null;
}

/**
 * Au-delà de 8 étapes, l'arête replie les étapes faites dans une seule arête « Faites », sans id. Chaque choix de
 * cette arête ouvre une autre étape faite, à tour de rôle : toutes restent atteignables.
 */
export function foldedDoneStageId(stages: readonly StageView[], openId: string | null): string | null {
  const done = stages.filter((stage) => stage.done);
  if (done.length === 0) return null;
  const open = done.findIndex((stage) => stage.id === openId);
  return done[open > 0 ? open - 1 : done.length - 1]?.id ?? null;
}
