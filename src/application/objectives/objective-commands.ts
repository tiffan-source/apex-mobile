import type { CreateObjectiveInput, EditObjectiveInput, EditTaskInput } from '@/domain/objectives/forms';
import { SUCCESS_ANNOUNCEMENTS, failureReport, type FailedAction } from '@/domain/objectives/messages';
import type { Objective, Task } from '@/domain/objectives/objective';
import {
  addObjective,
  addTask,
  eraseObjective,
  eraseTask,
  findObjective,
  findTask,
  isTemporaryId,
  removeObjective,
  removeTask,
  restoreErased,
  swapObjectiveId,
  swapTaskId,
  updateObjective,
  updateTask,
  type Removed,
  type RemovedItems,
} from '@/domain/objectives/snapshot';
import { CLIENT_ERRORS, UNKNOWN_ERROR, fail, ok, type Failure, type Result } from '@/domain/shared/result';
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
 * - Fait ou non fait, pour une étape ou un objectif, c'est le serveur qui le dit : après un pas coché, ajouté,
 *   modifié ou effacé, ou une étape effacée, les objectifs sont relus (`onObjectivesChanged`).
 * - Effacer retire tout de suite l'élément de l'écran, avec ce qui en dépend ; un effacement refusé remet tout à
 *   sa place, tel que le serveur l'a. Un élément déjà effacé côté serveur (introuvable) l'est : rien à dire.
 */

export type ObjectiveCommandsDeps = {
  readonly gateway: ObjectivesGateway;
  readonly cache: ObjectivesCache;
  readonly writes: WriteQueue;
  readonly announcements: AnnouncementCenter;
  readonly ids: TemporaryIds;
  /** Un geste a pu changer ce qui est fait : les objectifs sont à relire. */
  readonly onObjectivesChanged: () => void;
};

/** Une écriture qui n'a pas pu partir : l'élément qu'elle visait n'a jamais été enregistré (déjà signalé). */
const SKIPPED = Symbol('écriture sautée');

/** La session du geste a pris fin : rien à réconcilier, rien à dire. */
const CLOSED = Symbol('session fermée');

type Sent<T> = Result<T> | typeof SKIPPED;

const accepted = <T>(sent: Sent<T>): sent is { readonly success: true; readonly data: T } =>
  sent !== SKIPPED && sent.success;

