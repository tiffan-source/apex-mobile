import { levelsForQuadrant, type Quadrant } from '@/domain/objectives/eisenhower';
import type { CreateObjectiveInput, EditObjectiveInput, EditTaskInput } from '@/domain/objectives/forms';
import {
  SUCCESS_ANNOUNCEMENTS,
  failureReport,
  taskMovedAnnouncement,
  type FailedAction,
} from '@/domain/objectives/messages';
import type { Objective, Task } from '@/domain/objectives/objective';
import {
  addObjective,
  addTask,
  findObjective,
  findTask,
  isTemporaryId,
  removeObjective,
  removeTask,
  swapObjectiveId,
  swapTaskId,
  updateObjective,
  updateTask,
} from '@/domain/objectives/snapshot';
import { CLIENT_ERRORS, UNKNOWN_ERROR, fail, type Failure, type Result } from '@/domain/shared/result';
import type { AnnouncementCenter } from '../announcements/announcement-center';
import type { NewTask, ObjectivesGateway } from '../ports/objectives-gateway';
import type { ObjectivesCache, TemporaryIds } from './objectives-cache';
import { PendingChanges } from './pending-changes';
import { SessionClosedError, type WriteQueue } from './write-queue';

/*
 * Les gestes sur les objectifs, étapes et pas, repris des stores du client web : chacun change d'abord la
 * copie locale (mise à jour optimiste, avec un id temporaire pour ce qu'il crée), puis s'écrit dans la file,
 * puis se réconcilie (id définitif, annonce) ou revient en arrière (signalement).
 *
 * - La réconciliation se fait dans la file même, dès la réponse : l'écriture suivante part de l'état qu'elle a
 *   laissé (id définitif retenu, ce que le serveur a accepté).
 * - Un retour en arrière rend à l'élément ce que le serveur a accepté (`PendingChanges`), quand le dernier
 *   geste en route sur lui est réglé : jamais la valeur d'un geste refusé, ni ne défait un geste plus récent.
 * - Un geste dont la session a pris fin ne se réconcilie pas et ne dit rien : la personne suivante ne voit
 *   rien de la précédente.
 */

export type ObjectiveCommandsDeps = {
  readonly gateway: ObjectivesGateway;
  readonly cache: ObjectivesCache;
  readonly writes: WriteQueue;
  readonly announcements: AnnouncementCenter;
  readonly ids: TemporaryIds;
};

/** Une écriture qui n'a pas pu partir : l'élément qu'elle visait n'a jamais été enregistré (déjà signalé). */
const SKIPPED = Symbol('écriture sautée');

/** La session du geste a pris fin : rien à réconcilier, rien à dire. */
const CLOSED = Symbol('session fermée');

type Sent<T> = Result<T> | typeof SKIPPED;

const accepted = <T>(sent: Sent<T>): sent is { readonly success: true; readonly data: T } =>
  sent !== SKIPPED && sent.success;

export class ObjectiveCommands {
  /** Ce que le serveur a accepté des pas et des objectifs que des gestes en route touchent. */
  private readonly tasks = new PendingChanges<Task>();
  private readonly objectives = new PendingChanges<Objective>();

  constructor(private readonly deps: ObjectiveCommandsDeps) {}

  /** Crée un objectif ; rend son id définitif une fois enregistré, ou null si l'enregistrement n'a pas abouti. */
  async createObjective(input: CreateObjectiveInput): Promise<string | null> {
    const { cache, gateway } = this.deps;
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

    const sent = await this.write(
      () => this.request(() => gateway.createObjective(input)),
      (result) => this.settleCreatedObjective(temporaryId, result),
    );
    if (sent === CLOSED || sent === SKIPPED) return null;
    if (sent.success) {
      this.deps.announcements.announce(SUCCESS_ANNOUNCEMENTS.objectiveCreated);
      return sent.data.id;
    }
    this.report('createObjective', sent.error);
    return null;
  }

  /** Modifie un objectif ou une étape : seul ce qui a changé part (`toEditObjectiveInput`). */
  async editObjective(objectiveId: string, input: EditObjectiveInput): Promise<void> {
    const { cache, gateway, writes } = this.deps;
    const id = writes.resolve(objectiveId);
    const shown = findObjective(cache.read(), id);
    if (!shown) return;
    // Un champ absent reste tel quel, comme sur le serveur.
    const change = (objective: Objective): Objective => ({
      ...objective,
      title: input.title,
      description: input.description ?? objective.description,
      why: input.why ?? objective.why,
      dueDate: input.dueDate === undefined ? objective.dueDate : input.dueDate,
    });
    this.objectives.begin(id, shown);
    cache.update((snapshot) => updateObjective(snapshot, id, change));

    const sent = await this.write(
      async () => {
        const target = writes.resolve(objectiveId);
        return isTemporaryId(target) ? SKIPPED : this.request(() => gateway.editObjective(target, input));
      },
      (result) => this.settleObjective(objectiveId, accepted(result) ? change : null),
    );
    this.tell(sent, 'editObjective', SUCCESS_ANNOUNCEMENTS.objectiveSaved);
  }

