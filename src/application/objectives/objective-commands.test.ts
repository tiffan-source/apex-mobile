import { quadrantOf } from '@/domain/objectives/eisenhower';
import { FAILURE_REPORTS, SUCCESS_ANNOUNCEMENTS } from '@/domain/objectives/messages';
import type { ObjectivesSnapshot, Task } from '@/domain/objectives/objective';
import { isTemporaryId } from '@/domain/objectives/snapshot';
import { CLIENT_ERRORS } from '@/domain/shared/result';
import { voiceIssues } from '@/domain/shared/voice';
import { InMemoryCache, RecordingAnnouncer } from '@/testing/fakes';
import { InMemoryObjectivesGateway, flush } from '@/testing/in-memory-objectives-gateway';
import { AnnouncementCenter } from '../announcements/announcement-center';
import { ObjectiveCommands } from './objective-commands';
import { createTemporaryIds } from './objectives-cache';
import { ObjectivesLoader } from './objectives-loader';
import { WriteQueue } from './write-queue';

/* Les cas des stores du client web (`objective.store.spec.ts`) : aucune réponse ne se perd, les écritures
   partent une par une, un geste sur un élément optimiste part avec l'id définitif, le chargement garde les
   créations en vol. */

function setup(seed?: (gateway: InMemoryObjectivesGateway) => void) {
  const gateway = new InMemoryObjectivesGateway();
  seed?.(gateway);
  const cache = new InMemoryCache();
  const writes = new WriteQueue();
  const announcer = new RecordingAnnouncer();
  const announcements = new AnnouncementCenter(announcer);
  const onObjectivesChanged = jest.fn();
  const commands = new ObjectiveCommands({
    gateway,
    cache,
    writes,
    announcements,
    ids: createTemporaryIds(),
    onObjectivesChanged,
  });
  const loader = new ObjectivesLoader({ gateway, writes, cache });
  const load = async () => {
    const result = await loader.load();
    if (result.success) cache.snapshot = result.data;
    return result;
  };
  const snapshot = (): ObjectivesSnapshot => cache.read() as ObjectivesSnapshot;
  return {
    gateway,
    cache,
    writes,
    announcer,
    announcements,
    commands,
    loader,
    load,
    snapshot,
    onObjectivesChanged,
  };
}

function seedSemi(gateway: InMemoryObjectivesGateway) {
  gateway.seedObjective({ id: 'semi', title: 'Courir un semi-marathon' });
  gateway.seedObjective({ id: 'endurance', title: 'Endurance', parentId: 'semi' });
  gateway.seedTask({ id: 'p1', title: 'Courir 5 km', objectiveId: 'endurance', importance: 4, urgency: 4 });
  gateway.seedTask({ id: 'p2', title: 'Courir 8 km', objectiveId: 'endurance', importance: 3, urgency: 1 });
}

