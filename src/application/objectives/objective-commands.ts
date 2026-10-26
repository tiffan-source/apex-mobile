import { levelsForQuadrant, type Quadrant } from '@/domain/objectives/eisenhower';
import type { CreateObjectiveInput, EditObjectiveInput, EditTaskInput } from '@/domain/objectives/forms';
import { SUCCESS_ANNOUNCEMENTS, failureReport, taskMovedAnnouncement } from '@/domain/objectives/messages';
import type { Levels, Objective, Task } from '@/domain/objectives/objective';
import {
  addObjective,
  addTask,
  findObjective,
  findTask,
  isTemporaryId,
  removeObjective,
  removeTask,
  replaceObjective,
  setTaskDone,
  setTaskLevels,
  swapObjectiveId,
  swapTaskId,
  updateTask,
} from '@/domain/objectives/snapshot';
import { UNKNOWN_ERROR, fail, type Result } from '@/domain/shared/result';
import type { AnnouncementCenter } from '../announcements/announcement-center';
import type { NewTask, ObjectivesGateway } from '../ports/objectives-gateway';
import type { ObjectivesCache, TemporaryIds } from './objectives-cache';
import type { WriteQueue } from './write-queue';

/*
 * Les gestes sur les objectifs, étapes et pas, repris des stores du client web : chacun change d'abord la
 * copie locale (mise à jour optimiste, avec un id temporaire pour ce qu'il crée), puis s'écrit dans la file,
 * puis se réconcilie (id définitif, annonce) ou revient en arrière (signalement). Un retour en arrière ne
 * défait jamais un geste plus récent sur le même élément.
 */

export type ObjectiveCommandsDeps = {
  readonly gateway: ObjectivesGateway;
  readonly cache: ObjectivesCache;
  readonly writes: WriteQueue;
  readonly announcements: AnnouncementCenter;
  readonly ids: TemporaryIds;
};

/** Une écriture qui n'a pas pu partir : l'élément qu'elle visait n'a jamais été enregistré (déjà signalé). */
const SKIPPED = null;

const sameObjectiveContent = (a: Objective, b: Objective) =>
  a.title === b.title && a.description === b.description && a.why === b.why && a.dueDate === b.dueDate;

export class ObjectiveCommands {
  constructor(private readonly deps: ObjectiveCommandsDeps) {}

  /** Crée un objectif ; rend son id définitif une fois enregistré, ou null si l'enregistrement n'a pas abouti. */
  async createObjective(input: CreateObjectiveInput): Promise<string | null> {
    const { cache, gateway, announcements } = this.deps;
    const temporaryId = this.deps.ids.next();
    cache.update((snapshot) =>
      addObjective(snapshot, {
        id: temporaryId,
        title: input.title,
        description: input.description ?? '',
        why: input.why ?? '',
        dueDate: input.dueDate ?? null,
        parentId: null,
      }),
    );

    const result = await this.write(() => this.linked(temporaryId, gateway.createObjective(input)));
    if (result.success) {
      cache.update((snapshot) => swapObjectiveId(snapshot, temporaryId, result.data.id));
      announcements.announce(SUCCESS_ANNOUNCEMENTS.objectiveCreated);
      return result.data.id;
    }
    announcements.report(failureReport('createObjective', result.error.code));
    cache.update((snapshot) => removeObjective(snapshot, temporaryId));
    return null;
  }

  /** Modifie un objectif ou une étape : seul ce qui a changé part (`toEditObjectiveInput`). */
  async editObjective(objectiveId: string, input: EditObjectiveInput): Promise<void> {
    const { cache, gateway, writes, announcements } = this.deps;
    const old = findObjective(cache.read(), objectiveId);
    if (!old) return;
    const optimistic: Objective = {
      ...old,
      title: input.title,
      description: input.description ?? old.description,
      why: input.why ?? old.why,
      dueDate: input.dueDate === undefined ? old.dueDate : input.dueDate,
    };
    cache.update((snapshot) => replaceObjective(snapshot, optimistic));

    const result = await this.write(async () => {
      const id = writes.resolve(objectiveId);
      return isTemporaryId(id) ? SKIPPED : gateway.editObjective(id, input);
    });
    if (result === SKIPPED) return;
    if (result.success) {
      announcements.announce(SUCCESS_ANNOUNCEMENTS.objectiveSaved);
      return;
    }
    announcements.report(failureReport('editObjective', result.error.code));
    // Retour à l'objectif d'avant, sauf si un geste plus récent l'a déjà changé.
    cache.update((snapshot) => {
      const id = writes.resolve(objectiveId);
      const current = findObjective(snapshot, id);
      return current && sameObjectiveContent(current, optimistic)
        ? replaceObjective(snapshot, { ...old, id, parentId: current.parentId })
        : snapshot;
    });
  }

