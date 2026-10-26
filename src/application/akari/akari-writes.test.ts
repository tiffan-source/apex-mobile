import { ScriptedAssistantGateway, readyState } from '@/testing/fakes';
import { flush } from '@/testing/in-memory-objectives-gateway';
import type { Timers } from '../ports/platform';
import { AnnouncementCenter } from '../announcements/announcement-center';
import { AkariWritesWatcher } from './akari-writes';

/** Une minuterie qu'on avance à la main. */
class ManualTimers implements Timers {
  private queue: { id: number; callback: () => void }[] = [];
  private sequence = 0;

  setTimeout(callback: () => void): unknown {
    this.sequence += 1;
    this.queue.push({ id: this.sequence, callback });
    return this.sequence;
  }

  clearTimeout(handle: unknown): void {
    this.queue = this.queue.filter((item) => item.id !== handle);
  }

  async tick(): Promise<void> {
    const due = this.queue;
    this.queue = [];
    due.forEach((item) => item.callback());
    await flush();
  }
}

const executing = (objectiveId: string) =>
  readyState(objectiveId, { value: { ExecutingAllTool: 'ExecutingTool' }, status: 'processing' });

describe('AkariWritesWatcher', () => {
  it("recharge les objectifs une fois l'outil exécuté, pas avant, et une seule fois", async () => {
    const assistant = new ScriptedAssistantGateway('o1');
    assistant.upcoming.push(executing('o1'), executing('o1'), readyState('o1'));
    const timers = new ManualTimers();
    const reload = jest.fn();
    const watcher = new AkariWritesWatcher({ assistant, onObjectivesChanged: reload, timers });

    watcher.watch('o1');
    await timers.tick();
    await timers.tick();
    expect(reload).not.toHaveBeenCalled();
    await timers.tick();
    expect(reload).toHaveBeenCalledTimes(1);
    await timers.tick();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('s’arrête avec la session', async () => {
    const assistant = new ScriptedAssistantGateway('o1');
    assistant.state = executing('o1');
    const timers = new ManualTimers();
    const reload = jest.fn();
    const watcher = new AkariWritesWatcher({ assistant, onObjectivesChanged: reload, timers });
    watcher.watch('o1');
    await timers.tick();
    watcher.stop();
    await timers.tick();
    expect(reload).not.toHaveBeenCalled();
  });
});

describe('AnnouncementCenter', () => {
  it('annonce une réussite sans rien garder, garde un signalement jusqu’à « Compris »', () => {
    const said: string[] = [];
    const center = new AnnouncementCenter({ announce: (text) => said.push(text) });
    center.announce('Étape ajoutée.');
    expect(center.report$.get()).toBeNull();
    center.report("Je n'ai pas pu ajouter cette étape. Vérifie ta connexion, puis réessaie.");
    center.report("Je n'ai pas pu ajouter cette étape. Vérifie ta connexion, puis réessaie.");
    expect(said).toHaveLength(2);
    center.acknowledge();
    expect(center.report$.get()).toBeNull();
    center.report('  ');
    expect(center.report$.get()).toBeNull();
  });
});
