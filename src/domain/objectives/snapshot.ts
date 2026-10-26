import type { Levels, Objective, ObjectivesSnapshot, Task } from './objective';

/*
 * Les changements de la copie locale, sans effet de bord : les gestes optimistes (un objectif, une étape ou
 * un pas créé avec un id temporaire), leur réconciliation avec l'id définitif, et le chargement qui garde ce
 * qui est encore en cours d'enregistrement. Repris des stores du client web (`map-optimistique-id.ts`).
 */

/** Le préfixe des identifiants optimistes. */
export const TEMPORARY_ID_PREFIX = 'temp-id-';

/** Vrai pour un identifiant optimiste, pas encore enregistré : à ne jamais mettre dans une URL ni une requête. */
export function isTemporaryId(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith(TEMPORARY_ID_PREFIX);
}

/**
 * Un objectif (ou une étape) enregistré reçoit son id définitif : lui, ses étapes et ses pas (créés
 * entre-temps sur l'id temporaire) suivent.
 */
export function swapObjectiveId(
  snapshot: ObjectivesSnapshot,
  temporaryId: string,
  realId: string,
): ObjectivesSnapshot {
  return {
    ...snapshot,
    objectives: snapshot.objectives.map((objective) => ({
      ...objective,
      id: objective.id === temporaryId ? realId : objective.id,
      parentId: objective.parentId === temporaryId ? realId : objective.parentId,
    })),
    tasks: snapshot.tasks.map((task) =>
      task.objectiveId === temporaryId ? { ...task, objectiveId: realId } : task,
    ),
  };
}

/** Un pas enregistré reçoit son id définitif ; son état optimiste (fait, niveaux…) est gardé. */
export function swapTaskId(
  snapshot: ObjectivesSnapshot,
  temporaryId: string,
  realId: string,
): ObjectivesSnapshot {
  return {
    ...snapshot,
    tasks: snapshot.tasks.map((task) => (task.id === temporaryId ? { ...task, id: realId } : task)),
  };
}

/**
 * Le résultat d'un chargement, plus les éléments encore optimistes de la copie actuelle (id temporaire) :
 * leur création est en cours, ils ne sont pas encore en base. Ils viennent après les éléments chargés.
 */
export function keepOptimistic(
  loaded: Pick<ObjectivesSnapshot, 'objectives' | 'tasks'>,
  current: ObjectivesSnapshot | undefined,
): ObjectivesSnapshot {
  return {
    objectives: [
      ...loaded.objectives,
      ...(current?.objectives ?? []).filter((item) => isTemporaryId(item.id)),
    ],
    tasks: [...loaded.tasks, ...(current?.tasks ?? []).filter((item) => isTemporaryId(item.id))],
    loaded: true,
  };
}

export function addObjective(snapshot: ObjectivesSnapshot, objective: Objective): ObjectivesSnapshot {
  return { ...snapshot, objectives: [...snapshot.objectives, objective] };
}

/**
 * Retire un objectif optimiste (sa création n'a pas abouti), ses étapes directes et les pas créés dessus
 * entre-temps. Un pas déjà enregistré qu'on y avait rangé reste : le serveur l'a encore à son ancienne place,
 * où son propre geste, refusé à son tour, le ramène.
 */
export function removeObjective(snapshot: ObjectivesSnapshot, objectiveId: string): ObjectivesSnapshot {
  const removed = new Set(
    snapshot.objectives
      .filter((objective) => objective.id === objectiveId || objective.parentId === objectiveId)
      .map((objective) => objective.id),
  );
  return {
    ...snapshot,
    objectives: snapshot.objectives.filter((objective) => !removed.has(objective.id)),
    tasks: snapshot.tasks.filter((task) => !(removed.has(task.objectiveId) && isTemporaryId(task.id))),
  };
}

export function replaceObjective(snapshot: ObjectivesSnapshot, objective: Objective): ObjectivesSnapshot {
  return {
    ...snapshot,
    objectives: snapshot.objectives.map((item) => (item.id === objective.id ? objective : item)),
  };
}

/** Change un objectif ou une étape ; un id inconnu laisse la copie telle quelle. */
export function updateObjective(
  snapshot: ObjectivesSnapshot,
  objectiveId: string,
  change: (objective: Objective) => Objective,
): ObjectivesSnapshot {
  return {
    ...snapshot,
    objectives: snapshot.objectives.map((item) => (item.id === objectiveId ? change(item) : item)),
  };
}

export function findObjective(snapshot: ObjectivesSnapshot | undefined, id: string): Objective | undefined {
  return snapshot?.objectives.find((objective) => objective.id === id);
}

export function findTask(snapshot: ObjectivesSnapshot | undefined, id: string): Task | undefined {
  return snapshot?.tasks.find((task) => task.id === id);
}

export function addTask(snapshot: ObjectivesSnapshot, task: Task): ObjectivesSnapshot {
  return { ...snapshot, tasks: [...snapshot.tasks, task] };
}

export function removeTask(snapshot: ObjectivesSnapshot, taskId: string): ObjectivesSnapshot {
  return { ...snapshot, tasks: snapshot.tasks.filter((task) => task.id !== taskId) };
}

/** Change un pas ; un pas inconnu laisse la copie telle quelle. */
export function updateTask(
  snapshot: ObjectivesSnapshot,
  taskId: string,
  change: (task: Task) => Task,
): ObjectivesSnapshot {
  return { ...snapshot, tasks: snapshot.tasks.map((task) => (task.id === taskId ? change(task) : task)) };
}

export function setTaskDone(snapshot: ObjectivesSnapshot, taskId: string, done: boolean): ObjectivesSnapshot {
  return updateTask(snapshot, taskId, (task) => ({ ...task, done }));
}

export function setTaskLevels(
  snapshot: ObjectivesSnapshot,
  taskId: string,
  levels: Levels,
): ObjectivesSnapshot {
  return updateTask(snapshot, taskId, (task) => ({ ...task, ...levels }));
}
