import type { PreferenceTheme } from '@empreinte-studio/noyau';
import type { ConversationMessage, ToolCall, WorkflowState } from '@/domain/akari/assistant';
import type { ObjectivesSnapshot } from '@/domain/objectives/objective';
import { EMPTY_SNAPSHOT } from '@/domain/objectives/objective';
import { fail, ok, type Result } from '@/domain/shared/result';
import type { Session, User } from '@/domain/session/user';
import type { ObjectivesCache } from '@/application/objectives/objectives-cache';
import type { AssistantGateway, Conversation } from '@/application/ports/assistant-gateway';
import type { AuthGateway, Credentials, Registered, SignedIn } from '@/application/ports/auth-gateway';
import type {
  Announcer,
  Clock,
  PreferencesStore,
  StoredSession,
  TokenStore,
} from '@/application/ports/platform';
import { flush } from './in-memory-objectives-gateway';

/* Des doublures en mémoire pour les tests : elles suivent les règles de leurs adaptateurs. */

export class InMemoryCache implements ObjectivesCache {
  snapshot: ObjectivesSnapshot | undefined;

  constructor(initial?: ObjectivesSnapshot) {
    this.snapshot = initial;
  }

  read(): ObjectivesSnapshot | undefined {
    return this.snapshot;
  }

  update(change: (snapshot: ObjectivesSnapshot) => ObjectivesSnapshot): void {
    this.snapshot = change(this.snapshot ?? EMPTY_SNAPSHOT);
  }
}

export class RecordingAnnouncer implements Announcer {
  readonly said: { text: string; politeness: 'polite' | 'assertive' }[] = [];

  announce(text: string, politeness: 'polite' | 'assertive' = 'polite'): void {
    this.said.push({ text, politeness });
  }
}

export class FakeClock implements Clock {
  constructor(public time = Date.parse('2026-10-25T20:00:00.000Z')) {}

  now(): number {
    return this.time;
  }
}

export class InMemoryTokenStore implements TokenStore {
  constructor(public stored: StoredSession | null = null) {}

  async read(): Promise<StoredSession | null> {
    return this.stored;
  }

  async write(stored: StoredSession): Promise<void> {
    this.stored = stored;
  }

  async clear(): Promise<void> {
    this.stored = null;
  }
}

export class InMemoryPreferencesStore implements PreferencesStore {
  theme: PreferenceTheme | null = null;

  async readTheme(): Promise<PreferenceTheme | null> {
    return this.theme;
  }

  async writeTheme(theme: PreferenceTheme): Promise<void> {
    this.theme = theme;
  }
}

/** Une session qui expire dans une heure à partir de `now`. */
export function sessionFor(label: string, now: number, ttlMs = 60 * 60 * 1000): Session {
  return {
    accessToken: `acces-${label}`,
    refreshToken: `renouvellement-${label}`,
    expiresAt: new Date(now + ttlMs).toISOString(),
  };
}

export const ALICE: User = { id: 'u-alice', name: 'Alice Martin', email: 'alice@apex.test' };

/** Le statut qu'Apex Brain rend avec chaque code d'erreur ; sans réponse (réseau, délai), aucun. */
const STATUS_OF_CODE: Readonly<Record<string, number>> = {
  INVALID_SESSION: 401,
  VALIDATION_ERROR: 400,
  TOO_MANY_REQUESTS: 429,
  UNKNOWN_ERROR: 500,
};

/** L'authentification d'Apex Brain, en mémoire. */
export class InMemoryAuthGateway implements AuthGateway {
  readonly calls: string[] = [];
  /** Les jetons de renouvellement encore valables. */
  readonly validRefreshTokens = new Set<string>();
  /** Les jetons d'accès que le serveur accepte. */
  readonly validAccessTokens = new Set<string>();
  accounts = new Map<string, { password: string; user: User; confirmed: boolean }>();
  /** La personne de chaque jeton émis (d'accès ou de renouvellement). */
  private readonly owners = new Map<string, User>();
  private sequence = 0;
  private refreshFailure: string | null = null;

  constructor(private readonly clock: Clock) {}

  addAccount(email: string, password: string, user: User, confirmed = true): void {
    this.accounts.set(email, { password, user, confirmed });
  }

  /** Le prochain renouvellement échoue avec ce code (`NETWORK_UNREACHABLE`, `INVALID_SESSION`…). */
  failNextRefresh(code: string): void {
    this.refreshFailure = code;
  }

  async register(credentials: Credentials): Promise<Result<Registered>> {
    this.calls.push('register');
    if (this.accounts.has(credentials.email))
      return fail({ code: 'USER_ALREADY_EXIST', message: 'exists', status: 409 });
    const user: User = { id: `u-${credentials.email}`, name: credentials.email, email: credentials.email };
    this.addAccount(credentials.email, credentials.password, user, false);
    return ok({ user, session: null });
  }

  async login(credentials: Credentials): Promise<Result<SignedIn>> {
    this.calls.push('login');
    const account = this.accounts.get(credentials.email);
    if (!account || account.password !== credentials.password)
      return fail({ code: 'INVALID_CREDENTIALS', message: 'bad', status: 401 });
    if (!account.confirmed) return fail({ code: 'EMAIL_NOT_CONFIRMED', message: 'confirm', status: 403 });
    return ok({ user: account.user, session: this.issue(undefined, account.user) });
  }

