import { compter, legendeProgression } from '@empreinte-studio/noyau';
import { formatHorizon } from '../shared/dates';
import type { Objective, Task } from './objective';
import { countTasks, isAccomplished, nextTaskOf, stageStates, type TaskCount } from './progress';
import { rootObjectives, stagesOf, tasksInSubtree } from './tree';

/*
 * La carte d'un objectif sur l'écran Objectifs (cahier de migration d'Apex, § 4), et sa progression :
 * par étapes s'il en a, sinon par pas, sinon l'invitation à poser la première étape.
 */

/** Au-delà de 12 cases, le brand book demande de ne plus allonger la barre : la légende suffit. */
export const MAX_CASES = 12;

/** La progression d'un objectif par étapes. */
export type StageProgress = {
  readonly done: number;
  readonly inProgress: boolean;
  readonly upcoming: number;
  /** Le titre de l'étape en cours, s'il y en a une. */
  readonly inProgressName?: string;
};

export type ObjectiveCard = {
  readonly id: string;
  readonly title: string;
  /** Le pourquoi, à écrire en `voix` entre « ». Vide s'il n'a pas été dit. */
  readonly why: string;
  /** « Jusqu'en mai », « Jusqu'en mai 2027 », ou vide. */
  readonly horizon: string;
  readonly stageProgress: StageProgress;
  /** Le nombre d'étapes (sous-objectifs directs). */
  readonly stageCount: number;
  /** Les pas de l'objectif et de toutes ses étapes. */
  readonly taskCount: TaskCount;
  /** Le premier pas non fait de l'étape en cours, sinon de l'objectif. */
  readonly nextTask: Task | null;
  /** Au moins un pas, et tous faits. */
  readonly accomplished: boolean;
};

/** La progression telle que la carte la montre : des cases, une légende seule, ou l'invitation. */
export type CardProgress =
  | {
      readonly kind: 'cases';
      readonly unit: 'etape' | 'pas';
      readonly done: number;
      readonly inProgress: boolean;
      readonly upcoming: number;
      readonly currentName?: string;
      /** Remplace la légende calculée par EPas. */
      readonly legend?: string;
    }
  | { readonly kind: 'legend'; readonly text: string }
  | { readonly kind: 'invite' };

/** La carte d'un objectif. */
export function toObjectiveCard(
  objective: Objective,
  objectives: readonly Objective[],
  tasks: readonly Task[],
  now: Date = new Date(),
): ObjectiveCard {
  const stages = stagesOf(objective.id, objectives);
  const tasksByStage = stages.map((stage) => tasksInSubtree(stage.id, objectives, tasks));
  const states = stageStates(tasksByStage);
  const objectiveTasks = tasksInSubtree(objective.id, objectives, tasks);
  const currentIndex = states.indexOf('en-cours');
  const current = stages[currentIndex] ?? null;
  return {
    id: objective.id,
    title: objective.title,
    why: objective.why,
    horizon: formatHorizon(objective.dueDate, now),
    stageProgress: {
      done: states.filter((state) => state === 'faite').length,
      inProgress: current !== null,
      upcoming: states.filter((state) => state === 'a-venir').length,
      ...(current ? { inProgressName: current.title } : {}),
    },
    stageCount: stages.length,
    taskCount: countTasks(objectiveTasks),
    nextTask: nextTaskOf(tasksByStage[currentIndex] ?? null, objectiveTasks),
    accomplished: isAccomplished(objectiveTasks),
  };
}

/** Les cartes de tous les objectifs racines, dans l'ordre de chargement. */
export function toObjectiveCards(
  objectives: readonly Objective[],
  tasks: readonly Task[],
  now: Date = new Date(),
): ObjectiveCard[] {
  return rootObjectives(objectives).map((objective) => toObjectiveCard(objective, objectives, tasks, now));
}

/**
 * La progression d'une carte : par étapes s'il en a, sinon par pas, sinon l'invitation à poser la première
 * étape. Au-delà de 12 cases, la légende seule.
 */
export function cardProgress(card: ObjectiveCard): CardProgress {
  if (card.stageCount > 0) {
    const { done, inProgress, upcoming, inProgressName } = card.stageProgress;
    const looseTasksLeft = card.taskCount.total - card.taskCount.done;
    // Toutes les étapes sont faites, mais des pas sans étape attendent encore : l'objectif n'est pas
    // accompli, la légende ne doit pas le dire.
    const legend =
      !inProgress && upcoming === 0 && looseTasksLeft > 0
        ? `${compter(done, 'étape faite', 'étapes faites')} · ${compter(looseTasksLeft, 'pas sans étape', 'pas sans étape')} à venir`
        : undefined;
    if (card.stageCount > MAX_CASES) {
      return {
        kind: 'legend',
        text:
          legend ??
          legendeProgression(
            { faits: done, enCours: inProgress ? 1 : 0, aVenir: upcoming },
            { unite: 'etape', ...(inProgressName ? { nomEnCours: inProgressName } : {}) },
          ),
      };
    }
    return {
      kind: 'cases',
      unit: 'etape',
      done,
      inProgress,
      upcoming,
      ...(inProgressName ? { currentName: inProgressName } : {}),
      ...(legend ? { legend } : {}),
    };
  }

  const { done, total } = card.taskCount;
  if (total === 0) return { kind: 'invite' };
  // Sans étape, le prochain pas est le pas en cours.
  const inProgress = done < total;
  const upcoming = Math.max(total - done - 1, 0);
  if (total > MAX_CASES) {
    return {
      kind: 'legend',
      text: legendeProgression({ faits: done, enCours: inProgress ? 1 : 0, aVenir: upcoming }),
    };
  }
  return { kind: 'cases', unit: 'pas', done, inProgress, upcoming };
}

/** « 4 en marche · 1 accompli » ; vide tant qu'il n'y a rien à compter. */
export function objectivesSummary(running: number, accomplished: number): string {
  const parts: string[] = [];
  if (running > 0) parts.push(compter(running, 'en marche', 'en marche'));
  if (accomplished > 0) parts.push(compter(accomplished, 'accompli'));
  return parts.join(' · ');
}
