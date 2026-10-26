import createClient, { type Client } from 'openapi-fetch';
import {
  CLIENT_ERRORS,
  UNKNOWN_ERROR,
  fail,
  ok,
  type Failure,
  type FieldIssue,
  type Result,
} from '@/domain/shared/result';
import type { AccessTokenProvider } from '@/application/ports/auth-gateway';
import type { paths } from '../apex-brain/schema';

/*
 * Le client HTTP d'Apex Brain : typé par le contrat OpenAPI (`openapi/apex-brain.openapi.json`, types générés
 * dans `apex-brain/schema.d.ts`), avec la session. Chaque requête porte un jeton valide ; un `401` renouvelle la
 * session une fois et rejoue la requête. Une réponse en erreur devient un `Failure` dont le code est celui
 * d'Apex Brain (`{ error: { code, message, details } }`) ; sans réponse, `NETWORK_UNREACHABLE` ou `TIMEOUT`.
 */

export type ApexClient = Client<paths>;

/** Le délai au-delà duquel une requête est abandonnée. */
export const REQUEST_TIMEOUT_MS = 15_000;

export type ApexClientOptions = {
  readonly baseUrl: string;
  /** La session ; sans elle, le client est public (connexion, inscription, renouvellement). */
  readonly tokens?: AccessTokenProvider;
  readonly timeoutMs?: number;
  /** Le `fetch` à utiliser (celui de la plateforme par défaut). */
  readonly fetch?: (request: Request) => Promise<Response>;
};

/** La requête n'est pas partie : il n'y a plus de session. */
class SignedOutError extends Error {
  constructor() {
    super('No session: request not sent');
    this.name = 'SignedOutError';
  }
}

/** La requête a dépassé son délai. */
class TimeoutError extends Error {
  constructor() {
    super('Request timed out');
    this.name = 'TimeoutError';
  }
}

export function createApexClient(options: ApexClientOptions): ApexClient {
  const transport = options.fetch ?? ((request: Request) => fetch(request));
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;

  const sendOnce = async (request: Request): Promise<Response> => {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    try {
      return await transport(new Request(request, { signal: controller.signal }));
    } catch (error) {
      throw timedOut ? new TimeoutError() : error;
    } finally {
      clearTimeout(timer);
    }
  };

  const withToken = (request: Request, token: string): Request => {
    const authorized = new Request(request);
    authorized.headers.set('Authorization', `Bearer ${token}`);
    return authorized;
  };

  const send = async (request: Request): Promise<Response> => {
    const { tokens } = options;
    if (!tokens) return sendOnce(request);
    const token = await tokens.accessToken();
    if (!token) throw new SignedOutError();
    // Gardée pour rejouer la requête : son corps ne se lit qu'une fois.
    const replay = request.clone();
    const response = await sendOnce(withToken(request, token));
    if (response.status !== 401) return response;
    const renewed = await tokens.renewAfterRejection(token);
    if (!renewed) return response;
    return sendOnce(withToken(replay, renewed));
  };

  return createClient<paths>({ baseUrl: options.baseUrl, fetch: send });
}

type Call<T> = Promise<{ data?: T; error?: unknown; response: Response }>;

/**
 * Le résultat d'un appel d'openapi-fetch : ses données, ou le `Failure` de l'erreur rendue par Apex Brain. Une
 * exception (pas de réseau, délai dépassé, plus de session) devient un échec, jamais une exception.
 */
export async function toResult<T>(call: Call<T>): Promise<Result<T>> {
  try {
    const { data, error, response } = await call;
    if (response.ok) return ok(data as T);
    return fail(failureOf(response.status, error));
  } catch (cause) {
    return fail(failureOfException(cause));
  }
}

/** Comme `toResult`, en ne gardant que ce que `map` tire des données. */
export async function mapResult<T, U>(call: Call<T>, map: (data: T) => U): Promise<Result<U>> {
  const result = await toResult(call);
  return result.success ? ok(map(result.data)) : result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Le `Failure` d'une réponse en erreur : `{ error: { code, message, details? } }`, ou un code de repli. */
export function failureOf(status: number, body: unknown): Failure {
  const error = isRecord(body) && isRecord(body['error']) ? body['error'] : null;
  const code =
    typeof error?.['code'] === 'string'
      ? error['code']
      : status >= 500
        ? UNKNOWN_ERROR
        : CLIENT_ERRORS.unreadable;
  const message = typeof error?.['message'] === 'string' ? error['message'] : `HTTP ${status}`;
  const details = Array.isArray(error?.['details'])
    ? (error['details'] as unknown[]).filter(
        (detail): detail is FieldIssue =>
          isRecord(detail) && typeof detail['path'] === 'string' && typeof detail['message'] === 'string',
      )
    : undefined;
  return { code, message, status, ...(details && details.length > 0 ? { details } : {}) };
}

function failureOfException(cause: unknown): Failure {
  const message = cause instanceof Error ? cause.message : String(cause);
  if (cause instanceof SignedOutError) return { code: CLIENT_ERRORS.signedOut, message };
  if (cause instanceof TimeoutError) return { code: CLIENT_ERRORS.timeout, message };
  return { code: CLIENT_ERRORS.unreachable, message };
}
