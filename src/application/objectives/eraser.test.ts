import type { ObjectivesSnapshot } from '@/domain/objectives/objective';
import { InMemoryCache, RecordingAnnouncer } from '@/testing/fakes';
import { InMemoryObjectivesGateway, flush } from '@/testing/in-memory-objectives-gateway';
import { AnnouncementCenter } from '../announcements/announcement-center';
import { Eraser } from './eraser';
import { ObjectiveCommands } from './objective-commands';
import { createTemporaryIds } from './objectives-cache';
import { ObjectivesLoader } from './objectives-loader';
import { WriteQueue } from './write-queue';

/*
 * Effacer, sur un Apex Brain en mémoire : un pas que l'arête montre laisse sa trace, il ne part qu'à sa fin ;
 * sinon il part tout de suite. Une trace à la fois : tout nouvel effacement fait d'abord partir le pas en attente.
 */

async function setup() {
  const gateway = new InMemoryObjectivesGateway();
  gateway.seedObjective({ id: 'semi', title: 'Courir un semi-marathon' });
  gateway.seedObjective({ id: 'endurance', title: 'Endurance', parentId: 'semi' });
  gateway.seedObjective({ id: 'mental', title: 'Mental', parentId: 'semi' });
  gateway.seedTask({ id: 'p1', title: 'Courir 5 km', objectiveId: 'endurance' });
  gateway.seedTask({ id: 'p2', title: 'Courir 8 km', objectiveId: 'endurance' });
  gateway.seedTask({ id: 'p3', title: 'Visualiser la course', objectiveId: 'mental' });
  const cache = new InMemoryCache();
  const writes = new WriteQueue();
  const commands = new ObjectiveCommands({
    gateway,
    cache,
    writes,
    announcements: new AnnouncementCenter(new RecordingAnnouncer()),
    ids: createTemporaryIds(),
    onObjectivesChanged: () => undefined,
  });
  const loaded = await new ObjectivesLoader({ gateway, writes, cache }).load();
  if (loaded.success) cache.snapshot = loaded.data;
  const eraser = new Eraser(commands);
  const onScreen = () => (cache.read() as ObjectivesSnapshot).tasks.map((task) => task.id);
  const onServer = () => gateway.tasks.map((task) => task.id);
  const erasedOnServer = () => gateway.calls.filter((call) => call.startsWith('delete'));
  return { gateway, eraser, onScreen, onServer, erasedOnServer };
}

describe('Eraser', () => {
  it('un pas que l’arête montre laisse sa trace ; il ne part de la base qu’à sa fin', async () => {
    const t = await setup();
    t.eraser.showing(['p1', 'p2']);
    await t.eraser.eraseStep('p1');
    expect(t.eraser.erasing$.get()).toBe('p1');
    expect(t.onServer()).toContain('p1');

    t.eraser.expire('p1');
    await flush();
    expect(t.eraser.erasing$.get()).toBeNull();
    expect(t.onServer()).not.toContain('p1');
    expect(t.onScreen()).not.toContain('p1');
  });

  it('« Remettre » : le pas reste, et sa trace qui part ne l’efface pas', async () => {
    const t = await setup();
    t.eraser.showing(['p1']);
    await t.eraser.eraseStep('p1');
    t.eraser.putBack('p1');
    t.eraser.expire('p1');
    await flush();
    expect(t.eraser.erasing$.get()).toBeNull();
    expect(t.erasedOnServer()).toEqual([]);
  });

  it('un pas que rien ne montre part tout de suite, sans trace', async () => {
    const t = await setup();
    await t.eraser.eraseStep('p1');
    expect(t.eraser.erasing$.get()).toBeNull();
    expect(t.onServer()).not.toContain('p1');
  });

  it('une trace à la fois : un autre pas effacé fait partir celui qui attendait, une seule fois', async () => {
    const t = await setup();
    t.eraser.showing(['p1', 'p2']);
    await t.eraser.eraseStep('p1');
    await t.eraser.eraseStep('p2');
    expect(t.eraser.erasing$.get()).toBe('p2');
    await flush();
    expect(t.onServer()).toEqual(['p2', 'p3']);
    // La trace remplacée le redit en quittant l'écran : rien ne part une seconde fois.
    t.eraser.expire('p1');
    t.eraser.putBack('p1');
    await flush();
    expect(t.erasedOnServer()).toEqual(['deleteTask']);
  });

  it('le pas qui attendait quitte la copie avant que la trace change : l’écran ne le voit jamais revenir', async () => {
    const t = await setup();
    t.eraser.showing(['p1', 'p2']);
    await t.eraser.eraseStep('p1');
    const seen: { erasing: string | null; onScreen: string[] }[] = [];
    t.eraser.erasing$.subscribe(() =>
      seen.push({ erasing: t.eraser.erasing$.get(), onScreen: t.onScreen() }),
    );
    await t.eraser.eraseStep('p2');
    expect(seen).toEqual([{ erasing: 'p2', onScreen: ['p2', 'p3'] }]);
  });

  it('un pas que rien ne montre, effacé tout de suite, fait d’abord partir le pas en attente', async () => {
    const t = await setup();
    t.eraser.showing(['p1', 'p2']);
    await t.eraser.eraseStep('p1');
    await t.eraser.eraseStep('p3');
    await flush();
    expect(t.eraser.erasing$.get()).toBeNull();
    expect(t.onServer()).toEqual(['p2']);
  });

  it('une étape effacée fait d’abord partir le pas en attente', async () => {
    const t = await setup();
    t.eraser.showing(['p1', 'p2']);
    await t.eraser.eraseStep('p1');
    await t.eraser.eraseObjective('mental');
    expect(t.erasedOnServer()).toEqual(['deleteTask', 'deleteObjective']);
    expect(t.eraser.erasing$.get()).toBeNull();
    expect(t.onServer()).toEqual(['p2']);
  });

  it('une étape refusée revient sans le pas en attente, parti pour de bon avant elle', async () => {
    const t = await setup();
    t.eraser.showing(['p1', 'p2']);
    await t.eraser.eraseStep('p1');
    t.gateway.failNext('deleteObjective', 'NETWORK_UNREACHABLE');
    await t.eraser.eraseObjective('endurance');
    expect(t.onServer()).toEqual(['p2', 'p3']);
    expect(t.onScreen()).toEqual(['p2', 'p3']);
  });

  it('l’arête qui se ferme ne cache pas la suivante', async () => {
    const t = await setup();
    const hide = t.eraser.showing(['p1']);
    const hideNext = t.eraser.showing(['p2']);
    hide();
    await t.eraser.eraseStep('p2');
    expect(t.eraser.erasing$.get()).toBe('p2');
    hideNext();
    await t.eraser.eraseStep('p1');
    // p1 n'est plus montré : il part tout de suite, et p2, qui attendait, d'abord.
    await flush();
    expect(t.onServer()).toEqual(['p3']);
  });

  it('la fin d’une session oublie la trace et ce que l’arête montrait', async () => {
    const t = await setup();
    t.eraser.showing(['p1']);
    await t.eraser.eraseStep('p1');
    t.eraser.clear();
    t.eraser.expire('p1');
    await flush();
    expect(t.eraser.erasing$.get()).toBeNull();
    expect(t.erasedOnServer()).toEqual([]);
  });
});
