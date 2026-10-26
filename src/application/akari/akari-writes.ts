import { isExecutingTool } from '@/domain/akari/assistant';
import type { AssistantGateway } from '../ports/assistant-gateway';
import { SYSTEM_TIMERS, type Timers } from '../ports/platform';

/** L'intervalle d'interrogation du workflow (le serveur ne pousse rien). */
export const AKARI_POLL_INTERVAL_MS = 1000;

/** Au-delà, on cesse d'attendre l'outil : le prochain chargement des objectifs montrera l'ajout. */
const MAX_POLLS = 120;

/**
 * Ce qu'Akari ajoute avec l'accord de la personne (une étape, un pas) arrive sur l'arête au fil des ajouts
 * (cahier de migration d'Apex, § 5), comme `AkariWritesStore` du client web : il survit au départ de l'écran
 * Akari. À l'accord sur un outil d'écriture, le workflow passe à l'exécution de l'outil ; dès qu'il en sort,
 * l'écriture est faite et les objectifs sont rechargés, une fois.
 */
export class AkariWritesWatcher {
  private readonly watched = new Map<string, unknown>();

  constructor(
    private readonly deps: {
      readonly assistant: AssistantGateway;
      /** Les objectifs ont changé côté serveur : à recharger. */
      readonly onObjectivesChanged: () => void;
      readonly timers?: Timers;
      readonly intervalMs?: number;
    },
  ) {}

  /** Recharge les objectifs dès que l'outil accepté sur cet objectif a fini de s'exécuter. */
  watch(objectiveId: string): void {
    this.stopWatching(objectiveId);
    this.poll(objectiveId, 0);
  }

  /** Arrête tout (à la fin d'une session). */
  stop(): void {
    for (const objectiveId of [...this.watched.keys()]) this.stopWatching(objectiveId);
  }

  private poll(objectiveId: string, attempt: number): void {
    const timers = this.deps.timers ?? SYSTEM_TIMERS;
    const handle = timers.setTimeout(
      () => {
        void this.check(objectiveId, attempt);
      },
      attempt === 0 ? 0 : (this.deps.intervalMs ?? AKARI_POLL_INTERVAL_MS),
    );
    this.watched.set(objectiveId, handle);
  }

  private async check(objectiveId: string, attempt: number): Promise<void> {
    if (!this.watched.has(objectiveId)) return;
    const state = await this.deps.assistant.getState(objectiveId);
    if (!this.watched.has(objectiveId)) return;
    const executing = state.success && isExecutingTool(state.data.value);
    if (executing && attempt < MAX_POLLS) {
      this.poll(objectiveId, attempt + 1);
      return;
    }
    this.watched.delete(objectiveId);
    this.deps.onObjectivesChanged();
  }

  private stopWatching(objectiveId: string): void {
    const handle = this.watched.get(objectiveId);
    if (handle !== undefined) (this.deps.timers ?? SYSTEM_TIMERS).clearTimeout(handle);
    this.watched.delete(objectiveId);
  }
}