  /** Ajoute une étape à un objectif. */
  async addStage(objectiveId: string, title: string): Promise<void> {
    const { cache, gateway, writes } = this.deps;
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

    const sent = await this.write(
      async () => {
        const parentId = writes.resolve(objectiveId);
        return isTemporaryId(parentId) ? SKIPPED : this.request(() => gateway.addStage(parentId, title));
      },
      (result) => this.settleCreatedObjective(temporaryId, result),
    );
    this.tell(sent, 'addStage', SUCCESS_ANNOUNCEMENTS.stageAdded);
  }

  /** Ajoute un pas à une étape (ou à un objectif). */
  async addTask(stageId: string, task: NewTask): Promise<void> {
    const { cache, gateway, writes } = this.deps;
    const temporaryId = this.deps.ids.next();
    // L'étape a pu être enregistrée pendant que la feuille était ouverte : le pas va à son id définitif.
    cache.update((snapshot) =>
      addTask(snapshot, { id: temporaryId, ...task, done: false, objectiveId: writes.resolve(stageId) }),
    );

    const sent = await this.write(
      async () => {
        const target = writes.resolve(stageId);
        return isTemporaryId(target) ? SKIPPED : this.request(() => gateway.addTask(target, task));
      },
      (result) => {
        if (accepted(result)) {
          // Le pas garde son état optimiste (coché, déplacé…) : ces gestes partent ensuite dans la file.
          this.link(temporaryId, result.data.id);
          this.deps.cache.update((snapshot) => swapTaskId(snapshot, temporaryId, result.data.id));
        } else {
          this.deps.cache.update((snapshot) => removeTask(snapshot, temporaryId));
        }
      },
    );
    this.tell(sent, 'addTask', SUCCESS_ANNOUNCEMENTS.taskAdded);
  }

  /** Modifie un pas, ou le déplace en changeant `objectiveId`. Son « fait » ne change pas. */
  async editTask(taskId: string, input: EditTaskInput): Promise<void> {
    const { cache, gateway, writes } = this.deps;
    const id = writes.resolve(taskId);
    const shown = findTask(cache.read(), id);
    if (!shown) return;
    const change = (task: Task): Task => ({
      ...task,
      title: input.title,
      importance: input.importance,
      urgency: input.urgency,
      objectiveId: writes.resolve(input.objectiveId),
    });
    this.tasks.begin(id, shown);
    cache.update((snapshot) => updateTask(snapshot, id, change));

    const sent = await this.write(
      async () => {
        const target = writes.resolve(taskId);
        const objectiveId = writes.resolve(input.objectiveId);
        return isTemporaryId(target) || isTemporaryId(objectiveId)
          ? SKIPPED
          : this.request(() => gateway.editTask(target, { ...input, objectiveId }));
      },
      (result) => this.settleTask(taskId, accepted(result) ? change : null),
    );
    this.tell(sent, 'editTask', SUCCESS_ANNOUNCEMENTS.taskSaved);
  }

  /** Coche ou décoche un pas. */
  async setTaskDone(taskId: string, done: boolean): Promise<void> {
    const { cache, gateway, writes } = this.deps;
    const id = writes.resolve(taskId);
    const shown = findTask(cache.read(), id);
    if (!shown) return;
    const change = (task: Task): Task => ({ ...task, done });
    this.tasks.begin(id, shown);
    cache.update((snapshot) => updateTask(snapshot, id, change));

    const sent = await this.write(
      async () => {
        const target = writes.resolve(taskId);
        return isTemporaryId(target) ? SKIPPED : this.request(() => gateway.setTaskDone(target, done));
      },
      (result) => this.settleTask(taskId, accepted(result) ? change : null),
    );
    this.tell(sent, 'toggleTask', done ? SUCCESS_ANNOUNCEMENTS.taskDone : SUCCESS_ANNOUNCEMENTS.taskUndone);
  }

