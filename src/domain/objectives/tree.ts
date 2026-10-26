import type { Objective, Task } from './objective';

/*
 * L'arbre des objectifs, lu dans la copie à plat : objectifs racines, étapes, descendants, pas d'un sous-arbre.
 * Tout reste dans l'ordre de chargement (l'ordre de création, que le serveur garde stable).
 */

/** Les objectifs racines, dans l'ordre de chargement. */
export function rootObjectives(objectives: readonly Objective[]): Objective[] {
  return objectives.filter((objective) => objective.parentId === null);
}

/** Vrai si l'id est celui d'un objectif racine connu (une étape n'a ni arête ni conversation à elle). */
export function isRootObjective(objectiveId: string, objectives: readonly Objective[]): boolean {
  return objectives.some((objective) => objective.id === objectiveId && objective.parentId === null);
}

/** Les étapes d'un objectif : ses sous-objectifs directs, dans l'ordre de chargement. */
export function stagesOf(objectiveId: string, objectives: readonly Objective[]): Objective[] {
  return objectives.filter((objective) => objective.parentId === objectiveId);
}

/** L'objectif et tous ses descendants, quelle que soit la profondeur. */
export function subtreeIds(objectiveId: string, objectives: readonly Objective[]): Set<string> {
  const ids = new Set<string>([objectiveId]);
  const queue = [objectiveId];
  while (queue.length > 0) {
    const parentId = queue.shift() as string;
    for (const objective of objectives) {
      if (objective.parentId === parentId && !ids.has(objective.id)) {
        ids.add(objective.id);
        queue.push(objective.id);
      }
    }
  }
  return ids;
}

/** Les pas d'un objectif et de tous ses descendants, dans l'ordre de chargement des pas. */
export function tasksInSubtree(
  objectiveId: string,
  objectives: readonly Objective[],
  tasks: readonly Task[],
): Task[] {
  const ids = subtreeIds(objectiveId, objectives);
  return tasks.filter((task) => ids.has(task.objectiveId));
}

/**
 * Remonte d'un objectif jusqu'à sa racine : la racine, et l'étape (l'ancêtre juste sous la racine).
 * Un pas posé directement sur la racine n'a pas d'étape.
 */
export function locateInTree(
  objectiveId: string,
  objectivesById: ReadonlyMap<string, Objective>,
): { root: Objective | null; stage: Objective | null } {
  const chain: Objective[] = [];
  const seen = new Set<string>();
  let current = objectivesById.get(objectiveId);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.push(current);
    current = current.parentId ? objectivesById.get(current.parentId) : undefined;
  }
  return {
    root: chain.at(-1) ?? null,
    stage: chain.length > 1 ? (chain.at(-2) ?? null) : null,
  };
}

/** L'objectif racine d'un objectif, d'une étape ou d'un sous-objectif ; null s'il n'est pas connu. */
export function rootIdOf(objectiveId: string, objectives: readonly Objective[]): string | null {
  const byId = new Map(objectives.map((objective) => [objective.id, objective] as const));
  return locateInTree(objectiveId, byId).root?.id ?? null;
}
