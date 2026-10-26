/*
 * Le résultat d'une opération qui peut ne pas aboutir, comme `Result<T>` d'Apex et d'Apex Brain :
 * `{ success: true, data }` ou `{ success: false, error }`. Le `code` de l'erreur est le contrat (on choisit
 * la phrase à dire d'après lui) ; son `message` est technique et ne se montre jamais.
 */

/** Un champ refusé par le serveur (`VALIDATION_ERROR`). */
export type FieldIssue = {
  readonly path: string;
  readonly message: string;
};

export type Failure = {
  /** Le code stable : `TASK_NOT_FOUND`, `INVALID_CREDENTIALS`, `NETWORK_UNREACHABLE`… */
  readonly code: string;
  /** Le message technique, pour les journaux : jamais à afficher. */
  readonly message: string;
  /** Le statut HTTP de la réponse, quand il y en a une. */
  readonly status?: number;
  readonly details?: readonly FieldIssue[];
};

export type Result<T> =
  { readonly success: true; readonly data: T } | { readonly success: false; readonly error: Failure };

/** Les codes posés par le client lui-même, quand le serveur n'a rien pu répondre. */
export const CLIENT_ERRORS = {
  /** Aucune réponse : pas de réseau, serveur injoignable. */
  unreachable: 'NETWORK_UNREACHABLE',
  /** Le serveur a mis trop de temps à répondre. */
  timeout: 'TIMEOUT',
  /** Une réponse que le client ne sait pas lire. */
  unreadable: 'UNREADABLE_RESPONSE',
  /** Plus de session : il faut se reconnecter. */
  signedOut: 'SIGNED_OUT',
} as const;

/** Le code d'une panne inattendue, comme dans Apex Brain. */
export const UNKNOWN_ERROR = 'UNKNOWN_ERROR';

export function ok<T>(data: T): Result<T> {
  return { success: true, data };
}

export function fail<T = never>(failure: Failure): Result<T> {
  return { success: false, error: failure };
}

/** Une panne due au réseau (rien n'est parti, ou rien n'est revenu) : réessayer plus tard a un sens. */
export function isConnectivityFailure(failure: Failure): boolean {
  return failure.code === CLIENT_ERRORS.unreachable || failure.code === CLIENT_ERRORS.timeout;
}

/** L'erreur levée quand un résultat en échec doit passer par une API qui attend une exception (TanStack Query). */
export class FailureError extends Error {
  constructor(readonly failure: Failure) {
    super(`${failure.code}: ${failure.message}`);
    this.name = 'FailureError';
  }
}

/** Les données d'un résultat réussi, sinon une `FailureError`. */
export function unwrap<T>(result: Result<T>): T {
  if (result.success) return result.data;
  throw new FailureError(result.error);
}
