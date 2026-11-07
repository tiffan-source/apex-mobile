import type { CreateObjectiveInput } from '@/domain/objectives/forms';
import type { Levels, Objective, Task } from '@/domain/objectives/objective';
import type { Result } from '@/domain/shared/result';

/*
 * Les objectifs, étapes et pas d'Apex Brain, en v2 : une lecture (l'arbre, `/v2/bff/objective-tree`) et des
 * commandes nommées d'après le geste (`/v2/objectives`, `/v2/tasks`). Chaque commande qui crée ou change un
 * élément rend cet élément tel que le serveur l'a enregistré : il devient ce que le serveur a accepté, sans
 * relire l'arbre. Chaque opération agit pour la personne connectée : le serveur la tire du jeton, un élément
 * d'une autre personne répond « introuvable ». Une commande sans effet (cocher un pas déjà fait) réussit.
 */

export type ObjectivesAndTasks = {
  readonly objectives: readonly Objective[];
  readonly tasks: readonly Task[];
};

export type NewTask = { readonly title: string } & Levels;

/** Ce que `clarifyObjective` change : un champ absent reste tel quel, une chaîne vide l'efface. */
export type Clarification = { readonly description?: string; readonly why?: string };

export interface ObjectivesGateway {
  /** `GET /v2/bff/objective-tree` : tout, mis à plat. Étapes et pas n'ont aucun ordre : le tri garde l'affichage stable. */
  getObjectiveTree(): Promise<Result<ObjectivesAndTasks>>;

  /** `POST /v2/objectives` */
  createObjective(input: CreateObjectiveInput): Promise<Result<Objective>>;
  /** `POST /v2/objectives/{id}/sub-objectives` : une étape sous un objectif (ou une étape). */
  addSubObjective(parentId: string, title: string): Promise<Result<Objective>>;
  /** `POST /v2/objectives/{id}/tasks` : un pas sur une étape (ou un objectif). */
  addTask(objectiveId: string, task: NewTask): Promise<Result<Task>>;
  /** `PATCH /v2/objectives/{id}/rename` : un objectif ou une étape. */
  renameObjective(objectiveId: string, title: string): Promise<Result<Objective>>;
  /** `PATCH /v2/objectives/{id}/clarify` : la description et le pourquoi. */
  clarifyObjective(objectiveId: string, clarification: Clarification): Promise<Result<Objective>>;
  /** `PATCH /v2/objectives/{id}/set-deadline` */
  setObjectiveDeadline(objectiveId: string, dueDate: string): Promise<Result<Objective>>;
  /** `PATCH /v2/objectives/{id}/remove-deadline` */
  removeObjectiveDeadline(objectiveId: string): Promise<Result<Objective>>;
  /**
   * `DELETE /v2/objectives/{id}` : un objectif ou une étape, avec tout ce qui en dépend (ses étapes, leurs pas, et,
   * pour un objectif, sa conversation avec Akari). « Introuvable » (`OBJECTIVE_NOT_FOUND`) s'il n'existe plus.
   */
  deleteObjective(objectiveId: string): Promise<Result<void>>;

  /** `PATCH /v2/tasks/{id}/rename` */
  renameTask(taskId: string, title: string): Promise<Result<Task>>;
  /** `PATCH /v2/tasks/{id}/reprioritize` : l'importance et l'urgence (changer de quadrant). */
  reprioritizeTask(taskId: string, levels: Levels): Promise<Result<Task>>;
  /** `PATCH /v2/tasks/{id}/move` : le pas va à un autre objectif ou une autre étape. */
  moveTask(taskId: string, objectiveId: string): Promise<Result<Task>>;
  /** `PATCH /v2/tasks/{id}/complete` */
  completeTask(taskId: string): Promise<Result<Task>>;
  /** `PATCH /v2/tasks/{id}/reopen` */
  reopenTask(taskId: string): Promise<Result<Task>>;
  /** `DELETE /v2/tasks/{id}` : « introuvable » (`TASK_NOT_FOUND`) s'il n'existe plus. */
  deleteTask(taskId: string): Promise<Result<void>>;
}
