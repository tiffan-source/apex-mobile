/**
 * La file des écritures, reprise du client web (`write-queue.ts`).
 *
 * - Les écritures partent une par une, dans l'ordre des gestes : les cas d'usage d'Apex Brain relisent puis
 *   réenregistrent un objectif entier, deux écritures simultanées pourraient s'écraser en base.
 * - Aucune réponse n'est perdue : chaque geste reçoit la sienne (id définitif, retour en arrière, annonce).
 * - Un geste fait sur un élément optimiste (id temporaire) part avec l'id définitif : sa création passe avant
 *   lui dans la file, et `link()` retient la correspondance que `resolve()` retrouve.
 * - Le chargement des objectifs y prend place lui aussi : il lit la base après les écritures déjà parties. Un
 *   geste fait pendant qu'il attend n'est écrit qu'après sa lecture : par `enqueued`, le chargement voit qu'un
 *   geste est passé derrière lui, et relit la base au lieu de l'effacer de l'écran.
 */
export class WriteQueue {
  private tail: Promise<unknown> = Promise.resolve();
  private readonly realIds = new Map<string, string>();
  private count = 0;

  /** Le nombre d'écritures (et de lectures) mises dans la file depuis le début : il change à chaque `run()`. */
  get enqueued(): number {
    return this.count;
  }

  /** Lance l'opération après les précédentes, qu'elles aient abouti ou non. */
  run<T>(operation: () => Promise<T>): Promise<T> {
    this.count += 1;
    const result = this.tail.then(() => operation());
    this.tail = result.catch(() => undefined);
    return result;
  }

  /** Retient l'id définitif d'un élément créé avec un id temporaire. */
  link(temporaryId: string, realId: string): void {
    this.realIds.set(temporaryId, realId);
  }

  /** L'id définitif d'un élément s'il est connu, sinon l'id tel quel. */
  resolve(id: string): string {
    return this.realIds.get(id) ?? id;
  }

  /** Oublie les correspondances (à la fin d'une session). */
  forget(): void {
    this.realIds.clear();
  }
}
