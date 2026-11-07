import type { Levels, Objective, ObjectivesSnapshot, Task } from './objective';
import { subtreeIds } from './tree';

/*
 * Les changements de la copie locale, sans effet de bord : les gestes optimistes (un objectif, une étape ou
 * un pas créé avec un id temporaire, ou effacé), leur réconciliation avec l'id définitif, et le chargement qui
 * garde ce qui est encore en cours d'enregistrement. Repris des stores du client web (`map-optimistique-id.ts`,
 * `removed-items.ts`).
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

/** Un élément retiré de la copie, avec la place qu'il y occupait. */
export type Removed<T> = {
  readonly index: number;
  readonly item: T;
};

/** Ce qu'un effacement a retiré de la copie : de quoi tout remettre à sa place s'il n'aboutit pas. */
export type RemovedItems = {
  readonly objectives: readonly Removed<Objective>[];
  readonly tasks: readonly Removed<Task>[];
};

/** La copie après un effacement, et ce qu'il a retiré. */
export type Erased = {
  readonly snapshot: ObjectivesSnapshot;
  readonly removed: RemovedItems;
};

/** Sépare d'une liste les éléments à retirer, en notant leur place. */
function partition<T>(
  list: readonly T[],
  remove: (item: T) => boolean,
): { kept: T[]; removed: Removed<T>[] } {
  const kept: T[] = [];
  const removed: Removed<T>[] = [];
  list.forEach((item, index) => (remove(item) ? removed.push({ index, item }) : kept.push(item)));
  return { kept, removed };
}

/**
 * Efface de la copie un objectif (ou une étape), ses descendants et tous leurs pas, comme Apex Brain. Un id inconnu
 * ne retire rien.
 */
export function eraseObjective(snapshot: ObjectivesSnapshot, objectiveId: string): Erased {
  const ids = snapshot.objectives.some((objective) => objective.id === objectiveId)
    ? subtreeIds(objectiveId, snapshot.objectives)
    : new Set<string>();
  const objectives = partition(snapshot.objectives, (objective) => ids.has(objective.id));
  const tasks = partition(snapshot.tasks, (task) => ids.has(task.objectiveId));
  return {
    snapshot: { ...snapshot, objectives: objectives.kept, tasks: tasks.kept },
    removed: { objectives: objectives.removed, tasks: tasks.removed },
  };
}

/** Efface un pas de la copie. Un id inconnu ne retire rien. */
export function eraseTask(snapshot: ObjectivesSnapshot, taskId: string): Erased {
  const tasks = partition(snapshot.tasks, (task) => task.id === taskId);
  return { snapshot: { ...snapshot, tasks: tasks.kept }, removed: { objectives: [], tasks: tasks.removed } };
}

/** Remet des éléments à la place qu'ils occupaient, sauf ceux qui y sont déjà. */
function insertAtPlace<T extends { readonly id: string }>(
  list: readonly T[],
  removed: readonly Removed<T>[],
): T[] {
  const result = [...list];
  for (const { index, item } of [...removed].sort((a, b) => a.index - b.index)) {
    if (result.some((current) => current.id === item.id)) continue;
    result.splice(Math.min(index, result.length), 0, item);
  }
  return result;
}

/**
 * Les parents de ce qu'un effacement a retiré, hors de ce qu'il a retiré : l'objectif d'une étape effacée, l'étape
 * d'un pas effacé. C'est là que ce qui a été effacé reviendrait.
 */
export function erasedParents(removed: RemovedItems): string[] {
  const removedIds = new Set(removed.objectives.map(({ item }) => item.id));
  const parents = [
    ...removed.objectives.map(({ item }) => item.parentId),
    ...removed.tasks.map(({ item }) => item.objectiveId),
  ];
  return [...new Set(parents)].filter((id): id is string => id !== null && !removedIds.has(id));
}

/**
 * Remet à leur place des éléments effacés, quand l'effacement n'aboutit pas : chacun revient où il était, il ne
 * saute pas en bas de l'écran. Ce qui est déjà là (une relecture l'a rendu) reste tel quel. Rend null quand leur
 * parent n'est plus dans la copie (effacé à son tour) : rien n'aurait où revenir.
 */
export function restoreErased(
  snapshot: ObjectivesSnapshot,
  removed: RemovedItems,
): ObjectivesSnapshot | null {
  const present = new Set(snapshot.objectives.map((objective) => objective.id));
  if (erasedParents(removed).some((parentId) => !present.has(parentId))) return null;
  return {
    ...snapshot,
    objectives: insertAtPlace(snapshot.objectives, removed.objectives),
    tasks: insertAtPlace(snapshot.tasks, removed.tasks),
  };
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
