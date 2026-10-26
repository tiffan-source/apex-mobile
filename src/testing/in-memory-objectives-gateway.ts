import type { CreateObjectiveInput, EditObjectiveInput, EditTaskInput } from '@/domain/objectives/forms';
import type { Objective, Task } from '@/domain/objectives/objective';
import { fail, ok, type Result } from '@/domain/shared/result';
import type {
  Created,
  NewTask,
  ObjectivesAndTasks,
  ObjectivesGateway,
} from '@/application/ports/objectives-gateway';

/**
 * Apex Brain en mémoire, pour les tests : les mêmes règles que l'API (ordre de création, « introuvable » pour un
 * id inconnu, déplacement d'un pas par `objectiveId`), des pannes à la demande et des réponses retenues pour
 * jouer les courses (un geste pendant un chargement).
 */
export class InMemoryObjectivesGateway implements ObjectivesGateway {
  objectives: Objective[] = [];
  tasks: Task[] = [];
  /** Les appels reçus, dans l'ordre : `list`, `createObjective`… */
  readonly calls: string[] = [];

  private sequence = 0;
  private failures: { operation: string; code: string }[] = [];
  private held: (() => void)[] | null = null;

  /** La prochaine opération de ce nom échoue avec ce code. */
  failNext(operation: keyof ObjectivesGateway, code = 'UNKNOWN_ERROR'): void {
    this.failures.push({ operation, code });
  }

  /** Les réponses attendent `release()` : de quoi faire un geste pendant qu'une requête est en route. */
  hold(): void {
    this.held = [];
  }

  /** Laisse partir les réponses retenues, et les suivantes. */
  async release(): Promise<void> {
    const waiting = this.held ?? [];
    this.held = null;
    waiting.forEach((resume) => resume());
    await flush();
  }

  seedObjective(objective: Partial<Objective> & Pick<Objective, 'id' | 'title'>): Objective {
    const full: Objective = { description: '', why: '', dueDate: null, parentId: null, ...objective };
    this.objectives.push(full);
    return full;
  }

  seedTask(task: Partial<Task> & Pick<Task, 'id' | 'title' | 'objectiveId'>): Task {
    const full: Task = { importance: 3, urgency: 2, done: false, ...task };
    this.tasks.push(full);
    return full;
  }

  async list(): Promise<Result<ObjectivesAndTasks>> {
    return this.respond('list', () => ok({ objectives: [...this.objectives], tasks: [...this.tasks] }));
  }

  async createObjective(input: CreateObjectiveInput): Promise<Result<Created>> {
    return this.respond('createObjective', () => {
      const objective = this.seedObjective({
        id: this.nextId('o'),
        title: input.title,
        description: input.description ?? '',
        why: input.why ?? '',
        dueDate: input.dueDate ?? null,
      });
      return ok({ id: objective.id });
    });
  }

  async editObjective(objectiveId: string, input: EditObjectiveInput): Promise<Result<void>> {
    return this.respond('editObjective', () => {
      const index = this.objectives.findIndex((objective) => objective.id === objectiveId);
      const old = this.objectives[index];
      if (!old) return notFound('OBJECTIVE_NOT_FOUND');
      this.objectives[index] = {
        ...old,
        title: input.title,
        description: input.description ?? old.description,
        why: input.why ?? old.why,
        dueDate: input.dueDate === undefined ? old.dueDate : input.dueDate,
      };
      return ok(undefined);
    });
  }

  async addStage(parentId: string, title: string): Promise<Result<Created>> {
    return this.respond('addStage', () => {
      if (!this.objectives.some((objective) => objective.id === parentId))
        return notFound('OBJECTIVE_NOT_FOUND');
      return ok({ id: this.seedObjective({ id: this.nextId('e'), title, parentId }).id });
    });
  }

  async addTask(objectiveId: string, task: NewTask): Promise<Result<Created>> {
    return this.respond('addTask', () => {
      if (!this.objectives.some((objective) => objective.id === objectiveId))
        return notFound('OBJECTIVE_NOT_FOUND');
      return ok({ id: this.seedTask({ id: this.nextId('p'), objectiveId, ...task }).id });
    });
  }

  async editTask(taskId: string, input: EditTaskInput): Promise<Result<void>> {
    return this.respond('editTask', () => {
      const index = this.tasks.findIndex((task) => task.id === taskId);
      const old = this.tasks[index];
      if (!old) return notFound('TASK_NOT_FOUND');
      if (!this.objectives.some((objective) => objective.id === input.objectiveId))
        return notFound('OBJECTIVE_NOT_FOUND');
      this.tasks[index] = { ...old, ...input };
      return ok(undefined);
    });
  }

  async setTaskDone(taskId: string, done: boolean): Promise<Result<void>> {
    return this.respond('setTaskDone', () => {
      const index = this.tasks.findIndex((task) => task.id === taskId);
      const old = this.tasks[index];
      if (!old) return notFound('TASK_NOT_FOUND');
      this.tasks[index] = { ...old, done };
      return ok(undefined);
    });
  }

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}-${this.sequence}`;
  }

  private async respond<T>(operation: string, action: () => Result<T>): Promise<Result<T>> {
    this.calls.push(operation);
    if (this.held) await new Promise<void>((resume) => this.held?.push(resume));
    const failure = this.failures.findIndex((item) => item.operation === operation);
    if (failure !== -1) {
      const [{ code } = { code: 'UNKNOWN_ERROR' }] = this.failures.splice(failure, 1);
      return fail({ code, message: `${operation} refusé (test)` });
    }
    return action();
  }
}

function notFound<T>(code: string): Result<T> {
  return fail({ code, message: 'Not found (test)', status: 404 });
}

/** Laisse passer les promesses en attente. */
export async function flush(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}