describe('ObjectiveCommands', () => {
  it("crée un objectif tout de suite à l'écran, puis lui donne son id définitif", async () => {
    const t = setup();
    await t.load();
    const saved = t.commands.createObjective({ title: 'Décrocher un stage' });
    expect(t.snapshot().objectives).toHaveLength(1);
    expect(isTemporaryId(t.snapshot().objectives[0]?.id)).toBe(true);
    const id = await saved;
    expect(id).toBe('o-1');
    expect(t.snapshot().objectives.map((objective) => objective.id)).toEqual(['o-1']);
    expect(t.announcer.said).toEqual([
      { text: SUCCESS_ANNOUNCEMENTS.objectiveCreated, politeness: 'polite' },
    ]);
  });

  it("retire l'objectif optimiste et le signale si la création n'aboutit pas", async () => {
    const t = setup();
    await t.load();
    t.gateway.failNext('createObjective', 'UNKNOWN_ERROR');
    expect(await t.commands.createObjective({ title: 'Décrocher un stage' })).toBeNull();
    expect(t.snapshot().objectives).toEqual([]);
    expect(t.announcements.report$.get()).toBe(FAILURE_REPORTS.createObjective);
  });

  it('deux pas ajoutés coup sur coup reçoivent tous deux leur id définitif', async () => {
    const t = setup(seedSemi);
    await t.load();
    await Promise.all([
      t.commands.addTask('endurance', { title: 'Étirements', importance: 3, urgency: 2 }),
      t.commands.addTask('endurance', { title: 'Fractionné', importance: 3, urgency: 2 }),
    ]);
    expect(t.snapshot().tasks.map((task) => task.id)).toEqual(['p1', 'p2', 'p-1', 'p-2']);
    expect(t.gateway.calls.filter((call) => call === 'addTask')).toHaveLength(2);
  });

  it('les écritures partent une par une, dans l’ordre des gestes', async () => {
    const t = setup(seedSemi);
    await t.load();
    t.gateway.hold();
    const first = t.commands.setTaskDone('p1', true);
    const second = t.commands.setTaskDone('p2', true);
    await flush();
    // La seconde attend la réponse de la première : une seule requête est partie.
    expect(t.gateway.calls.filter((call) => call === 'setTaskDone')).toHaveLength(1);
    await t.gateway.release();
    await Promise.all([first, second]);
    expect(t.gateway.calls.filter((call) => call === 'setTaskDone')).toHaveLength(2);
    expect(t.gateway.tasks.every((task) => task.done)).toBe(true);
  });

  it('un retour en arrière n’écrase pas un geste plus récent', async () => {
    const t = setup(seedSemi);
    await t.load();
    t.gateway.failNext('setTaskDone');
    const first = t.commands.setTaskDone('p1', true);
    const second = t.commands.setTaskDone('p1', false);
    await Promise.all([first, second]);
    // Le premier geste n'a pas abouti, mais le second (décoché) est plus récent : le pas reste décoché.
    expect(t.snapshot().tasks.find((task) => task.id === 'p1')?.done).toBe(false);
    expect(t.announcements.report$.get()).toBe(FAILURE_REPORTS.toggleTask);
  });

  it('un pas coché qui n’est pas enregistré revient en arrière, et le dit', async () => {
    const t = setup(seedSemi);
    await t.load();
    t.gateway.failNext('setTaskDone');
    await t.commands.setTaskDone('p1', true);
    expect(t.snapshot().tasks.find((task) => task.id === 'p1')?.done).toBe(false);
    expect(t.announcements.report$.get()).toBe(FAILURE_REPORTS.toggleTask);
  });

  it("un pas ajouté à une étape pas encore enregistrée part avec l'id définitif de l'étape", async () => {
    const t = setup(seedSemi);
    await t.load();
    const stage = t.commands.addStage('semi', 'Mental');
    const temporaryStageId = t.snapshot().objectives.at(-1)?.id as string;
    const task = t.commands.addTask(temporaryStageId, {
      title: 'Visualiser la course',
      importance: 3,
      urgency: 2,
    });
    await Promise.all([stage, task]);
    const savedStage = t.gateway.objectives.find((objective) => objective.title === 'Mental');
    expect(t.gateway.tasks.find((item) => item.title === 'Visualiser la course')?.objectiveId).toBe(
      savedStage?.id,
    );
    expect(t.snapshot().tasks.at(-1)?.objectiveId).toBe(savedStage?.id);
    expect(t.snapshot().objectives.some((objective) => isTemporaryId(objective.id))).toBe(false);
  });

  it('un pas coché avant d’être enregistré est enregistré coché, avec son id définitif', async () => {
    const t = setup(seedSemi);
    await t.load();
    const added = t.commands.addTask('endurance', { title: 'Étirements', importance: 3, urgency: 2 });
    const temporaryId = t.snapshot().tasks.at(-1)?.id as string;
    const done = t.commands.setTaskDone(temporaryId, true);
    await Promise.all([added, done]);
    expect(t.gateway.tasks.find((task) => task.title === 'Étirements')?.done).toBe(true);
    expect(t.snapshot().tasks.at(-1)).toMatchObject({ done: true });
    expect(isTemporaryId(t.snapshot().tasks.at(-1)?.id)).toBe(false);
  });

  it('une étape posée sur un objectif dont la création n’a pas abouti disparaît avec lui, sans requête', async () => {
    const t = setup();
    await t.load();
    t.gateway.failNext('createObjective');
    const created = t.commands.createObjective({ title: 'Décrocher un stage' });
    const temporaryId = t.snapshot().objectives[0]?.id as string;
    const stage = t.commands.addStage(temporaryId, 'Portfolio');
    await Promise.all([created, stage]);
    expect(t.snapshot().objectives).toEqual([]);
    expect(t.gateway.calls).not.toContain('addStage');
    expect(t.announcements.report$.get()).toBe(FAILURE_REPORTS.createObjective);
  });

  it("modifie un objectif sans effacer ce qui n'a pas changé, et revient en arrière s'il le faut", async () => {
    const t = setup((gateway) =>
      gateway.seedObjective({ id: 'semi', title: 'Courir', why: 'Tenir six mois' }),
    );
    await t.load();
    await t.commands.editObjective('semi', { title: 'Courir un semi' });
    expect(t.snapshot().objectives[0]).toMatchObject({ title: 'Courir un semi', why: 'Tenir six mois' });
    t.gateway.failNext('editObjective');
    await t.commands.editObjective('semi', { title: 'Autre', dueDate: null });
    expect(t.snapshot().objectives[0]).toMatchObject({ title: 'Courir un semi', why: 'Tenir six mois' });
    expect(t.announcements.report$.get()).toBe(FAILURE_REPORTS.editObjective);
  });

  it('un pas déplacé dans une autre étape la rejoint, et revient si le serveur ne le retrouve plus', async () => {
    const t = setup((gateway) => {
      seedSemi(gateway);
      gateway.seedObjective({ id: 'mental', title: 'Mental', parentId: 'semi' });
    });
    await t.load();
    await t.commands.editTask('p1', {
      title: 'Courir 5 km',
      objectiveId: 'mental',
      importance: 4,
      urgency: 4,
    });
    expect(t.gateway.tasks.find((task) => task.id === 'p1')?.objectiveId).toBe('mental');
    t.gateway.failNext('editTask', 'TASK_NOT_FOUND');
    await t.commands.editTask('p1', { title: 'Renommé', objectiveId: 'mental', importance: 4, urgency: 4 });
    expect(t.snapshot().tasks.find((task) => task.id === 'p1')?.title).toBe('Courir 5 km');
    expect(t.announcements.report$.get()).toBe(FAILURE_REPORTS.taskNotFound);
  });
});

