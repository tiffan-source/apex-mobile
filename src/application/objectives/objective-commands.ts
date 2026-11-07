import type { CreateObjectiveInput, EditObjectiveInput, EditTaskInput } from '@/domain/objectives/forms';
import { SUCCESS_ANNOUNCEMENTS, failureReport, type FailedAction } from '@/domain/objectives/messages';
import type { Objective, Task } from '@/domain/objectives/objective';
import {
  addObjective,
  addTask,
  eraseObjective,
  eraseTask,
  erasedParents,
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
import type { Clarification, NewTask, ObjectivesGateway } from '../ports/objectives-gateway';
import type { ObjectivesCache, TemporaryIds } from './objectives-cache';
import { PendingChanges } from './pending-changes';
import { SessionClosedError, type WriteQueue } from './write-queue';

/*
 * Les gestes sur les objectifs, étapes et pas, repris des stores du client web : chacun change d'abord la
 * copie locale (mise à jour optimiste, avec un id temporaire pour ce qu'il crée), puis s'écrit dans la file,
 * puis se réconcilie (id définitif, annonce) ou revient en arrière (signalement).
 *
 * - Chaque geste part en commandes nommées de la v2 d'Apex Brain (renommer, clarifier, fixer l'échéance,
 *   reprioriser, déplacer, cocher…) : une par champ changé, chacune avec son retour en arrière.
 * - La réconciliation se fait dans la file même, dès la réponse : l'écriture suivante part de l'état qu'elle a
 *   laissé (id définitif retenu, ce que le serveur a accepté). L'élément que la commande rend devient ce que le
 *   serveur a accepté (`accept…`) : pas de relecture des objectifs après un geste.
 * - Un retour en arrière rend à l'élément ce que le serveur a accepté (`PendingChanges`), quand le dernier
 *   geste en route sur lui est réglé : jamais la valeur d'un geste refusé, ni ne défait un geste plus récent.
 * - Un geste dont la session a pris fin ne se réconcilie pas et ne dit rien : la personne suivante ne voit
 *   rien de la précédente.
 * - Fait ou non fait, pour une étape ou un objectif, c'est le serveur qui le dit, à la lecture suivante : le
 *   client ne le calcule pas, et ne relit pas l'arbre pour autant.
 * - Effacer retire tout de suite l'élément de l'écran, avec ce qui en dépend ; un effacement refusé remet tout à
 *   sa place, tel que le serveur l'a, puis fait relire les objectifs (`onObjectivesChanged`) : la seule relecture
 *   qu'un geste demande. Un élément déjà effacé côté serveur (introuvable) l'est : rien à dire.
 */

export type ObjectiveCommandsDeps = {
  readonly gateway: ObjectivesGateway;
  readonly cache: ObjectivesCache;
  readonly writes: WriteQueue;
  readonly announcements: AnnouncementCenter;
  readonly ids: TemporaryIds;
  /** Un effacement a été refusé : les objectifs sont à relire, le serveur dit ce qui est vrai. */
  readonly onObjectivesChanged: () => void;
};

/** Une écriture qui n'a pas pu partir : l'élément qu'elle visait n'a jamais été enregistré (déjà signalé). */
const SKIPPED = Symbol('écriture sautée');

/** La session du geste a pris fin : rien à réconcilier, rien à dire. */
const CLOSED = Symbol('session fermée');

type Sent<T> = Result<T> | typeof SKIPPED;

const accepted = <T>(sent: Sent<T>): sent is { readonly success: true; readonly data: T } =>
  sent !== SKIPPED && sent.success;

/**
 * Un effacement en route : ce qu'il a retiré de l'écran (et ce que des effacements refusés lui ont confié), puis ce
 * qu'il en est advenu — parti, revenu à sa place, confié à l'effacement de son parent, ou sans place où revenir.
 */
type Erasure = {
  readonly objectives: Removed<Objective>[];
  readonly tasks: Removed<Task>[];
  outcome: 'gone' | 'restored' | 'handed' | 'dropped';
};

/** Un élément que le serveur ne trouve plus (`notFoundCode`) est déjà effacé : l'effacement a abouti. */
const alreadyErased = (result: Result<void>, notFoundCode: string): Result<void> =>
  !result.success && result.error.code === notFoundCode ? ok(undefined) : result;

export class ObjectiveCommands {
  /** Ce que le serveur a accepté des pas et des objectifs que des gestes en route touchent. */
  private readonly tasks = new PendingChanges<Task>();
  private readonly objectives = new PendingChanges<Objective>();
  /** Les effacements en route, avec ce qu'ils ont retiré de l'écran. */
  private readonly erasures = new Set<Erasure>();

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

  /**
   * Modifie un objectif ou une étape : une commande par champ changé (`rename`, `clarify` pour la description et le
   * pourquoi, `set-deadline` ou `remove-deadline`). Ce qui n'a pas changé ne part pas.
   */
  async editObjective(objectiveId: string, input: EditObjectiveInput): Promise<void> {
    const { cache, gateway, writes } = this.deps;
    const shown = findObjective(cache.read(), writes.resolve(objectiveId));
    if (!shown) return;
    const clarification: { description?: string; why?: string } = {};
    if (input.description !== undefined && input.description !== shown.description)
      clarification.description = input.description;
    if (input.why !== undefined && input.why !== shown.why) clarification.why = input.why;
    const dueDate = input.dueDate;

    const sent: Promise<Sent<Objective> | typeof CLOSED>[] = [];
    if (input.title !== shown.title) {
      const title = input.title;
      sent.push(
        this.changeObjective(
          objectiveId,
          (objective) => ({ ...objective, title }),
          (id) => gateway.renameObjective(id, title),
        ),
      );
    }
    if (Object.keys(clarification).length > 0) {
      const asked: Clarification = clarification;
      sent.push(
        this.changeObjective(
          objectiveId,
          (objective) => ({
            ...objective,
            description: asked.description ?? objective.description,
            why: asked.why ?? objective.why,
          }),
          (id) => gateway.clarifyObjective(id, asked),
        ),
      );
    }
    if (dueDate !== undefined && dueDate !== shown.dueDate) {
      sent.push(
        this.changeObjective(
          objectiveId,
          (objective) => ({ ...objective, dueDate }),
          (id) =>
            dueDate === null
              ? gateway.removeObjectiveDeadline(id)
              : gateway.setObjectiveDeadline(id, dueDate),
        ),
      );
    }
    if (sent.length === 0) return;
    this.tellAll(await Promise.all(sent), 'editObjective', SUCCESS_ANNOUNCEMENTS.objectiveSaved);
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
        return isTemporaryId(parentId)
          ? SKIPPED
          : this.request(() => gateway.addSubObjective(parentId, title));
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
          // Le pas garde son état optimiste (coché, déplacé…) tant que ces gestes attendent leur tour dans la file.
          this.link(temporaryId, result.data.id);
          this.deps.cache.update((snapshot) => swapTaskId(snapshot, temporaryId, result.data.id));
          this.acceptTask(result.data);
        } else {
          this.deps.cache.update((snapshot) => removeTask(snapshot, temporaryId));
        }
      },
    );
    this.tell(sent, 'addTask', SUCCESS_ANNOUNCEMENTS.taskAdded);
  }

  /**
   * Modifie un pas : une commande par changement (`rename`, `reprioritize` pour l'importance et l'urgence, `move`
   * pour un autre porteur). Son « fait » ne change pas.
   */
  async editTask(taskId: string, input: EditTaskInput): Promise<void> {
    const { cache, gateway, writes } = this.deps;
    const shown = findTask(cache.read(), writes.resolve(taskId));
    if (!shown) return;

    const sent: Promise<Sent<Task> | typeof CLOSED>[] = [];
    if (input.title !== shown.title) {
      const title = input.title;
      sent.push(
        this.changeTask(
          taskId,
          (task) => ({ ...task, title }),
          (id) => this.request(() => gateway.renameTask(id, title)),
        ),
      );
    }
    if (input.importance !== shown.importance || input.urgency !== shown.urgency) {
      const levels = { importance: input.importance, urgency: input.urgency };
      sent.push(
        this.changeTask(
          taskId,
          (task) => ({ ...task, ...levels }),
          (id) => this.request(() => gateway.reprioritizeTask(id, levels)),
        ),
      );
    }
    if (writes.resolve(input.objectiveId) !== writes.resolve(shown.objectiveId)) {
      sent.push(
        this.changeTask(
          taskId,
          (task) => ({ ...task, objectiveId: writes.resolve(input.objectiveId) }),
          async (id) => {
            // Le nouveau porteur n'a jamais été enregistré (déjà signalé) : le pas reste où il est.
            const objectiveId = writes.resolve(input.objectiveId);
            return isTemporaryId(objectiveId)
              ? SKIPPED
              : this.request(() => gateway.moveTask(id, objectiveId));
          },
        ),
      );
    }
    if (sent.length === 0) return;
    this.tellAll(await Promise.all(sent), 'editTask', SUCCESS_ANNOUNCEMENTS.taskSaved);
  }

  /** Coche (`complete`) ou décoche (`reopen`) un pas. */
  async setTaskDone(taskId: string, done: boolean): Promise<void> {
    const { cache, gateway, writes } = this.deps;
    if (!findTask(cache.read(), writes.resolve(taskId))) return;
    const sent = await this.changeTask(
      taskId,
      (task) => ({ ...task, done }),
      (id) => this.request(() => (done ? gateway.completeTask(id) : gateway.reopenTask(id))),
    );
    this.tell(sent, 'toggleTask', done ? SUCCESS_ANNOUNCEMENTS.taskDone : SUCCESS_ANNOUNCEMENTS.taskUndone);
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
    const erasure = this.beginErasing(eraseTask(current, id).removed);
    cache.update((snapshot) => eraseTask(snapshot, id).snapshot);

    const sent = await this.write(
      async () => {
        const target = writes.resolve(taskId);
        // Sa création n'a pas abouti (déjà signalé) : il n'est pas en base.
        if (isTemporaryId(target)) return SKIPPED;
        return this.request(async () => alreadyErased(await gateway.deleteTask(target), 'TASK_NOT_FOUND'));
      },
      (result) => this.settleErased(erasure, result !== SKIPPED && !result.success),
    );
    this.tellErased(sent, erasure, 'eraseTask');
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
    const erasure = this.beginErasing(eraseObjective(current, target.id).removed);
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
      (result) => this.settleErased(erasure, result !== SKIPPED && !result.success),
    );
    this.tellErased(
      sent,
      erasure,
      isStage ? 'eraseStage' : 'eraseObjective',
      isStage ? SUCCESS_ANNOUNCEMENTS.stageErased : SUCCESS_ANNOUNCEMENTS.objectiveErased,
    );
  }

  /** L'id définitif d'un élément s'il est connu, sinon l'id tel quel. */
  currentId(id: string): string {
    return this.deps.writes.resolve(id);
  }

  /** La session a pris fin : les gestes en route sont oubliés. */
  forget(): void {
    this.tasks.clear();
    this.objectives.clear();
    this.erasures.clear();
  }

  /** Un objectif ou une étape créé : son id définitif, ou il disparaît avec ce qui n'existe que sur lui. */
  private settleCreatedObjective(temporaryId: string, result: Sent<Objective>): void {
    if (accepted(result)) {
      this.link(temporaryId, result.data.id);
      this.deps.cache.update((snapshot) => swapObjectiveId(snapshot, temporaryId, result.data.id));
      this.acceptObjective(result.data);
    } else {
      this.deps.cache.update((snapshot) => removeObjective(snapshot, temporaryId));
    }
  }

  /**
   * Une commande sur un objectif ou une étape : le changement s'affiche tout de suite, la commande part à son tour,
   * et l'élément qu'elle rend devient ce que le serveur a accepté.
   */
  private async changeObjective(
    objectiveId: string,
    change: (objective: Objective) => Objective,
    send: (id: string) => Promise<Result<Objective>>,
  ): Promise<Sent<Objective> | typeof CLOSED> {
    const { cache, writes } = this.deps;
    const id = writes.resolve(objectiveId);
    const shown = findObjective(cache.read(), id);
    if (!shown) return SKIPPED;
    this.objectives.begin(id, shown);
    cache.update((snapshot) => updateObjective(snapshot, id, change));
    return this.write(
      async () => {
        const target = writes.resolve(objectiveId);
        return isTemporaryId(target) ? SKIPPED : this.request(() => send(target));
      },
      (result) => this.settleObjective(objectiveId, accepted(result) ? () => result.data : null),
    );
  }

  /** Une commande sur un pas, comme `changeObjective` ; `send` peut sauter l'écriture (`SKIPPED`). */
  private async changeTask(
    taskId: string,
    change: (task: Task) => Task,
    send: (id: string) => Promise<Sent<Task>>,
  ): Promise<Sent<Task> | typeof CLOSED> {
    const { cache, writes } = this.deps;
    const id = writes.resolve(taskId);
    const shown = findTask(cache.read(), id);
    if (!shown) return SKIPPED;
    this.tasks.begin(id, shown);
    cache.update((snapshot) => updateTask(snapshot, id, change));
    return this.write(
      async () => {
        const target = writes.resolve(taskId);
        return isTemporaryId(target) ? SKIPPED : send(target);
      },
      (result) => this.settleTask(taskId, accepted(result) ? () => result.data : null),
    );
  }

  /**
   * Ce que le serveur a enregistré d'un pas qui vient d'être créé : le point de départ des gestes en route sur lui,
   * ou, s'il n'y en a pas, ce que l'écran montre.
   */
  private acceptTask(task: Task): void {
    if (this.tasks.confirm(task.id, task)) return;
    this.deps.cache.update((snapshot) => updateTask(snapshot, task.id, () => task));
  }

  /** Comme `acceptTask`, pour un objectif ou une étape. */
  private acceptObjective(objective: Objective): void {
    if (this.objectives.confirm(objective.id, objective)) return;
    this.deps.cache.update((snapshot) => updateObjective(snapshot, objective.id, () => objective));
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
  private beginErasing(removed: RemovedItems): Erasure {
    for (const { item } of removed.objectives) this.objectives.begin(item.id, item);
    for (const { item } of removed.tasks) this.tasks.begin(item.id, item);
    const erasure: Erasure = {
      objectives: [...removed.objectives],
      tasks: [...removed.tasks],
      outcome: 'gone',
    };
    this.erasures.add(erasure);
    return erasure;
  }

  /**
   * Un effacement est réglé. Accepté (ou sans objet), ce qu'il a retiré est oublié. Refusé, tout revient à sa place,
   * tel que le serveur l'a (`PendingChanges` : un pas coché juste avant, refusé lui aussi, revient décoché), sauf ce
   * dont la création n'a pas abouti entre-temps. Si son parent attend lui-même d'être effacé (une étape effacée
   * pendant qu'un de ses pas partait), ce qui revient lui est confié : il reviendra avec lui, ou partira avec lui.
   */
  private settleErased(erasure: Erasure, refused: boolean): void {
    const { cache, writes } = this.deps;
    this.erasures.delete(erasure);
    const back: { objectives: Removed<Objective>[]; tasks: Removed<Task>[] } = { objectives: [], tasks: [] };
    for (const { index, item } of erasure.objectives) {
      const id = writes.resolve(item.id);
      const confirmed = this.objectives.settle(id, refused ? null : (objective) => objective) ?? item;
      if (!refused || isTemporaryId(id)) continue;
      const parentId = item.parentId === null ? null : writes.resolve(item.parentId);
      back.objectives.push({ index, item: { ...confirmed, id, parentId } });
    }
    for (const { index, item } of erasure.tasks) {
      const id = writes.resolve(item.id);
      const confirmed = this.tasks.settle(id, refused ? null : (task) => task) ?? item;
      if (!refused || isTemporaryId(id)) continue;
      back.tasks.push({
        index,
        item: { ...confirmed, id, objectiveId: writes.resolve(confirmed.objectiveId) },
      });
    }
    if (!refused) {
      erasure.outcome = 'gone';
      return;
    }
    const heir = this.pendingErasureOf(erasedParents(back));
    if (heir) {
      heir.objectives.push(...back.objectives);
      heir.tasks.push(...back.tasks);
      erasure.outcome = 'handed';
      return;
    }
    const current = cache.read();
    const restored = current ? restoreErased(current, back) : null;
    if (restored) cache.update(() => restored);
    erasure.outcome = restored ? 'restored' : 'dropped';
  }

  /** L'effacement en route qui emporte l'un de ces objectifs (ou étapes), s'il y en a un. */
  private pendingErasureOf(objectiveIds: readonly string[]): Erasure | undefined {
    const { writes } = this.deps;
    const wanted = new Set(objectiveIds.map((id) => writes.resolve(id)));
    if (wanted.size === 0) return undefined;
    for (const erasure of this.erasures) {
      if (erasure.objectives.some(({ item }) => wanted.has(writes.resolve(item.id)))) return erasure;
    }
    return undefined;
  }

  /**
   * Ce qu'un effacement dit : sa réussite, s'il y a quelque chose à annoncer ; refusé, qu'il est revenu à sa place,
   * seulement s'il y est revenu (confié à l'effacement de son parent, ou parti avec lui, c'est ce dernier qui
   * parlera). Un effacement refusé fait relire les objectifs : le serveur dit ce qui est vrai (un effacement fait
   * avant que sa réponse se perde, un geste refusé entre-temps).
   */
  private tellErased<T>(
    sent: Sent<T> | typeof CLOSED,
    erasure: Erasure,
    action: FailedAction,
    success?: string,
  ): void {
    if (sent === CLOSED || sent === SKIPPED) return;
    if (sent.success) {
      if (success) this.deps.announcements.announce(success);
      return;
    }
    if (erasure.outcome === 'restored') this.report(action, sent.error);
    this.deps.onObjectivesChanged();
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

  /**
   * Un geste parti en plusieurs commandes : une seule annonce. Ce qui n'a pas abouti est signalé une fois ; la
   * réussite n'est annoncée que si toutes ont abouti. Rien si la session a pris fin.
   */
  private tellAll<T>(
    sent: readonly (Sent<T> | typeof CLOSED)[],
    action: FailedAction,
    success: string,
  ): void {
    if (sent.includes(CLOSED)) return;
    const refused = sent.find((one) => one !== SKIPPED && one !== CLOSED && !one.success);
    if (refused) return this.tell(refused, action, success);
    if (sent.some((one) => one === SKIPPED)) return;
    this.deps.announcements.announce(success);
  }

  /** Plus de session : l'écran de connexion le dit, rien d'autre n'est à signaler. */
  private report(action: FailedAction, failure: Failure): void {
    if (failure.code === CLIENT_ERRORS.signedOut) return;
    this.deps.announcements.report(failureReport(action, failure.code));
  }
}
