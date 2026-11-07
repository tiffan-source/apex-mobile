import type { CreateObjectiveInput } from '@/domain/objectives/forms';
import type { Levels, Objective, Task } from '@/domain/objectives/objective';
import type { Result } from '@/domain/shared/result';
import type {
  Clarification,
  NewTask,
  ObjectivesAndTasks,
  ObjectivesGateway,
} from '@/application/ports/objectives-gateway';
import { mapResult, type ApexClient } from '../http/apex-client';
import type { components } from './schema';

type ObjectiveEntity = Omit<Objective, 'parentId'> & { readonly parentObjectiveId: string | null };
type TreeNode = components['schemas']['ObjectiveTreeNode'];

const toObjective = (entity: ObjectiveEntity): Objective => ({
  id: entity.id,
  title: entity.title,
  description: entity.description,
  why: entity.why,
  dueDate: entity.dueDate,
  parentId: entity.parentObjectiveId,
  done: entity.done,
});

const toTask = (entity: Task): Task => ({
  id: entity.id,
  title: entity.title,
  importance: entity.importance,
  urgency: entity.urgency,
  done: entity.done,
  objectiveId: entity.objectiveId,
});

/**
 * L'arbre mis à plat, comme la copie locale le range : le parent d'une étape et le porteur d'un pas viennent de
 * l'emboîtement. Un objectif passe avant ses étapes, dans l'ordre de l'arbre.
 */
export function flattenTree(roots: readonly TreeNode[]): ObjectivesAndTasks {
  const objectives: Objective[] = [];
  const tasks: Task[] = [];
  const visit = (node: TreeNode, parentId: string | null) => {
    objectives.push({
      id: node.id,
      title: node.title,
      description: node.description,
      why: node.why,
      dueDate: node.dueDate,
      parentId,
      done: node.done,
    });
    for (const task of node.tasks) tasks.push(toTask({ ...task, objectiveId: node.id }));
    for (const child of node.subObjectives) visit(child, node.id);
  };
  for (const root of roots) visit(root, null);
  return { objectives, tasks };
}

/** Les objectifs, étapes et pas, par la v2 de l'API d'Apex Brain (`docs/api.md` d'Apex Brain). */
export class HttpObjectivesGateway implements ObjectivesGateway {
  constructor(private readonly client: ApexClient) {}

  getObjectiveTree(): Promise<Result<ObjectivesAndTasks>> {
    return mapResult(this.client.GET('/v2/bff/objective-tree'), (data) => flattenTree(data.objectives));
  }

  createObjective(input: CreateObjectiveInput): Promise<Result<Objective>> {
    return mapResult(this.client.POST('/v2/objectives', { body: { ...input } }), toObjective);
  }

  addSubObjective(parentId: string, title: string): Promise<Result<Objective>> {
    return mapResult(
      this.client.POST('/v2/objectives/{objectiveId}/sub-objectives', {
        params: { path: { objectiveId: parentId } },
        body: { title },
      }),
      toObjective,
    );
  }

  addTask(objectiveId: string, task: NewTask): Promise<Result<Task>> {
    return mapResult(
      this.client.POST('/v2/objectives/{objectiveId}/tasks', {
        params: { path: { objectiveId } },
        body: { title: task.title, importance: task.importance, urgency: task.urgency },
      }),
      toTask,
    );
  }

  renameObjective(objectiveId: string, title: string): Promise<Result<Objective>> {
    return mapResult(
      this.client.PATCH('/v2/objectives/{objectiveId}/rename', {
        params: { path: { objectiveId } },
        body: { title },
      }),
      toObjective,
    );
  }

  clarifyObjective(objectiveId: string, clarification: Clarification): Promise<Result<Objective>> {
    return mapResult(
      this.client.PATCH('/v2/objectives/{objectiveId}/clarify', {
        params: { path: { objectiveId } },
        body: { ...clarification },
      }),
      toObjective,
    );
  }

  setObjectiveDeadline(objectiveId: string, dueDate: string): Promise<Result<Objective>> {
    return mapResult(
      this.client.PATCH('/v2/objectives/{objectiveId}/set-deadline', {
        params: { path: { objectiveId } },
        body: { dueDate },
      }),
      toObjective,
    );
  }

  removeObjectiveDeadline(objectiveId: string): Promise<Result<Objective>> {
    return mapResult(
      this.client.PATCH('/v2/objectives/{objectiveId}/remove-deadline', {
        params: { path: { objectiveId } },
      }),
      toObjective,
    );
  }

  deleteObjective(objectiveId: string): Promise<Result<void>> {
    return mapResult(
      this.client.DELETE('/v2/objectives/{objectiveId}', { params: { path: { objectiveId } } }),
      () => undefined,
    );
  }

  renameTask(taskId: string, title: string): Promise<Result<Task>> {
    return mapResult(
      this.client.PATCH('/v2/tasks/{taskId}/rename', { params: { path: { taskId } }, body: { title } }),
      toTask,
    );
  }

  reprioritizeTask(taskId: string, levels: Levels): Promise<Result<Task>> {
    return mapResult(
      this.client.PATCH('/v2/tasks/{taskId}/reprioritize', {
        params: { path: { taskId } },
        body: { importance: levels.importance, urgency: levels.urgency },
      }),
      toTask,
    );
  }

  moveTask(taskId: string, objectiveId: string): Promise<Result<Task>> {
    return mapResult(
      this.client.PATCH('/v2/tasks/{taskId}/move', { params: { path: { taskId } }, body: { objectiveId } }),
      toTask,
    );
  }

  completeTask(taskId: string): Promise<Result<Task>> {
    return mapResult(
      this.client.PATCH('/v2/tasks/{taskId}/complete', { params: { path: { taskId } } }),
      toTask,
    );
  }

  reopenTask(taskId: string): Promise<Result<Task>> {
    return mapResult(
      this.client.PATCH('/v2/tasks/{taskId}/reopen', { params: { path: { taskId } } }),
      toTask,
    );
  }

  deleteTask(taskId: string): Promise<Result<void>> {
    return mapResult(
      this.client.DELETE('/v2/tasks/{taskId}', { params: { path: { taskId } } }),
      () => undefined,
    );
  }
}