  /** Ajoute une étape à un objectif. */
  async addStage(objectiveId: string, title: string): Promise<void> {
    const { cache, gateway, writes, announcements } = this.deps;
    const temporaryId = this.deps.ids.next();
    cache.update((snapshot) =>
      addObjective(snapshot, {
        id: temporaryId,
        title,
        description: '',
        why: '',
        dueDate: null,
        parentId: writes.resolve(objectiveId),
      }),
    );

    const result = await this.write(async () => {
      const parentId = writes.resolve(objectiveId);
      return isTemporaryId(parentId) ? SKIPPED : this.linked(temporaryId, gateway.addStage(parentId, title));
    });
    if (result !== SKIPPED && result.success) {
      cache.update((snapshot) => swapObjectiveId(snapshot, temporaryId, result.data.id));
      announcements.announce(SUCCESS_ANNOUNCEMENTS.stageAdded);
      return;
    }
    if (result !== SKIPPED) announcements.report(failureReport('addStage', result.error.code));
    cache.update((snapshot) => removeObjective(snapshot, temporaryId));
  }

  /** Ajoute un pas à une étape (ou à un objectif). */
  async addTask(stageId: string, task: NewTask): Promise<void> {
    const { cache, gateway, writes, announcements } = this.deps;
    const temporaryId = this.deps.ids.next();
    // L'étape a pu être enregistrée pendant que la feuille était ouverte : le pas va à son id définitif.
    cache.update((snapshot) =>
      addTask(snapshot, { id: temporaryId, ...task, done: false, objectiveId: writes.resolve(stageId) }),
    );

    const result = await this.write(async () => {
      const target = writes.resolve(stageId);
      return isTemporaryId(target) ? SKIPPED : this.linked(temporaryId, gateway.addTask(target, task));
    });
    if (result !== SKIPPED && result.success) {
      // Le pas garde son état optimiste (coché, déplacé…) : ces gestes partent ensuite dans la file.
      cache.update((snapshot) => swapTaskId(snapshot, temporaryId, result.data.id));
      announcements.announce(SUCCESS_ANNOUNCEMENTS.taskAdded);
      return;
    }
    if (result !== SKIPPED) announcements.report(failureReport('addTask', result.error.code));
    cache.update((snapshot) => removeTask(snapshot, temporaryId));
  }

  /** Modifie un pas, ou le déplace en changeant `objectiveId`. */
  async editTask(taskId: string, input: EditTaskInput): Promise<void> {
    const { cache, gateway, writes, announcements } = this.deps;
    const old = findTask(cache.read(), taskId);
    if (!old) return;
    cache.update((snapshot) =>
      updateTask(snapshot, taskId, (task) => ({
        ...task,
        title: input.title,
        importance: input.importance,
        urgency: input.urgency,
        objectiveId: writes.resolve(input.objectiveId),
      })),
    );

    const result = await this.write(async () => {
      const id = writes.resolve(taskId);
      const objectiveId = writes.resolve(input.objectiveId);
      return isTemporaryId(id) || isTemporaryId(objectiveId)
        ? SKIPPED
        : gateway.editTask(id, { ...input, objectiveId });
    });
    if (result !== SKIPPED && result.success) {
      announcements.announce(SUCCESS_ANNOUNCEMENTS.taskSaved);
      return;
    }
    if (result !== SKIPPED) announcements.report(failureReport('editTask', result.error.code));
    // Retour au pas d'avant (son « fait » actuel est gardé), sauf si un geste plus récent l'a changé.
    cache.update((snapshot) => {
      const id = writes.resolve(taskId);
      const current = findTask(snapshot, id);
      const unchanged =
        current &&
        current.title === input.title &&
        current.importance === input.importance &&
        current.urgency === input.urgency &&
        writes.resolve(current.objectiveId) === writes.resolve(input.objectiveId);
      return unchanged
        ? updateTask(snapshot, id, (task) => ({
            ...old,
            id,
            objectiveId: writes.resolve(old.objectiveId),
            done: task.done,
          }))
        : snapshot;
    });
  }

