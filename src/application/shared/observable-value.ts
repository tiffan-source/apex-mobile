/**
 * Une valeur que l'on peut suivre : l'état d'un service de l'application, que la couche React lit avec
 * `useSyncExternalStore` sans que l'application connaisse React.
 */
export class ObservableValue<T> {
  private readonly listeners = new Set<() => void>();

  constructor(private value: T) {}

  get(): T {
    return this.value;
  }

  set(next: T): void {
    if (Object.is(next, this.value)) return;
    this.value = next;
    this.listeners.forEach((listener) => listener());
  }

  /** Prévient `listener` à chaque changement ; rend de quoi arrêter. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
}