  async refresh(refreshToken: string): Promise<Result<SignedIn>> {
    this.calls.push('refresh');
    if (this.refreshFailure) {
      const code = this.refreshFailure;
      this.refreshFailure = null;
      const status = STATUS_OF_CODE[code];
      return fail({ code, message: 'refresh refusé', ...(status ? { status } : {}) });
    }
    if (!this.validRefreshTokens.has(refreshToken))
      return fail({ code: 'INVALID_SESSION', message: 'gone', status: 401 });
    this.validRefreshTokens.delete(refreshToken);
    const user = this.owners.get(refreshToken) ?? ALICE;
    return ok({ user, session: this.issue(undefined, user) });
  }

  async logout(accessToken: string): Promise<Result<void>> {
    this.calls.push('logout');
    this.validAccessTokens.delete(accessToken);
    return ok(undefined);
  }

  async me(accessToken: string): Promise<Result<User>> {
    this.calls.push('me');
    if (!this.validAccessTokens.has(accessToken))
      return fail({ code: 'UNAUTHENTICATED', message: 'no', status: 401 });
    return ok(this.owners.get(accessToken) ?? ALICE);
  }

  /** Une session que ce serveur reconnaît, pour cette personne (Alice par défaut). */
  issue(ttlMs?: number, user: User = ALICE): Session {
    this.sequence += 1;
    const session = sessionFor(String(this.sequence), this.clock.now(), ttlMs);
    this.validAccessTokens.add(session.accessToken);
    this.validRefreshTokens.add(session.refreshToken);
    this.owners.set(session.accessToken, user);
    this.owners.set(session.refreshToken, user);
    return session;
  }
}

/** Akari, côté serveur, joué à la main : les tests décident de chaque état. */
export class ScriptedAssistantGateway implements AssistantGateway {
  readonly calls: string[] = [];
  conversation: ConversationMessage[] = [];
  state: WorkflowState;
  /** Les états à rendre aux prochaines lectures, dans l'ordre ; ensuite, `state`. */
  readonly upcoming: WorkflowState[] = [];
  /** Les prochaines lectures de l'état échouent avec ces codes, dans l'ordre. */
  readonly stateFailures: string[] = [];
  nextSendFailure: string | null = null;
  /** Les lectures de l'état retenues : chacune rend l'état du moment où le serveur l'a traitée. */
  private heldStates: (() => void)[] | null = null;

  constructor(objectiveId = 'o1') {
    this.state = readyState(objectiveId);
  }

  async getConversation(objectiveId: string): Promise<Result<Conversation>> {
    this.calls.push(`conversation:${objectiveId}`);
    return ok({ id: `c-${objectiveId}`, messages: [...this.conversation] });
  }

  async getState(objectiveId: string): Promise<Result<WorkflowState>> {
    this.calls.push(`state:${objectiveId}`);
    const failure = this.stateFailures.shift();
    if (failure) {
      const status = STATUS_OF_CODE[failure];
      return fail({ code: failure, message: 'lecture refusée', ...(status ? { status } : {}) });
    }
    const next = this.upcoming.shift();
    if (next) this.state = next;
    const answer = this.state;
    if (this.heldStates) await new Promise<void>((resume) => this.heldStates?.push(resume));
    return ok(answer);
  }

  /** Les réponses aux lectures de l'état attendent `releaseStates()` (une réponse qui arrive en retard). */
  holdStates(): void {
    this.heldStates = [];
  }

  async releaseStates(): Promise<void> {
    const waiting = this.heldStates ?? [];
    this.heldStates = null;
    waiting.forEach((resume) => resume());
    await flush();
  }

  async sendMessage(objectiveId: string, message: string): Promise<Result<WorkflowState>> {
    this.calls.push(`send:${message}`);
    if (this.nextSendFailure) {
      const code = this.nextSendFailure;
      this.nextSendFailure = null;
      return fail({ code, message: 'refusé', status: 409 });
    }
    this.state = {
      ...readyState(objectiveId),
      value: 'RegisteringUserMessageInConversation',
      status: 'processing',
    };
    return ok(this.state);
  }

  async respondToPermission(
    objectiveId: string,
    granted: boolean,
    toolCallId?: string,
  ): Promise<Result<WorkflowState>> {
    this.calls.push(`permission:${granted}:${toolCallId ?? ''}`);
    this.state = {
      ...readyState(objectiveId),
      value: { ExecutingAllTool: 'ExecutingTool' },
      status: 'processing',
    };
    return ok(this.state);
  }
}

export function readyState(objectiveId: string, overrides: Partial<WorkflowState> = {}): WorkflowState {
  return {
    objectiveId,
    value: 'Ready For New Message',
    status: 'ready',
    pendingToolCall: null,
    lastRegisteredMessage: null,
    lastError: null,
    ...overrides,
  };
}

export function awaitingPermission(objectiveId: string, call: ToolCall): WorkflowState {
  return readyState(objectiveId, {
    value: { ExecutingAllTool: 'WaitingForUserPermission' },
    status: 'awaiting-permission',
    pendingToolCall: call,
  });
}
