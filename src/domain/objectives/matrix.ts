import { compter } from '@empreinte-studio/noyau';
import { QUADRANTS, quadrantOf, type Quadrant } from './eisenhower';
import type { Objective, Task } from './objective';
import { stageName } from './objective-detail';
import { locateInTree, rootObjectives } from './tree';

/*
 * La matrice d'Eisenhower : tous les pas, faits compris, rangés dans les quatre quadrants, chacun avec son
 * objectif racine et son étape (pour sa ligne de détail et le filtre par objectif).
 */

export type MatrixTask = Task & {
  readonly quadrant: Quadrant;
  /** L'objectif racine du pas. */
  readonly rootObjectiveId: string;
  readonly rootObjectiveTitle: string;
  /** L'étape du pas (sous-objectif direct de la racine), ou null pour un pas posé sur l'objectif. */
  readonly stageId: string | null;
  readonly stageTitle: string | null;
};

export type Matrix = Readonly<Record<Quadrant, readonly MatrixTask[]>>;

/** Une matrice vide, les quadrants dans l'ordre d'Empreinte. */
export function emptyMatrix(): Record<Quadrant, MatrixTask[]> {
  return { maintenant: [], planifier: [], confier: [], 'laisser-filer': [] };
}

/** Tous les pas, rangés par quadrant, chacun avec son objectif racine et son étape. */
export function toMatrix(objectives: readonly Objective[], tasks: readonly Task[]): Matrix {
  const byId = new Map(objectives.map((objective) => [objective.id, objective] as const));
  const matrix = emptyMatrix();
  for (const task of tasks) {
    const quadrant = quadrantOf(task);
    const { root, stage } = locateInTree(task.objectiveId, byId);
    matrix[quadrant].push({
      ...task,
      quadrant,
      rootObjectiveId: root?.id ?? task.objectiveId,
      rootObjectiveTitle: root?.title ?? '',
      stageId: stage?.id ?? null,
      stageTitle: stage ? stageName(stage.title) : null,
    });
  }
  return matrix;
}

/** La matrice d'un seul objectif racine ; null garde tous les objectifs. */
export function filterMatrixByObjective(matrix: Matrix, rootObjectiveId: string | null): Matrix {
  if (rootObjectiveId === null) return matrix;
  const keep = (items: readonly MatrixTask[]) =>
    items.filter((item) => item.rootObjectiveId === rootObjectiveId);
  return {
    maintenant: keep(matrix.maintenant),
    planifier: keep(matrix.planifier),
    confier: keep(matrix.confier),
    'laisser-filer': keep(matrix['laisser-filer']),
  };
}

/** Le nombre de pas d'une matrice, tous quadrants confondus. */
export function matrixSize(matrix: Matrix): number {
  return QUADRANTS.reduce((total, quadrant) => total + matrix[quadrant].length, 0);
}

/** « 14 pas ». */
export function countLabel(count: number): string {
  return compter(count, 'pas', 'pas');
}

/** « Licence · étape Statistiques » : l'objectif, puis l'étape s'il y en a une. */
export function matrixTaskDetail(task: MatrixTask): string {
  return [task.rootObjectiveTitle, task.stageTitle ? `étape ${task.stageTitle}` : '']
    .filter((part) => part.length > 0)
    .join(' · ');
}

/** Les objectifs racines qu'on peut choisir pour filtrer la matrice. */
export function matrixObjectiveOptions(objectives: readonly Objective[]): { id: string; title: string }[] {
  return rootObjectives(objectives).map((objective) => ({ id: objective.id, title: objective.title }));
}
