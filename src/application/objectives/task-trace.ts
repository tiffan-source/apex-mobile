import { ObservableValue } from '../shared/observable-value';

/**
 * Le pas qui vient d'être effacé, le temps de sa trace (maquette « Effacer », `ETrace` d'Empreinte) : il a quitté la
 * liste, sa trace dit « « Courir 8 km » est effacé. » à sa place et propose de le remettre. Il ne part de la base qu'à
 * la fin de la trace (son délai passé, l'écran quitté, l'application en arrière-plan) : `erase` l'efface alors pour
 * de bon (`ObjectiveCommands.deleteTask`).
 *
 * Une trace à la fois, comme dans la maquette : un autre pas effacé fait partir pour de bon celui qui attendait. La
 * trace vit ici, pas dans l'écran, parce que la feuille d'un pas l'efface aussi (« Effacer ce pas ») : l'arête,
 * dessous, montre alors sa trace.
 */
export class TaskTrace {
  /** Le pas dont la trace est à l'écran, ou null. */
  readonly erasing$ = new ObservableValue<string | null>(null);

  constructor(private readonly erase: (taskId: string) => void) {}

  /** Efface un pas : sa trace prend sa place. Celui qui attendait déjà, s'il y en avait un, part pour de bon. */
  start(taskId: string): void {
    const previous = this.erasing$.get();
    this.erasing$.set(taskId);
    if (previous !== null && previous !== taskId) this.erase(previous);
  }

  /** « Remettre » : le pas revient à sa place, il ne part pas. */
  putBack(taskId: string): void {
    if (this.erasing$.get() === taskId) this.erasing$.set(null);
  }

  /**
   * La trace est finie : le pas part pour de bon. La trace d'un pas déjà parti (remplacée par une autre) le redit
   * sans effet : un pas qui n'est plus là n'est pas effacé deux fois.
   */
  expire(taskId: string): void {
    if (this.erasing$.get() === taskId) this.erasing$.set(null);
    this.erase(taskId);
  }

  /** La session a pris fin : la trace est oubliée, avec la copie qu'elle cachait. */
  clear(): void {
    this.erasing$.set(null);
  }
}