  /** Coche ou décoche un pas. */
  async setTaskDone(taskId: string, done: boolean): Promise<void> {
    const { cache, gateway, writes, announcements } = this.deps;
    cache.update((snapshot) => setTaskDone(snapshot, taskId, done));

    const result = await this.write(async () => {
      const id = writes.resolve(taskId);
      return isTemporaryId(id) ? SKIPPED : gateway.setTaskDone(id, done);
    });
    if (result === SKIPPED) return;
    if (result.success) {
      announcements.announce(done ? SUCCESS_ANNOUNCEMENTS.taskDone : SUCCESS_ANNOUNCEMENTS.taskUndone);
      return;
    }
    announcements.report(failureReport('toggleTask', result.error.code));
    cache.update((snapshot) => {
      const id = writes.resolve(taskId);
      return findTask(snapshot, id)?.done === done ? setTaskDone(snapshot, id, !done) : snapshot;
    });
  }

  /**
   * Déplace un pas vers un quadrant de la matrice : seules l'importance et l'urgence qui doivent changer
   * changent (`levelsForQuadrant`), par la modification du pas.
   */
  async moveTaskToQuadrant(taskId: string, quadrant: Quadrant): Promise<void> {
    const { cache, gateway, writes, announcements } = this.deps;
    const old = findTask(cache.read(), taskId);
    if (!old) return;
    const levels = levelsForQuadrant(old, quadrant);
    if (levels.importance === old.importance && levels.urgency === old.urgency) return;
    const previous: Levels = { importance: old.importance, urgency: old.urgency };
    cache.update((snapshot) => setTaskLevels(snapshot, taskId, levels));

    const result = await this.write(async () => {
      const id = writes.resolve(taskId);
      // Le titre et l'objectif tels qu'ils sont au départ de l'écriture (un geste a pu les changer avant).
      const current: Task = findTask(cache.read(), id) ?? old;
      const objectiveId = writes.resolve(current.objectiveId);
      return isTemporaryId(id) || isTemporaryId(objectiveId)
        ? SKIPPED
        : gateway.editTask(id, { title: current.title, objectiveId, ...levels });
    });
    if (result === SKIPPED) return;
    if (result.success) {
      announcements.announce(taskMovedAnnouncement(quadrant));
      return;
    }
    announcements.report(failureReport('moveTask', result.error.code));
    cache.update((snapshot) => {
      const id = writes.resolve(taskId);
      const current = findTask(snapshot, id);
      return current && current.importance === levels.importance && current.urgency === levels.urgency
        ? setTaskLevels(snapshot, id, previous)
        : snapshot;
    });
  }

  /**
   * Une création qui retient son id définitif dès la réponse, dans la file : le geste suivant (cocher le pas
   * tout juste créé, poser un pas sur l'étape tout juste ajoutée) part après elle et le retrouve.
   */
  private async linked<T extends { readonly id: string }>(
    temporaryId: string,
    creation: Promise<Result<T>>,
  ): Promise<Result<T>> {
    const result = await creation;
    if (result.success) this.deps.writes.link(temporaryId, result.data.id);
    return result;
  }

  /** Une écriture dans la file ; une exception imprévue devient un échec, jamais un geste perdu. */
  private async write<T>(operation: () => Promise<T>): Promise<T | Result<never>> {
    try {
      return await this.deps.writes.run(operation);
    } catch (error) {
      return fail({ code: UNKNOWN_ERROR, message: error instanceof Error ? error.message : String(error) });
    }
  }
}
