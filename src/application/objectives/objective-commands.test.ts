import { QUADRANTS } from '@empreinte-studio/noyau';
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
  const commands = new ObjectiveCommands({
    gateway,
    cache,
    writes,
    announcements,
    ids: createTemporaryIds(),
  });
  const loader = new ObjectivesLoader({ gateway, writes, cache });
  const load = async () => {
    const result = await loader.load();
    if (result.success) cache.snapshot = result.data;
    return result;
  };
  const snapshot = (): ObjectivesSnapshot => cache.read() as ObjectivesSnapshot;
  return { gateway, cache, writes, announcer, announcements, commands, loader, load, snapshot };
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

  it('deux déplacements refusés : le pas reste dans son quadrant', async () => {
    const t = setup(seedSemi);
    await t.load();
    t.gateway.failNext('editTask');
    t.gateway.failNext('editTask');
    await Promise.all([
      t.commands.moveTaskToQuadrant('p1', 'planifier'),
      t.commands.moveTaskToQuadrant('p1', 'laisser-filer'),
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

  it('une modification refusée n’est pas enregistrée au passage par un déplacement accepté', async () => {
    const t = setup(seedSemi);
    await t.load();
    t.gateway.failNext('editTask');
    const renamed = t.commands.editTask('p1', {
      title: 'Courir 6 km',
      objectiveId: 'endurance',
      importance: 4,
      urgency: 4,
    });
    const moved = t.commands.moveTaskToQuadrant('p1', 'planifier');
    await Promise.all([renamed, moved]);
    expect(serverP1(t)).toMatchObject({ title: 'Courir 5 km', importance: 4, urgency: 2 });
    expect(p1(t)).toMatchObject({ title: 'Courir 5 km', importance: 4, urgency: 2 });
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

describe('déplacer un pas vers un quadrant : les 16 cas, niveaux de 1 à 5', () => {
  it('arrive toujours dans le quadrant demandé, et revient en arrière si l’enregistrement n’aboutit pas', async () => {
    for (const from of QUADRANTS) {
      for (const to of QUADRANTS) {
        const levels = { maintenant: [4, 4], planifier: [4, 1], confier: [1, 4], 'laisser-filer': [1, 1] }[
          from
        ];
        const t = setup((gateway) => {
          gateway.seedObjective({ id: 'o', title: 'O' });
          gateway.seedTask({
            id: 'p',
            title: 'P',
            objectiveId: 'o',
            importance: levels[0],
            urgency: levels[1],
          });
        });
        await t.load();
        await t.commands.moveTaskToQuadrant('p', to);
        const task = t.snapshot().tasks[0];
        expect(task && quadrantOf(task)).toBe(to);
        if (from === to) expect(t.gateway.calls).not.toContain('editTask');
        else {
          expect(t.announcer.said.at(-1)?.text).toContain('Ce pas passe dans');
          t.gateway.failNext('editTask');
          await t.commands.moveTaskToQuadrant('p', from);
          expect(quadrantOf(t.snapshot().tasks[0] as never)).toBe(to);
        }
      }
    }
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
