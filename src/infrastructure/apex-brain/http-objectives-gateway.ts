import type { CreateObjectiveInput, EditObjectiveInput, EditTaskInput } from '@/domain/objectives/forms';
import type { Result } from '@/domain/shared/result';
import type {
  Created,
  NewTask,
  ObjectivesAndTasks,
  ObjectivesGateway,
} from '@/application/ports/objectives-gateway';
import { mapResult, type ApexClient } from '../http/apex-client';

/** Les objectifs, étapes et pas, par l'API d'Apex Brain (`docs/api.md` d'Apex Brain). */
export class HttpObjectivesGateway implements ObjectivesGateway {
  constructor(private readonly client: ApexClient) {}

  list(): Promise<Result<ObjectivesAndTasks>> {
    return mapResult(this.client.GET('/v1/objectives'), (data) => ({
      objectives: data.objectives.map((objective) => ({
        id: objective.id,
        title: objective.title,
        description: objective.description,
        why: objective.why,
        dueDate: objective.dueDate,
        parentId: objective.parentObjective,
      })),
      tasks: data.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        importance: task.importance,
        urgency: task.urgency,
        done: task.done,
        objectiveId: task.objectiveId,
      })),
    }));
  }

  createObjective(input: CreateObjectiveInput): Promise<Result<Created>> {
    return mapResult(this.client.POST('/v1/objectives', { body: { ...input } }), (data) => ({ id: data.id }));
  }

  editObjective(objectiveId: string, input: EditObjectiveInput): Promise<Result<void>> {
    return mapResult(
      this.client.PATCH('/v1/objectives/{objectiveId}', {
        params: { path: { objectiveId } },
        body: { ...input },
      }),
      () => undefined,
    );
  }

  addStage(parentId: string, title: string): Promise<Result<Created>> {
    return mapResult(
      this.client.POST('/v1/objectives/{objectiveId}/sub-objectives', {
        params: { path: { objectiveId: parentId } },
        body: { title },
      }),
      (data) => ({ id: data.id }),
    );
  }

  addTask(objectiveId: string, task: NewTask): Promise<Result<Created>> {
    return mapResult(
      this.client.POST('/v1/objectives/{objectiveId}/tasks', {
        params: { path: { objectiveId } },
        body: { title: task.title, importance: task.importance, urgency: task.urgency },
      }),
      (data) => ({ id: data.id }),
    );
  }

  editTask(taskId: string, input: EditTaskInput): Promise<Result<void>> {
    return mapResult(
      this.client.PATCH('/v1/tasks/{taskId}', {
        params: { path: { taskId } },
        body: {
          title: input.title,
          objectiveId: input.objectiveId,
          importance: input.importance,
          urgency: input.urgency,
        },
      }),
      () => undefined,
    );
  }

  setTaskDone(taskId: string, done: boolean): Promise<Result<void>> {
    return mapResult(
      this.client.PUT('/v1/tasks/{taskId}/done', { params: { path: { taskId } }, body: { done } }),
      () => undefined,
    );
  }
}