describe('fait ou non fait, le serveur le dit', () => {
  it('relit les objectifs après un pas coché, ajouté ou modifié', async () => {
    const t = setup(seedSemi);
    await t.load();

    await t.commands.setTaskDone('p1', true);
    expect(t.onObjectivesChanged).toHaveBeenCalledTimes(1);

    await t.commands.addTask('endurance', { title: 'Fractionné', importance: 3, urgency: 2 });
    expect(t.onObjectivesChanged).toHaveBeenCalledTimes(2);

    await t.commands.editTask('p1', {
      title: 'Courir 9 km',
      objectiveId: 'endurance',
      importance: 4,
      urgency: 4,
    });
    expect(t.onObjectivesChanged).toHaveBeenCalledTimes(3);
  });

  it('ne relit rien quand le geste est refusé, ni pour un geste qui ne change pas ce qui est fait', async () => {
    const t = setup(seedSemi);
    await t.load();

    t.gateway.failNext('setTaskDone', 'FAIL_TO_SAVE_TASK');
    await t.commands.setTaskDone('p1', true);
    await t.commands.addStage('semi', 'Mental');

    expect(t.onObjectivesChanged).not.toHaveBeenCalled();
  });

  it('une étape reste non faite tant que le serveur ne la dit pas faite', async () => {
    const t = setup(seedSemi);
    await t.load();
    const endurance = () => t.snapshot().objectives.find((item) => item.id === 'endurance');

    await t.commands.setTaskDone('p1', true);
    await t.commands.setTaskDone('p2', true);
    expect(endurance()?.done).toBe(false);

    await t.load();
    expect(endurance()?.done).toBe(true);
  });

  it('retrouve l’id définitif d’une étape que la personne a ouverte avant son enregistrement', async () => {
    const t = setup(seedSemi);
    await t.load();
    const saved = t.commands.addStage('semi', 'Mental');
    const temporary = t.snapshot().objectives.find((item) => item.title === 'Mental')?.id as string;
    expect(t.commands.currentId(temporary)).toBe(temporary);

    await saved;
    const real = t.snapshot().objectives.find((item) => item.title === 'Mental')?.id;
    expect(isTemporaryId(real)).toBe(false);
    expect(t.commands.currentId(temporary)).toBe(real);
  });
});

