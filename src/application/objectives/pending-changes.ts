/**
 * Ce que le serveur a accepté d'un élément (un pas, un objectif) tant que des gestes sur lui sont en route.
 *
 * Les écritures partent dans l'ordre des gestes. Au premier geste, l'écran montre ce qu'a le serveur : c'est
 * le point de départ. Chaque écriture qui aboutit y applique son changement ; une écriture refusée n'y change
 * rien. Quand le dernier geste en route sur l'élément est réglé, l'élément doit montrer ce point de départ
 * augmenté des seuls changements acceptés : jamais la valeur d'un geste refusé, même plus ancien que le
 * dernier. (Cocher puis décocher hors connexion ramène au pas tel qu'il était.)
 */
export class PendingChanges<T> {
  private items = new Map<string, { confirmed: T; pending: number }>();

  /** Un geste commence sur l'élément ; `shown` est ce que l'écran en montre juste avant. */
  begin(key: string, shown: T): void {
    const item = this.items.get(key);
    if (item) item.pending += 1;
    else this.items.set(key, { confirmed: shown, pending: 1 });
  }

  /** Ce que le serveur a de l'élément, d'après les gestes réglés ; undefined si aucun n'est en route. */
  confirmed(key: string): T | undefined {
    return this.items.get(key)?.confirmed;
  }

  /**
   * Le geste est réglé : accepté (`change` s'applique à ce qu'a le serveur) ou refusé (`null`). Rend ce que
   * l'élément doit montrer si c'était le dernier geste en route sur lui, sinon undefined.
   */
  settle(key: string, change: ((confirmed: T) => T) | null): T | undefined {
    const item = this.items.get(key);
    if (!item) return undefined;
    if (change) item.confirmed = change(item.confirmed);
    item.pending -= 1;
    if (item.pending > 0) return undefined;
    this.items.delete(key);
    return item.confirmed;
  }

  /** L'élément a reçu son id définitif : ses gestes en route le suivent. */
  rekey(from: string, to: string): void {
    const item = this.items.get(from);
    if (!item) return;
    this.items.delete(from);
    this.items.set(to, item);
  }

  /** Oublie tout (à la fin d'une session). */
  clear(): void {
    this.items = new Map();
  }
}