/** Un élément que le serveur ne trouve plus (`notFoundCode`) est déjà effacé : l'effacement a abouti. */
const alreadyErased = (result: Result<void>, notFoundCode: string): Result<void> =>
  !result.success && result.error.code === notFoundCode ? ok(undefined) : result;

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
        done: false,
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
        done: false,
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
    this.reread(sent);
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
    this.reread(sent);
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
    this.reread(sent);
  }

  /**
   * Efface un pas, pour de bon : il part de l'écran tout de suite, puis de la base. Sa trace (`TaskTrace`) a déjà dit
   * qu'il partait : la réussite ne s'annonce pas. Un pas qui n'est plus là (déjà effacé, parti avec son étape) est
   * ignoré : l'effacement peut être demandé plusieurs fois pour le même pas.
   */
  async deleteTask(taskId: string): Promise<void> {
    const { cache, gateway, writes } = this.deps;
    const current = cache.read();
    const id = writes.resolve(taskId);
    if (!current || !findTask(current, id)) return;
    const { removed } = eraseTask(current, id);
    this.beginErasing(removed);
    cache.update((snapshot) => eraseTask(snapshot, id).snapshot);

    const sent = await this.write(
      async () => {
        const target = writes.resolve(taskId);
        // Sa création n'a pas abouti (déjà signalé) : il n'est pas en base.
        if (isTemporaryId(target)) return SKIPPED;
        return this.request(async () => alreadyErased(await gateway.deleteTask(target), 'TASK_NOT_FOUND'));
      },
      (result) => this.settleErased(removed, result !== SKIPPED && !result.success),
    );
    this.tell(sent, 'eraseTask');
    // Sans ce pas, son étape peut être faite : le serveur le dira à la prochaine lecture.
    this.reread(sent);
  }

  /**
   * Efface un objectif ou une étape, avec tout ce qui en dépend : ses étapes, leurs pas et, pour un objectif, sa
   * conversation avec Akari (le serveur l'efface avec lui). Tout part de l'écran tout de suite, puis de la base.
   * L'écran a déjà demandé la confirmation.
   */
  async deleteObjective(objectiveId: string): Promise<void> {
    const { cache, gateway, writes } = this.deps;
    const current = cache.read();
    const target = findObjective(current, writes.resolve(objectiveId));
    if (!current || !target) return;
    const isStage = target.parentId !== null;
    const { removed } = eraseObjective(current, target.id);
    this.beginErasing(removed);
    cache.update((snapshot) => eraseObjective(snapshot, target.id).snapshot);

    const sent = await this.write(
      async () => {
        const id = writes.resolve(objectiveId);
        // Sa création n'a pas abouti (déjà signalé) : il n'est pas en base.
        if (isTemporaryId(id)) return SKIPPED;
        return this.request(async () =>
          alreadyErased(await gateway.deleteObjective(id), 'OBJECTIVE_NOT_FOUND'),
        );
      },
      (result) => this.settleErased(removed, result !== SKIPPED && !result.success),
    );
    this.tell(
      sent,
      isStage ? 'eraseStage' : 'eraseObjective',
      isStage ? SUCCESS_ANNOUNCEMENTS.stageErased : SUCCESS_ANNOUNCEMENTS.objectiveErased,
    );
    // Sans cette étape, son objectif peut être fait : le serveur le dira à la prochaine lecture.
    if (isStage) this.reread(sent);
  }

  /** L'id définitif d'un élément s'il est connu, sinon l'id tel quel. */
  currentId(id: string): string {
    return this.deps.writes.resolve(id);
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

  /** Un effacement commence : ce qu'il retire est un geste en route sur chacun de ces éléments. */
  private beginErasing(removed: RemovedItems): void {
    for (const { item } of removed.objectives) this.objectives.begin(item.id, item);
    for (const { item } of removed.tasks) this.tasks.begin(item.id, item);
  }

  /**
   * Un effacement est réglé. Accepté (ou sans objet), ce qu'il a retiré est oublié. Refusé, tout revient à sa place,
   * tel que le serveur l'a (`PendingChanges` : un pas coché juste avant, refusé lui aussi, revient décoché), sauf ce
   * dont la création n'a pas abouti entre-temps.
   */
  private settleErased(removed: RemovedItems, refused: boolean): void {
    const { cache, writes } = this.deps;
    const objectives: Removed<Objective>[] = [];
    const tasks: Removed<Task>[] = [];
    for (const { index, item } of removed.objectives) {
      const id = writes.resolve(item.id);
      const confirmed = this.objectives.settle(id, refused ? null : (objective) => objective) ?? item;
      if (!refused || isTemporaryId(id)) continue;
      const parentId = item.parentId === null ? null : writes.resolve(item.parentId);
      objectives.push({ index, item: { ...confirmed, id, parentId } });
    }
    for (const { index, item } of removed.tasks) {
      const id = writes.resolve(item.id);
      const confirmed = this.tasks.settle(id, refused ? null : (task) => task) ?? item;
      if (!refused || isTemporaryId(id)) continue;
      tasks.push({ index, item: { ...confirmed, id, objectiveId: writes.resolve(confirmed.objectiveId) } });
    }
    if (refused) cache.update((snapshot) => restoreErased(snapshot, { objectives, tasks }));
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

  /**
   * La réussite annoncée (s'il y a quelque chose à dire), ou ce qui n'a pas abouti signalé ; rien pour une écriture
   * sautée ou orpheline.
   */
  private tell<T>(sent: Sent<T> | typeof CLOSED, action: FailedAction, success?: string): void {
    if (sent === CLOSED || sent === SKIPPED) return;
    if (!sent.success) this.report(action, sent.error);
    else if (success) this.deps.announcements.announce(success);
  }

  /** Une écriture acceptée a pu changer ce qui est fait : le serveur le dira à la prochaine lecture. */
  private reread<T>(sent: Sent<T> | typeof CLOSED): void {
    if (sent !== CLOSED && accepted(sent)) this.deps.onObjectivesChanged();
  }

  /** Plus de session : l'écran de connexion le dit, rien d'autre n'est à signaler. */
  private report(action: FailedAction, failure: Failure): void {
    if (failure.code === CLIENT_ERRORS.signedOut) return;
    this.deps.announcements.report(failureReport(action, failure.code));
  }
}