  /**
   * Déplace un pas vers un quadrant de la matrice : seules l'importance et l'urgence qui doivent changer
   * changent (`levelsForQuadrant`), par la modification du pas.
   */
  async moveTaskToQuadrant(taskId: string, quadrant: Quadrant): Promise<void> {
    const { cache, gateway, writes } = this.deps;
    const id = writes.resolve(taskId);
    const shown = findTask(cache.read(), id);
    if (!shown) return;
    const levels = levelsForQuadrant(shown, quadrant);
    if (levels.importance === shown.importance && levels.urgency === shown.urgency) return;
    const change = (task: Task): Task => ({ ...task, ...levels });
    this.tasks.begin(id, shown);
    cache.update((snapshot) => updateTask(snapshot, id, change));

    const sent = await this.write(
      async () => {
        const target = writes.resolve(taskId);
        // Le titre et l'étape que le serveur a déjà : la modification ne change que les niveaux, jamais elle
        // n'enregistre au passage la valeur d'un geste refusé.
        const base = this.tasks.confirmed(target) ?? shown;
        const objectiveId = writes.resolve(base.objectiveId);
        return isTemporaryId(target) || isTemporaryId(objectiveId)
          ? SKIPPED
          : this.request(() => gateway.editTask(target, { title: base.title, objectiveId, ...levels }));
      },
      (result) => this.settleTask(taskId, accepted(result) ? change : null),
    );
    this.tell(sent, 'moveTask', taskMovedAnnouncement(quadrant));
  }

  /** La session a pris fin : les gestes en route sont oubliés. */
  forget(): void {
    this.tasks.clear();
    this.objectives.clear();
  }

  /** Un objectif ou une étape créé : son id définitif, ou il disparaît avec ce qui n'existe que sur lui. */
  private settleCreatedObjective(temporaryId: string, result: Sent<{ readonly id: string }>): void {
    if (accepted(result)) {
      this.link(temporaryId, result.data.id);
      this.deps.cache.update((snapshot) => swapObjectiveId(snapshot, temporaryId, result.data.id));
    } else {
      this.deps.cache.update((snapshot) => removeObjective(snapshot, temporaryId));
    }
  }

  /** Le geste sur un pas est réglé ; le dernier rend au pas ce que le serveur en a accepté. */
  private settleTask(taskId: string, change: ((task: Task) => Task) | null): void {
    const { cache, writes } = this.deps;
    const id = writes.resolve(taskId);
    const confirmed = this.tasks.settle(id, change);
    if (!confirmed) return;
    cache.update((snapshot) =>
      updateTask(snapshot, id, () => ({
        ...confirmed,
        id,
        objectiveId: writes.resolve(confirmed.objectiveId),
      })),
    );
  }

  /** Le geste sur un objectif est réglé ; le dernier lui rend ce que le serveur en a accepté. */
  private settleObjective(objectiveId: string, change: ((objective: Objective) => Objective) | null): void {
    const { cache, writes } = this.deps;
    const id = writes.resolve(objectiveId);
    const confirmed = this.objectives.settle(id, change);
    if (!confirmed) return;
    cache.update((snapshot) =>
      updateObjective(snapshot, id, (current) => ({ ...confirmed, id, parentId: current.parentId })),
    );
  }

  /** Une création a reçu son id définitif : les gestes qui la suivent dans la file le retrouvent. */
  private link(temporaryId: string, realId: string): void {
    this.deps.writes.link(temporaryId, realId);
    this.tasks.rekey(temporaryId, realId);
    this.objectives.rekey(temporaryId, realId);
  }

  /**
   * Une écriture dans la file : `send` part à son tour, `settle` réconcilie la copie locale dès la réponse,
   * dans la file, si la session du geste est toujours ouverte.
   */
  private async write<T>(
    send: () => Promise<Sent<T>>,
    settle: (result: Sent<T>) => void,
  ): Promise<Sent<T> | typeof CLOSED> {
    const { writes } = this.deps;
    const session = writes.session;
    try {
      return await writes.run(async () => {
        const result = await send();
        if (writes.session !== session) return CLOSED;
        settle(result);
        return result;
      });
    } catch (error) {
      if (error instanceof SessionClosedError) return CLOSED;
      throw error;
    }
  }

  /** La requête ; une exception imprévue devient un échec, jamais un geste perdu. */
  private async request<T>(call: () => Promise<Result<T>>): Promise<Result<T>> {
    try {
      return await call();
    } catch (error) {
      return fail({ code: UNKNOWN_ERROR, message: error instanceof Error ? error.message : String(error) });
    }
  }

  /** La réussite annoncée, ou ce qui n'a pas abouti signalé ; rien pour une écriture sautée ou orpheline. */
  private tell<T>(sent: Sent<T> | typeof CLOSED, action: FailedAction, success: string): void {
    if (sent === CLOSED || sent === SKIPPED) return;
    if (sent.success) this.deps.announcements.announce(success);
    else this.report(action, sent.error);
  }

  /** Plus de session : l'écran de connexion le dit, rien d'autre n'est à signaler. */
  private report(action: FailedAction, failure: Failure): void {
    if (failure.code === CLIENT_ERRORS.signedOut) return;
    this.deps.announcements.report(failureReport(action, failure.code));
  }
}
