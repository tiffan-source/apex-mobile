import { ok, type Failure, type Result } from '@/domain/shared/result';
import { expiresSoon, type User } from '@/domain/session/user';
import type { AccessTokenProvider, AuthGateway, Credentials, SignedIn } from '../ports/auth-gateway';
import { SYSTEM_CLOCK, type Clock, type StoredSession, type TokenStore } from '../ports/platform';
import { ObservableValue } from '../shared/observable-value';

/*
 * La session de la personne : l'ouvrir, la retrouver au lancement, la renouveler avant son échéance ou après un
 * refus du serveur, la fermer. Apex Brain est sans état (ADR 0003) : le client garde le jeton d'accès et celui
 * qui le renouvelle, dans le coffre de l'appareil.
 *
 * Seul un refus du serveur ferme la session : un renouvellement qui n'aboutit pas faute de réseau, parce que
 * le serveur est indisponible ou reçoit trop de demandes, la laisse ouverte, et le prochain besoin d'un jeton
 * réessaie. Une requête refusée n'est rejouée qu'avec un jeton de sa propre session.
 */

export type SessionState =
  | { readonly status: 'restoring' }
  /** `ended` : la session a pris fin d'elle-même (renouvellement refusé) ; l'écran de connexion le dit. */
  | { readonly status: 'signed-out'; readonly ended: boolean }
  | { readonly status: 'signed-in'; readonly user: User };

/** Une inscription aboutie : la personne est connectée, ou son adresse attend sa confirmation. */
export type SignUpOutcome = { readonly user: User; readonly awaitingConfirmation: boolean };

/** Le jeton se renouvelle une minute avant son échéance. */
const RENEW_MARGIN_MS = 60_000;

/** Après un renouvellement qui n'a pas abouti, le suivant attend un peu : le serveur limite ces demandes. */
const RETRY_AFTER_MS = 5_000;

/** Le serveur refuse le jeton de renouvellement (expiré, révoqué, illisible) : la session ne vaut plus. */
function refusesSession(failure: Failure): boolean {
  return (
    failure.status === 401 ||
    failure.status === 400 ||
    failure.code === 'INVALID_SESSION' ||
    failure.code === 'UNAUTHENTICATED'
  );
}

export class SessionManager implements AccessTokenProvider {
  readonly state = new ObservableValue<SessionState>({ status: 'restoring' });

  private stored: StoredSession | null = null;
  /** Change à chaque ouverture ou fermeture de session : une réponse arrivée après est ignorée. */
  private generation = 0;
  /** Les jetons d'accès de la session ouverte : le premier, puis ceux de ses renouvellements. */
  private issued = new Set<string>();
  /** Le renouvellement en cours, et la session qui l'a demandé. */
  private refreshing: { readonly generation: number; readonly token: Promise<string | null> } | null = null;
  /** L'instant du dernier renouvellement abouti, à l'horloge de l'appareil. */
  private renewedAt: number | null = null;
  /** L'instant du dernier renouvellement qui n'a pas abouti (réseau, serveur), à l'horloge de l'appareil. */
  private failedAt: number | null = null;
  /** Les écritures du coffre, dans l'ordre : une fermeture n'est jamais suivie d'une écriture plus ancienne. */
  private vault: Promise<void> = Promise.resolve();
  private readonly endListeners = new Set<() => void>();

  constructor(
    private readonly deps: {
      readonly auth: AuthGateway;
      readonly tokens: TokenStore;
      readonly clock?: Clock;
    },
  ) {}

  /** La personne connectée, ou null. */
  get user(): User | null {
    const state = this.state.get();
    return state.status === 'signed-in' ? state.user : null;
  }

  /** Prévenu à chaque fermeture de session (déconnexion ou fin), pour oublier ce qui lui appartenait. */
  onSignedOut(listener: () => void): () => void {
    this.endListeners.add(listener);
    return () => {
      this.endListeners.delete(listener);
    };
  }

  /**
   * Au lancement : la session retenue ouvre l'application tout de suite (la personne et son nom sont connus),
   * puis elle est vérifiée en arrière-plan. Sans réseau, elle reste ouverte ; refusée, elle prend fin.
   */
  async restore(): Promise<void> {
    const stored = await this.deps.tokens.read().catch(() => null);
    if (!stored) {
      this.state.set({ status: 'signed-out', ended: false });
      return;
    }
    this.begin(stored);
    this.state.set({ status: 'signed-in', user: stored.user });
    void this.verify();
  }

  async signIn(credentials: Credentials): Promise<Result<User>> {
    const result = await this.deps.auth.login(credentials);
    if (!result.success) return result;
    this.begin(result.data);
    await this.keep(result.data);
    return ok(result.data.user);
  }

  /** Crée le compte ; la session s'ouvre sauf si l'adresse doit d'abord être confirmée. */
  async signUp(credentials: Credentials): Promise<Result<SignUpOutcome>> {
    const result = await this.deps.auth.register(credentials);
    if (!result.success) return result;
    const { user, session } = result.data;
    if (!session) return ok({ user, awaitingConfirmation: true });
    this.begin({ user, session });
    await this.keep({ user, session });
    return ok({ user, awaitingConfirmation: false });
  }

