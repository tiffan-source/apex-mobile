import type { CreateObjectiveInput, EditObjectiveInput, EditTaskInput } from '@/domain/objectives/forms';
import type { Levels, Objective, Task } from '@/domain/objectives/objective';
import type { Result } from '@/domain/shared/result';

/*
 * Les objectifs, étapes et pas d'Apex Brain (`/v1/objectives`, `/v1/tasks`). Chaque opération agit pour la
 * personne connectée : le serveur la tire du jeton, un élément d'une autre personne répond « introuvable ».
 */

export type ObjectivesAndTasks = {
  readonly objectives: readonly Objective[];
  readonly tasks: readonly Task[];
};

/** Ce qu'une création rend : l'id définitif. */
export type Created = { readonly id: string };

export type NewTask = { readonly title: string } & Levels;

export interface ObjectivesGateway {
  /** `GET /v1/objectives` : tout, à plat, dans l'ordre de création. */
  list(): Promise<Result<ObjectivesAndTasks>>;
  /** `POST /v1/objectives` */
  createObjective(input: CreateObjectiveInput): Promise<Result<Created>>;
  /** `PATCH /v1/objectives/{id}` : un objectif ou une étape. */
  editObjective(objectiveId: string, input: EditObjectiveInput): Promise<Result<void>>;
  /** `POST /v1/objectives/{id}/sub-objectives` : une étape sous un objectif (ou une étape). */
  addStage(parentId: string, title: string): Promise<Result<Created>>;
  /** `POST /v1/objectives/{id}/tasks` : un pas sur une étape (ou un objectif). */
  addTask(objectiveId: string, task: NewTask): Promise<Result<Created>>;
  /** `PATCH /v1/tasks/{id}` : changer `objectiveId` déplace le pas. */
  editTask(taskId: string, input: EditTaskInput): Promise<Result<void>>;
  /** `PUT /v1/tasks/{id}/done` */
  setTaskDone(taskId: string, done: boolean): Promise<Result<void>>;
}
