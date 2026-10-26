import type { EtapeArete } from '@empreinte-studio/noyau';
import { formatHorizon } from '../shared/dates';
import { quadrantOf, type Quadrant } from './eisenhower';
import type { Objective, Task } from './objective';
import {
  countTasks,
  progressFromStates,
  stageDetail,
  stageStates,
  taskStates,
  type StageState,
  type StepProgress,
  type TaskCount,
  type TaskState,
} from './progress';
import { stagesOf, tasksInSubtree } from './tree';

/*
 * La vue détaillée d'un objectif pour l'écran de l'arête (cahier de migration d'Apex, § 4).
 * Trois niveaux : l'objectif, ses étapes (sous-objectifs directs), leurs pas. Les sous-objectifs plus
 * profonds ne sont pas montrés : leurs pas comptent dans leur étape.
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
  /** Fait, en cours (le premier pas non fait de l'étape en cours) ou à venir. */
  readonly state: TaskState;
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
  readonly state: StageState;
  /** La place de l'étape, de 1 à n : « Étape 3 · en cours ». */
  readonly index: number;
  /** Ses pas, y compris ceux de ses sous-objectifs plus profonds, dans l'ordre de chargement. */
  readonly tasks: readonly StageTaskView[];
  readonly progress: StepProgress;
  /** « 4 pas faits · 3 à venir », ou « Aucun pas pour l'instant ». */
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
  /** Les étapes, dans l'ordre de chargement. */
  readonly stages: readonly StageView[];
  /** Les pas posés directement sur l'objectif, à ranger dans une étape. */
  readonly tasksWithoutStage: readonly StageTaskView[];
  /** Les étapes pour l'arête, dans le même ordre. */
  readonly aretes: readonly AreteStage[];
  /** L'étape ouverte par défaut : celle en cours, sinon la dernière, sinon null (aucune étape). */
  readonly defaultStageId: string | null;
  readonly taskCount: TaskCount;
};

/**
 * Le texte court sous le nom d'une étape, sur l'arête : « 4 pas faits » pour l'étape en cours qui a avancé ;
 * sinon l'état en toutes lettres, laissé à l'arête.
 */
export function areteDetail(state: StageState, progress: StepProgress): string | undefined {
  if (state === 'en-cours' && progress.done > 0)
    return `${progress.done} pas ${progress.done >= 2 ? 'faits' : 'fait'}`;
  return undefined;
}

function toStageTasks(tasks: readonly Task[], states: readonly TaskState[]): StageTaskView[] {
  return tasks.map((task, index) => ({
    id: task.id,
    title: task.title,
    done: task.done,
    state: states[index] ?? (task.done ? 'fait' : 'a-venir'),
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

  const stageObjectives = stagesOf(objectiveId, objectives);
  const tasksByStage = stageObjectives.map((stage) => tasksInSubtree(stage.id, objectives, tasks));
  const states = stageStates(tasksByStage);

  const stages: StageView[] = stageObjectives.map((stage, index) => {
    const state = states[index] ?? 'a-venir';
    const stageTasks = tasksByStage[index] ?? [];
    const perTask = taskStates(stageTasks, state);
    const progress = progressFromStates(perTask);
    return {
      id: stage.id,
      title: stage.title,
      description: stage.description,
      dueDate: stage.dueDate,
      horizon: formatHorizon(stage.dueDate, now),
      state,
      index: index + 1,
      tasks: toStageTasks(stageTasks, perTask),
      progress,
      detail: stageDetail(progress),
    };
  });

  const looseTasks = tasks.filter((task) => task.objectiveId === objectiveId);
  const current = stages.find((stage) => stage.state === 'en-cours') ?? null;

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
    tasksWithoutStage: toStageTasks(
      looseTasks,
      looseTasks.map((task) => (task.done ? 'fait' : 'a-venir')),
    ),
    aretes: stages.map((stage) => {
      const detail = areteDetail(stage.state, stage.progress);
      return { id: stage.id, nom: stageName(stage.title), etat: stage.state, ...(detail ? { detail } : {}) };
    }),
    defaultStageId: current?.id ?? stages.at(-1)?.id ?? null,
    taskCount: countTasks(tasksInSubtree(objectiveId, objectives, tasks)),
  };
}

/** Une étape à choisir (la feuille d'un pas). */
export type StageOption = { readonly id: string; readonly label: string };

/** Les étapes d'un objectif, à choisir, avec un nom même quand elles n'en ont pas. */
export function stageOptions(objectiveId: string, objectives: readonly Objective[]): StageOption[] {
  return stagesOf(objectiveId, objectives).map((stage) => ({ id: stage.id, label: stageName(stage.title) }));
}

/**
 * L'étape à garder ouverte à côté de l'arête : celle que la personne a choisie tant qu'elle existe (cocher son
 * dernier pas ne fait pas sauter le panneau vers l'étape suivante), sinon l'étape par défaut.
 */
export function openStageId(chosen: string | null, detail: ObjectiveDetail | undefined): string | null {
  if (!detail) return null;
  if (chosen !== null && detail.stages.some((stage) => stage.id === chosen)) return chosen;
  return detail.defaultStageId;
}

/**
 * Au-delà de 8 étapes, l'arête replie les étapes faites dans une seule arête « Faites », sans id. Chaque choix de
 * cette arête ouvre l'étape faite d'avant, en partant de la plus récente : toutes restent atteignables.
 */
export function foldedDoneStageId(stages: readonly StageView[], openId: string | null): string | null {
  const done = stages.filter((stage) => stage.state === 'faite');
  if (done.length === 0) return null;
  const open = done.findIndex((stage) => stage.id === openId);
  return done[open > 0 ? open - 1 : done.length - 1]?.id ?? null;
}