  /** Ferme la session sur l'appareil tout de suite, puis côté serveur (sans attendre sa réponse). */
  async signOut(): Promise<void> {
    const stored = this.stored;
    await this.end(false);
    if (stored) void this.deps.auth.logout(stored.session.accessToken).catch(() => undefined);
  }

  async accessToken(): Promise<string | null> {
    const stored = this.stored;
    if (!stored) return null;
    const now = this.now();
    if (!expiresSoon(stored.session, now, RENEW_MARGIN_MS)) return stored.session.accessToken;
    // Tout juste renouvelé, et déjà près de l'échéance à l'horloge de l'appareil : c'est l'horloge qui avance.
    // Le jeton vaut encore pour le serveur, qui dira (401) quand il ne vaudra plus.
    if (this.renewedAt !== null && now - this.renewedAt < RENEW_MARGIN_MS) return stored.session.accessToken;
    const generation = this.generation;
    const renewed = await this.refresh();
    if (renewed) return renewed;
    // Le renouvellement n'a pas abouti sans que le serveur ferme la session : le jeton actuel est tenté.
    return generation === this.generation ? (this.stored?.session.accessToken ?? null) : null;
  }

  async renewAfterRejection(rejectedToken: string): Promise<string | null> {
    const stored = this.stored;
    // Le jeton d'une session fermée depuis : sa requête ne repart jamais avec une autre session.
    if (!stored || !this.issued.has(rejectedToken)) return null;
    // Une autre requête l'a déjà renouvelé : le nouveau jeton suffit.
    if (stored.session.accessToken !== rejectedToken) return stored.session.accessToken;
    return this.refresh();
  }

  private async verify(): Promise<void> {
    const generation = this.generation;
    const token = await this.accessToken();
    if (!token || generation !== this.generation) return;
    const me = await this.deps.auth.me(token);
    if (generation !== this.generation || !this.stored) return;
    if (me.success) {
      const { user } = this.stored;
      if (me.data.name !== user.name || me.data.email !== user.email) {
        await this.keep({ user: me.data, session: this.stored.session });
      }
      return;
    }
    // Sans réseau, ou le serveur indisponible : la session reste, la prochaine requête la vérifiera.
    if (me.error.status !== 401) return;
    const renewed = await this.renewAfterRejection(token);
    if (renewed && generation === this.generation) void this.verifyAgain(renewed, generation);
  }

  private async verifyAgain(token: string, generation: number): Promise<void> {
    const me = await this.deps.auth.me(token);
    if (generation !== this.generation || !this.stored) return;
    if (me.success) await this.keep({ user: me.data, session: this.stored.session });
    else if (me.error.status === 401) await this.end(true);
  }

  /**
   * Un seul renouvellement à la fois par session : les requêtes qui attendent un jeton partagent le même. Rend
   * le nouveau jeton, ou null s'il n'a pas abouti (la session reste ouverte, sauf si le serveur la refuse).
   */
  private refresh(): Promise<string | null> {
    const stored = this.stored;
    if (!stored) return Promise.resolve(null);
    const generation = this.generation;
    if (this.refreshing?.generation === generation) return this.refreshing.token;
    if (this.failedAt !== null && this.now() - this.failedAt < RETRY_AFTER_MS) return Promise.resolve(null);
    const token = (async () => {
      const result = await this.deps.auth.refresh(stored.session.refreshToken);
      if (generation !== this.generation) return null;
      if (result.success) {
        this.renewedAt = this.now();
        this.failedAt = null;
        await this.keep(result.data);
        return generation === this.generation ? result.data.session.accessToken : null;
      }
      if (refusesSession(result.error)) await this.end(true);
      else this.failedAt = this.now();
      return null;
    })().finally(() => {
      if (this.refreshing?.token === token) this.refreshing = null;
    });
    this.refreshing = { generation, token };
    return token;
  }

  /** Une nouvelle session commence : rien de la précédente ne la suit. */
  private begin(stored: StoredSession): void {
    this.generation += 1;
    this.stored = stored;
    this.issued = new Set([stored.session.accessToken]);
    this.refreshing = null;
    this.renewedAt = null;
    this.failedAt = null;
  }

  private async keep(signedIn: SignedIn): Promise<void> {
    const generation = this.generation;
    const stored: StoredSession = { session: signedIn.session, user: signedIn.user };
    this.stored = stored;
    this.issued.add(stored.session.accessToken);
    await this.inVault((tokens) => tokens.write(stored));
    if (generation === this.generation) this.state.set({ status: 'signed-in', user: signedIn.user });
  }

  private async end(ended: boolean): Promise<void> {
    this.generation += 1;
    this.stored = null;
    this.issued = new Set();
    this.refreshing = null;
    this.renewedAt = null;
    this.failedAt = null;
    await this.inVault((tokens) => tokens.clear());
    this.state.set({ status: 'signed-out', ended });
    this.endListeners.forEach((listener) => listener());
  }

  /** Une opération sur le coffre, après les précédentes ; un coffre qui refuse n'empêche rien. */
  private inVault(operation: (tokens: TokenStore) => Promise<void>): Promise<void> {
    const done = this.vault.then(() => operation(this.deps.tokens)).catch(() => undefined);
    this.vault = done;
    return done;
  }

  private now(): number {
    return (this.deps.clock ?? SYSTEM_CLOCK).now();
  }
}