describe('un retour en arrière rend ce que le serveur a accepté', () => {
  const p1 = (t: ReturnType<typeof setup>) => t.snapshot().tasks.find((task) => task.id === 'p1');
  const serverP1 = (t: ReturnType<typeof setup>) => t.gateway.tasks.find((task) => task.id === 'p1');

  it('cocher puis décocher hors connexion : le pas revient à ce qu’a le serveur', async () => {
    const t = setup(seedSemi);
    await t.load();
    t.gateway.failNext('setTaskDone', 'NETWORK_UNREACHABLE');
    t.gateway.failNext('setTaskDone', 'NETWORK_UNREACHABLE');
    await Promise.all([t.commands.setTaskDone('p1', true), t.commands.setTaskDone('p1', false)]);
    expect(serverP1(t)?.done).toBe(false);
    expect(p1(t)?.done).toBe(false);
    expect(t.announcements.report$.get()).toBe(FAILURE_REPORTS.toggleTask);
  });

  it('une importance et une urgence modifiées rangent le pas dans un autre quadrant', async () => {
    const t = setup(seedSemi);
    await t.load();
    await t.commands.editTask('p1', {
      title: 'Courir 5 km',
      objectiveId: 'endurance',
      importance: 4,
      urgency: 2,
    });
    expect(quadrantOf(p1(t) as Task)).toBe('planifier');
    expect(quadrantOf(serverP1(t) as Task)).toBe('planifier');
  });

  it('deux modifications refusées : le pas reste dans son quadrant', async () => {
    const t = setup(seedSemi);
    await t.load();
    t.gateway.failNext('editTask');
    t.gateway.failNext('editTask');
    const task = { title: 'Courir 5 km', objectiveId: 'endurance' };
    await Promise.all([
      t.commands.editTask('p1', { ...task, importance: 4, urgency: 2 }),
      t.commands.editTask('p1', { ...task, importance: 2, urgency: 2 }),
    ]);
    expect(quadrantOf(p1(t) as Task)).toBe('maintenant');
    expect(quadrantOf(serverP1(t) as Task)).toBe('maintenant');
  });

  it('deux modifications refusées : l’objectif garde son nom', async () => {
    const t = setup(seedSemi);
    await t.load();
    t.gateway.failNext('editObjective');
    t.gateway.failNext('editObjective');
    await Promise.all([
      t.commands.editObjective('semi', { title: 'B' }),
      t.commands.editObjective('semi', { title: 'C' }),
    ]);
    expect(t.snapshot().objectives.find((objective) => objective.id === 'semi')?.title).toBe(
      'Courir un semi-marathon',
    );
  });

  it('le premier geste accepté, le second refusé : le pas montre le premier', async () => {
    const t = setup(seedSemi);
    await t.load();
    t.gateway.failNext('setTaskDone', 'UNKNOWN_ERROR', 1);
    await Promise.all([t.commands.setTaskDone('p1', true), t.commands.setTaskDone('p1', false)]);
    expect(serverP1(t)?.done).toBe(true);
    expect(p1(t)?.done).toBe(true);
  });

  it('un pas rangé sur une étape dont la création n’aboutit pas revient dans son étape', async () => {
    const t = setup(seedSemi);
    await t.load();
    t.gateway.failNext('addStage');
    const stage = t.commands.addStage('semi', 'Mental');
    const pendingStage = t.snapshot().objectives.at(-1)?.id as string;
    const moved = t.commands.editTask('p1', {
      title: 'Courir 5 km',
      objectiveId: pendingStage,
      importance: 4,
      urgency: 4,
    });
    await Promise.all([stage, moved]);
    expect(p1(t)?.objectiveId).toBe('endurance');
    expect(serverP1(t)?.objectiveId).toBe('endurance');
    expect(t.gateway.calls).not.toContain('editTask');
    expect(t.announcements.report$.get()).toBe(FAILURE_REPORTS.addStage);
  });
});

