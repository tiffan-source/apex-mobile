import { ObservableValue } from '../shared/observable-value';

/**
 * Le pas qui vient d'être effacé, le temps de sa trace (maquette « Effacer », `ETrace` d'Empreinte) : il a quitté la
 * liste, sa trace dit « « Courir 8 km » est effacé. » à sa place et propose de le remettre. Il ne part de la base qu'à
 * la fin de la trace (son délai passé, l'écran quitté, l'application en arrière-plan) : `erase` l'efface alors pour
 * de bon (`ObjectiveCommands.deleteTask`).
 *
 * Une trace à la fois, comme dans la maquette : tout nouvel effacement (un autre pas, une étape, un objectif) fait
 * partir pour de bon le pas qui attendait. La trace vit ici, pas dans l'écran, parce que la feuille d'un pas l'efface
 * aussi (« Effacer ce pas ») : l'arête, dessous, montre alors sa trace — si elle montre ce pas (`showing`).
 */
export class TaskTrace {
  /** Le pas dont la trace est à l'écran, ou null. */
  readonly erasing$ = new ObservableValue<string | null>(null);

  /** Les pas que l'arête montre, là où une trace peut prendre leur place. */
  private shown: ReadonlySet<string> = new Set();

  constructor(private readonly erase: (taskId: string) => void) {}

  /**
   * Efface un pas : sa trace prend sa place. Le pas qui attendait déjà, s'il y en avait un, part pour de bon — avant
   * que la trace change, pour que l'écran ne le montre jamais revenir.
   */
  start(taskId: string): void {
    const previous = this.erasing$.get();
    if (previous !== null && previous !== taskId) this.erase(previous);
    this.erasing$.set(taskId);
  }

  /** « Remettre » : le pas revient à sa place, il ne part pas. */
  putBack(taskId: string): void {
    if (this.erasing$.get() === taskId) this.erasing$.set(null);
  }

  /**
   * La trace est finie : le pas part pour de bon. Une trace remplacée le redit en quittant l'écran : son pas est déjà
   * parti (et, si son effacement a été refusé, il est revenu), rien n'est envoyé une seconde fois.
   */
  expire(taskId: string): void {
    if (this.erasing$.get() !== taskId) return;
    this.erase(taskId);
    this.erasing$.set(null);
  }

  /** Un autre effacement commence (une étape, un objectif) : le pas qui attendait part d'abord. */
  flush(): void {
    const waiting = this.erasing$.get();
    if (waiting !== null) this.expire(waiting);
  }

  /** L'arête montre ces pas ; rend de quoi dire qu'elle ne les montre plus (elle se ferme). */
  showing(taskIds: readonly string[]): () => void {
    const shown = new Set(taskIds);
    this.shown = shown;
    return () => {
      if (this.shown === shown) this.shown = new Set();
    };
  }

  /** L'arête montre ce pas : sa trace peut y prendre sa place. Sinon, rien ne la montrerait, ni ne la finirait. */
  canShow(taskId: string): boolean {
    return this.shown.has(taskId);
  }

  /** La session a pris fin : la trace est oubliée, avec la copie qu'elle cachait. */
  clear(): void {
    this.erasing$.set(null);
    this.shown = new Set();
  }
}
