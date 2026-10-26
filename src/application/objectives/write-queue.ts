/** L'opération venait d'une session fermée depuis : elle n'est pas partie. */
export class SessionClosedError extends Error {
  constructor() {
    super('Session closed: operation not sent');
    this.name = 'SessionClosedError';
  }
}

/**
 * La file des écritures, reprise du client web (`write-queue.ts`).
 *
 * - Les écritures partent une par une, dans l'ordre des gestes : les cas d'usage d'Apex Brain relisent puis
 *   réenregistrent un objectif entier, deux écritures simultanées pourraient s'écraser en base.
 * - Aucune réponse n'est perdue : chaque geste reçoit la sienne (id définitif, retour en arrière, annonce).
 * - Un geste fait sur un élément optimiste (id temporaire) part avec l'id définitif : sa création passe avant
 *   lui dans la file, et `link()` retient la correspondance que `resolve()` retrouve.
 * - Le chargement des objectifs y prend place lui aussi (`read()`) : il lit la base après les écritures déjà
 *   parties. Un geste fait pendant qu'il attend n'est écrit qu'après sa lecture : par `enqueued`, qui ne compte
 *   que les écritures, le chargement voit qu'un geste est passé derrière lui, et relit la base au lieu de
 *   l'effacer de l'écran.
 * - Chaque opération appartient à la session qui l'a mise en file : à la fermeture de la session (`close()`),
 *   ce qui attend encore ne part plus (`SessionClosedError`), jamais avec le jeton d'une autre personne.
 */
export class WriteQueue {
  private tail: Promise<unknown> = Promise.resolve();
  private realIds = new Map<string, string>();
  private writes = 0;
  private epoch = 0;

  /** Le nombre d'écritures mises dans la file depuis le début : il change à chaque `run()`, pas à `read()`. */
  get enqueued(): number {
    return this.writes;
  }

  /** La session de la file : elle change à chaque `close()`. */
  get session(): number {
    return this.epoch;
  }

  /** Lance une écriture après les opérations précédentes, qu'elles aient abouti ou non. */
  run<T>(operation: () => Promise<T>): Promise<T> {
    this.writes += 1;
    return this.enqueue(operation);
  }

  /** Lance une lecture à son tour, après les écritures déjà en file, sans la compter parmi elles. */
  read<T>(operation: () => Promise<T>): Promise<T> {
    return this.enqueue(operation);
  }

  /** Retient l'id définitif d'un élément créé avec un id temporaire. */
  link(temporaryId: string, realId: string): void {
    this.realIds.set(temporaryId, realId);
  }

  /** L'id définitif d'un élément s'il est connu, sinon l'id tel quel. */
  resolve(id: string): string {
    return this.realIds.get(id) ?? id;
  }

  /**
   * La session a pris fin : ce qui attend encore dans la file ne partira pas, les correspondances sont oubliées,
   * et la session suivante commence une file neuve (sans attendre ce qui est encore en route).
   */
  close(): void {
    this.epoch += 1;
    this.realIds = new Map();
    this.tail = Promise.resolve();
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const epoch = this.epoch;
    const result = this.tail.then(() => {
      if (epoch !== this.epoch) throw new SessionClosedError();
      return operation();
    });
    this.tail = result.catch(() => undefined);
    return result;
  }
}