describe('la fin d’une session', () => {
  it('un geste qui attend dans la file ne part plus, et ne dit rien', async () => {
    const t = setup(seedSemi);
    await t.load();
    t.gateway.hold();
    const inFlight = t.commands.setTaskDone('p1', true);
    const waiting = t.commands.createObjective({ title: 'Projet de la session fermée' });
    await flush();
    t.writes.close();
    t.commands.forget();
    await t.gateway.release();
    expect(await waiting).toBeNull();
    await inFlight;
    expect(t.gateway.calls).toEqual(['list', 'setTaskDone']);
    expect(t.gateway.objectives.map((objective) => objective.title)).not.toContain(
      'Projet de la session fermée',
    );
    // La réponse arrivée après la fermeture ne réconcilie rien et ne s'annonce pas.
    expect(t.announcer.said).toEqual([]);
    expect(t.announcements.report$.get()).toBeNull();
  });

  it('un chargement qui attend son tour à la fermeture rend « plus de session »', async () => {
    const t = setup(seedSemi);
    await t.load();
    t.gateway.hold();
    const inFlight = t.commands.setTaskDone('p1', true);
    const loading = t.loader.load();
    await flush();
    t.writes.close();
    await t.gateway.release();
    await inFlight;
    const result = await loading;
    expect(!result.success && result.error.code).toBe(CLIENT_ERRORS.signedOut);
    expect(t.gateway.calls.filter((call) => call === 'list')).toHaveLength(1);
  });

  it('une session suivante ne connaît pas les ids de la précédente', async () => {
    const t = setup(seedSemi);
    await t.load();
    t.writes.link('temp-id-x', 'o-9');
    t.writes.close();
    expect(t.writes.resolve('temp-id-x')).toBe('temp-id-x');
  });
});

describe('ObjectivesLoader', () => {
  it('garde au premier chargement ce qui est encore en cours de création', async () => {
    const t = setup(seedSemi);
    t.gateway.hold();
    const loading = t.load();
    const created = t.commands.createObjective({ title: 'Nouvel objectif' });
    await t.gateway.release();
    await Promise.all([loading, created]);
    expect(t.snapshot().loaded).toBe(true);
    expect(t.snapshot().objectives.map((objective) => objective.title)).toContain('Nouvel objectif');
    expect(t.snapshot().objectives.filter((objective) => objective.title === 'Nouvel objectif')).toHaveLength(
      1,
    );
  });

  it('un pas coché pendant un rechargement reste coché : la base est relue après son écriture', async () => {
    const t = setup(seedSemi);
    await t.load();
    t.gateway.hold();
    const reloading = t.load();
    const done = t.commands.setTaskDone('p1', true);
    await t.gateway.release();
    await Promise.all([reloading, done]);
    expect(t.snapshot().tasks.find((task) => task.id === 'p1')?.done).toBe(true);
    expect(t.gateway.calls.filter((call) => call === 'list')).toHaveLength(3);
  });

  it('un rechargement sans geste pendant sa lecture ne relit pas la base', async () => {
    const t = setup(seedSemi);
    await t.load();
    await t.load();
    expect(t.gateway.calls.filter((call) => call === 'list')).toHaveLength(2);
  });

  it("rend l'échec d'un chargement sans toucher à la copie", async () => {
    const t = setup(seedSemi);
    await t.load();
    t.gateway.failNext('list', 'NETWORK_UNREACHABLE');
    const result = await t.load();
    expect(result.success).toBe(false);
    expect(t.snapshot().objectives).toHaveLength(2);
  });

  it('deux chargements en même temps lisent chacun une fois : ils ne se relancent pas l’un l’autre', async () => {
    const t = setup(seedSemi);
    await t.load();
    const [first, second] = await Promise.all([t.loader.load(), t.loader.load()]);
    expect(first.success && second.success).toBe(true);
    expect(t.gateway.calls.filter((call) => call === 'list')).toHaveLength(3);
  });

  it('un chargement abandonné ne relit pas la base, même si un geste l’a dépassé', async () => {
    const t = setup(seedSemi);
    await t.load();
    const abandoned = new AbortController();
    t.gateway.hold();
    const loading = t.loader.load(abandoned.signal);
    const done = t.commands.setTaskDone('p1', true);
    abandoned.abort();
    await t.gateway.release();
    await Promise.all([loading, done]);
    expect(t.gateway.calls.filter((call) => call === 'list')).toHaveLength(2);
  });
});

describe('la voix des annonces et des signalements', () => {
  it('chaque phrase parle comme Empreinte, et aucun message technique ne passe', async () => {
    const t = setup(seedSemi);
    await t.load();
    await t.commands.setTaskDone('p1', true);
    await t.commands.addStage('semi', 'Mental');
    t.gateway.failNext('addTask', 'OBJECTIVE_NOT_FOUND');
    await t.commands.addTask('endurance', { title: 'Pas', importance: 3, urgency: 2 });
    for (const { text } of t.announcer.said) {
      expect(voiceIssues(text)).toEqual([]);
      expect(text).not.toMatch(/refusé \(test\)|Not found/);
    }
    expect(t.announcer.said.at(-1)?.text).toBe(FAILURE_REPORTS.objectiveNotFound);
  });
});

