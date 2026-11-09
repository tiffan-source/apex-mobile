import { ObservableValue } from '../shared/observable-value';
import type { ObjectiveCommands } from './objective-commands';

/** Ce que l'`Eraser` demande au serveur : effacer pour de bon (retour en arrière et relecture compris). */
export type ServerErasing = Pick<ObjectiveCommands, 'deleteTask' | 'deleteObjective'>;

/**
 * Effacer (maquette « Effacer », `ETrace` d'Empreinte) : le seul chemin par lequel l'écran efface un pas, une étape
 * ou un objectif.
 *
 * Un pas effacé là où l'arête le montre laisse sa trace à sa place : c'est le pas en attente, parti de l'écran, pas
 * encore de la base. Il ne part qu'à la fin de sa trace (son délai passé, l'écran quitté, l'application en
 * arrière-plan) ; « Remettre » le rend à sa place. Si rien ne le montre (une feuille ouverte par un lien), rien ne
 * montrerait sa trace, ni ne la finirait : il part tout de suite.
 *
 * Une trace à la fois : tout nouvel effacement (un autre pas, une étape, un objectif) fait d'abord partir pour de
 * bon le pas en attente — avant que la trace change, pour que l'écran ne le voie jamais revenir, et avant
 * l'effacement de son étape, pour qu'il ne revienne pas avec elle si elle est refusée.
 */
export class Eraser {
  /** Le pas en attente, dont la trace est à l'écran, ou null. */
  readonly erasing$ = new ObservableValue<string | null>(null);

  /** Les pas que l'arête montre, là où une trace peut prendre leur place. */
  private shown: ReadonlySet<string> = new Set();

  constructor(private readonly server: ServerErasing) {}

  /**
   * Efface un pas : sa trace prend sa place si l'arête le montre, sinon il part tout de suite. Le pas en attente,
   * s'il y en a un autre, part d'abord pour de bon.
   */
  async eraseStep(taskId: string): Promise<void> {
    if (this.erasing$.get() === taskId) return;
    if (!this.shown.has(taskId)) {
      this.flush();
      await this.server.deleteTask(taskId);
      return;
    }
    const waiting = this.erasing$.get();
    if (waiting !== null) void this.server.deleteTask(waiting);
    this.erasing$.set(taskId);
  }

  /** Efface une étape ou un objectif (l'écran a déjà demandé la confirmation) ; le pas en attente part d'abord. */
  async eraseObjective(objectiveId: string): Promise<void> {
    this.flush();
    await this.server.deleteObjective(objectiveId);
  }

  /** « Remettre » : le pas en attente revient à sa place, il ne part pas. */
  putBack(taskId: string): void {
    if (this.erasing$.get() === taskId) this.erasing$.set(null);
  }

  /**
   * La trace est finie : le pas part pour de bon. Une trace remplacée le redit en quittant l'écran : son pas est déjà
   * parti (et, si son effacement a été refusé, il est revenu), rien n'est envoyé une seconde fois.
   */
  expire(taskId: string): void {
    if (this.erasing$.get() !== taskId) return;
    void this.server.deleteTask(taskId);
    this.erasing$.set(null);
  }

  /** L'arête montre ces pas ; rend de quoi dire qu'elle ne les montre plus (elle se ferme). */
  showing(taskIds: readonly string[]): () => void {
    const shown = new Set(taskIds);
    this.shown = shown;
    return () => {
      if (this.shown === shown) this.shown = new Set();
    };
  }

  /** La session a pris fin : la trace est oubliée, avec la copie qu'elle cachait. */
  clear(): void {
    this.erasing$.set(null);
    this.shown = new Set();
  }

  /** Le pas en attente part pour de bon, avant un autre effacement. */
  private flush(): void {
    const waiting = this.erasing$.get();
    if (waiting !== null) this.expire(waiting);
  }
}