describe('effacer', () => {
  const ids = (items: readonly { readonly id: string }[]) => items.map((item) => item.id);

  function seedPlan(gateway: InMemoryObjectivesGateway) {
    seedSemi(gateway);
    gateway.seedObjective({ id: 'mental', title: 'Mental', parentId: 'semi' });
    gateway.seedTask({ id: 'p3', title: 'Visualiser la course', objectiveId: 'mental' });
  }

  it('un pas quitte l’écran tout de suite, puis la base ; les objectifs sont relus, sans rien annoncer', async () => {
    const t = setup(seedPlan);
    await t.load();
    t.gateway.hold();
    const erased = t.commands.deleteTask('p1');
    expect(ids(t.snapshot().tasks)).toEqual(['p2', 'p3']);
    expect(ids(t.gateway.tasks)).toContain('p1');
    await t.gateway.release();
    await erased;
    expect(ids(t.gateway.tasks)).toEqual(['p2', 'p3']);
    expect(t.onObjectivesChanged).toHaveBeenCalledTimes(1);
    expect(t.announcer.said).toEqual([]);
  });

  it('un pas qui n’est pas effacé revient à sa place, le dit, et le serveur est relu', async () => {
    const t = setup(seedPlan);
    await t.load();
    t.gateway.failNext('deleteTask', 'NETWORK_UNREACHABLE');
    await t.commands.deleteTask('p1');
    expect(ids(t.snapshot().tasks)).toEqual(['p1', 'p2', 'p3']);
    expect(t.announcements.report$.get()).toBe(FAILURE_REPORTS.eraseTask);
    // Le serveur dit ce qui est vrai : la réponse a pu se perdre après l'effacement.
    expect(t.onObjectivesChanged).toHaveBeenCalledTimes(1);
  });

  it('un pas déjà effacé ailleurs (introuvable) l’est : rien à signaler', async () => {
    const t = setup(seedPlan);
    await t.load();
    t.gateway.tasks = t.gateway.tasks.filter((task) => task.id !== 'p1');
    await t.commands.deleteTask('p1');
    expect(ids(t.snapshot().tasks)).toEqual(['p2', 'p3']);
    expect(t.announcements.report$.get()).toBeNull();
  });

  it('un pas qui n’est plus là n’est pas effacé deux fois', async () => {
    const t = setup(seedPlan);
    await t.load();
    await Promise.all([t.commands.deleteTask('p1'), t.commands.deleteTask('p1')]);
    await t.commands.deleteTask('inconnu');
    expect(t.gateway.calls.filter((call) => call === 'deleteTask')).toHaveLength(1);
  });

  it('cocher puis effacer hors connexion : le pas revient tel que le serveur l’a, non coché', async () => {
    const t = setup(seedPlan);
    await t.load();
    t.gateway.failNext('setTaskDone', 'NETWORK_UNREACHABLE');
    t.gateway.failNext('deleteTask', 'NETWORK_UNREACHABLE');
    await Promise.all([t.commands.setTaskDone('p1', true), t.commands.deleteTask('p1')]);
    expect(t.snapshot().tasks[0]).toMatchObject({ id: 'p1', done: false });
    expect(t.announcements.report$.get()).toBe(FAILURE_REPORTS.eraseTask);
  });

  it('un pas effacé pendant sa création part avec son id définitif', async () => {
    const t = setup(seedPlan);
    await t.load();
    const added = t.commands.addTask('endurance', { title: 'Étirements', importance: 3, urgency: 2 });
    const temporaryId = t.snapshot().tasks.at(-1)?.id as string;
    const erased = t.commands.deleteTask(temporaryId);
    await Promise.all([added, erased]);
    expect(t.gateway.calls.filter((call) => call !== 'list')).toEqual(['addTask', 'deleteTask']);
    expect(t.gateway.tasks.map((task) => task.title)).not.toContain('Étirements');
    expect(t.snapshot().tasks.map((task) => task.title)).not.toContain('Étirements');
  });

  it('un pas dont la création n’a pas abouti ne part pas en requête, et ne revient pas', async () => {
    const t = setup(seedPlan);
    await t.load();
    t.gateway.failNext('addTask');
    const added = t.commands.addTask('endurance', { title: 'Étirements', importance: 3, urgency: 2 });
    const temporaryId = t.snapshot().tasks.at(-1)?.id as string;
    await Promise.all([added, t.commands.deleteTask(temporaryId)]);
    expect(t.gateway.calls).not.toContain('deleteTask');
    expect(t.snapshot().tasks.map((task) => task.title)).not.toContain('Étirements');
    expect(t.announcements.report$.get()).toBe(FAILURE_REPORTS.addTask);
  });

  it('une étape part avec ses pas, s’annonce, et les objectifs sont relus', async () => {
    const t = setup(seedPlan);
    await t.load();
    t.gateway.hold();
    const erased = t.commands.deleteObjective('endurance');
    expect(ids(t.snapshot().objectives)).toEqual(['semi', 'mental']);
    expect(ids(t.snapshot().tasks)).toEqual(['p3']);
    await t.gateway.release();
    await erased;
    expect(ids(t.gateway.objectives)).toEqual(['semi', 'mental']);
    expect(ids(t.gateway.tasks)).toEqual(['p3']);
    expect(t.announcer.said.map((item) => item.text)).toEqual([SUCCESS_ANNOUNCEMENTS.stageErased]);
    expect(t.onObjectivesChanged).toHaveBeenCalledTimes(1);
  });

  it('une étape qui n’est pas effacée revient à sa place, avec ses pas', async () => {
    const t = setup(seedPlan);
    await t.load();
    t.gateway.failNext('deleteObjective', 'UNKNOWN_ERROR');
    await t.commands.deleteObjective('endurance');
    expect(ids(t.snapshot().objectives)).toEqual(['semi', 'endurance', 'mental']);
    expect(ids(t.snapshot().tasks)).toEqual(['p1', 'p2', 'p3']);
    expect(t.announcements.report$.get()).toBe(FAILURE_REPORTS.eraseStage);
    expect(t.onObjectivesChanged).toHaveBeenCalledTimes(1);
  });

  it('un objectif part avec ses étapes et leurs pas, s’annonce, sans relire', async () => {
    const t = setup((gateway) => {
      seedPlan(gateway);
      gateway.seedObjective({ id: 'piano', title: 'Apprendre le piano' });
    });
    await t.load();
    await t.commands.deleteObjective('semi');
    expect(ids(t.snapshot().objectives)).toEqual(['piano']);
    expect(t.snapshot().tasks).toEqual([]);
    expect(ids(t.gateway.objectives)).toEqual(['piano']);
    expect(t.gateway.tasks).toEqual([]);
    expect(t.announcer.said.map((item) => item.text)).toEqual([SUCCESS_ANNOUNCEMENTS.objectiveErased]);
    expect(t.onObjectivesChanged).not.toHaveBeenCalled();
  });

  it('un objectif qui n’est pas effacé revient parmi tes objectifs', async () => {
    const t = setup((gateway) => {
      seedPlan(gateway);
      gateway.seedObjective({ id: 'piano', title: 'Apprendre le piano' });
    });
    await t.load();
    t.gateway.failNext('deleteObjective', 'NETWORK_UNREACHABLE');
    await t.commands.deleteObjective('semi');
    expect(ids(t.snapshot().objectives)).toEqual(['semi', 'endurance', 'mental', 'piano']);
    expect(ids(t.snapshot().tasks)).toEqual(['p1', 'p2', 'p3']);
    expect(t.announcements.report$.get()).toBe(FAILURE_REPORTS.eraseObjective);
  });

  it('un objectif déjà effacé ailleurs (introuvable) quitte l’écran sans rien signaler', async () => {
    const t = setup(seedPlan);
    await t.load();
    t.gateway.objectives = [];
    t.gateway.tasks = [];
    await t.commands.deleteObjective('semi');
    expect(t.snapshot().objectives).toEqual([]);
    expect(t.announcements.report$.get()).toBeNull();
  });

  it('une étape renommée puis effacée, les deux refusés : elle revient avec le nom que le serveur a', async () => {
    const t = setup(seedPlan);
    await t.load();
    t.gateway.failNext('editObjective');
    t.gateway.failNext('deleteObjective');
    await Promise.all([
      t.commands.editObjective('endurance', { title: 'Fond' }),
      t.commands.deleteObjective('endurance'),
    ]);
    expect(t.snapshot().objectives.find((objective) => objective.id === 'endurance')?.title).toBe(
      'Endurance',
    );
  });

  it('un pas ajouté à une étape effacée juste après part avec elle', async () => {
    const t = setup(seedPlan);
    await t.load();
    await Promise.all([
      t.commands.addTask('endurance', { title: 'Fractionné', importance: 3, urgency: 2 }),
      t.commands.deleteObjective('endurance'),
    ]);
    expect(t.gateway.tasks.map((task) => task.title)).toEqual(['Visualiser la course']);
    expect(t.snapshot().tasks.map((task) => task.title)).toEqual(['Visualiser la course']);
  });

  it('un rechargement pendant l’effacement ne ramène pas ce qui part', async () => {
    const t = setup(seedPlan);
    await t.load();
    t.gateway.hold();
    const reloading = t.load();
    const erased = t.commands.deleteObjective('endurance');
    await t.gateway.release();
    await Promise.all([reloading, erased]);
    expect(ids(t.snapshot().objectives)).toEqual(['semi', 'mental']);
    expect(ids(t.snapshot().tasks)).toEqual(['p3']);
  });

  it('un pas refusé, son étape effacée pendant qu’il partait : il part avec elle, sans rien signaler', async () => {
    const t = setup(seedPlan);
    await t.load();
    t.gateway.failNext('deleteTask', 'NETWORK_UNREACHABLE');
    await Promise.all([t.commands.deleteTask('p1'), t.commands.deleteObjective('endurance')]);
    expect(t.snapshot().tasks.map((task) => task.id)).toEqual(['p3']);
    expect(ids(t.gateway.objectives)).toEqual(['semi', 'mental']);
    expect(t.announcements.report$.get()).toBeNull();
  });

  it('un pas et son étape, tous deux refusés : l’étape revient avec ce pas, et une seule note le dit', async () => {
    const t = setup(seedPlan);
    await t.load();
    t.gateway.failNext('deleteTask', 'NETWORK_UNREACHABLE');
    t.gateway.failNext('deleteObjective', 'NETWORK_UNREACHABLE');
    await Promise.all([t.commands.deleteTask('p1'), t.commands.deleteObjective('endurance')]);
    expect(ids(t.snapshot().objectives)).toEqual(['semi', 'endurance', 'mental']);
    expect(ids(t.snapshot().tasks)).toEqual(['p1', 'p2', 'p3']);
    expect(t.announcer.said.map((item) => item.text)).toEqual([FAILURE_REPORTS.eraseStage]);
  });

  it('une étape et son objectif, tous deux refusés : l’objectif revient avec son étape et ses pas', async () => {
    const t = setup(seedPlan);
    await t.load();
    t.gateway.failNext('deleteObjective', 'NETWORK_UNREACHABLE');
    t.gateway.failNext('deleteObjective', 'NETWORK_UNREACHABLE');
    await Promise.all([t.commands.deleteObjective('endurance'), t.commands.deleteObjective('semi')]);
    expect(ids(t.snapshot().objectives)).toEqual(['semi', 'endurance', 'mental']);
    expect(ids(t.snapshot().tasks)).toEqual(['p1', 'p2', 'p3']);
    expect(t.announcer.said.map((item) => item.text)).toEqual([FAILURE_REPORTS.eraseObjective]);
  });

  it('un pas coché, puis son étape effacée, les deux refusés : le pas revient non coché', async () => {
    const t = setup(seedPlan);
    await t.load();
    t.gateway.failNext('setTaskDone', 'NETWORK_UNREACHABLE');
    t.gateway.failNext('deleteObjective', 'NETWORK_UNREACHABLE');
    await Promise.all([t.commands.setTaskDone('p2', true), t.commands.deleteObjective('endurance')]);
    expect(t.snapshot().tasks.find((task) => task.id === 'p2')?.done).toBe(false);
  });

  it('chaque phrase de l’effacement parle comme Empreinte', () => {
    for (const text of [
      SUCCESS_ANNOUNCEMENTS.stageErased,
      SUCCESS_ANNOUNCEMENTS.objectiveErased,
      FAILURE_REPORTS.eraseTask,
      FAILURE_REPORTS.eraseStage,
      FAILURE_REPORTS.eraseObjective,
    ]) {
      expect(voiceIssues(text)).toEqual([]);
    }
  });
});
