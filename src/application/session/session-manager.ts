import { isConnectivityFailure, ok, type Result } from '@/domain/shared/result';
import { expiresSoon, type User } from '@/domain/session/user';
import type { AccessTokenProvider, AuthGateway, Credentials, SignedIn } from '../ports/auth-gateway';
import { SYSTEM_CLOCK, type Clock, type StoredSession, type TokenStore } from '../ports/platform';
import { ObservableValue } from '../shared/observable-value';

/*
 * La session de la personne : l'ouvrir, la retrouver au lancement, la renouveler avant son échéance ou après un
 * refus du serveur, la fermer. Apex Brain est sans état (ADR 0003) : le client garde le jeton d'accès et celui
 * qui le renouvelle, dans le coffre de l'appareil.
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

export class SessionManager implements AccessTokenProvider {
  readonly state = new ObservableValue<SessionState>({ status: 'restoring' });

  private stored: StoredSession | null = null;
  private refreshing: Promise<string | null> | null = null;
  /** Change à chaque ouverture ou fermeture de session : une réponse arrivée après est ignorée. */
  private generation = 0;
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
    this.stored = stored;
    this.state.set({ status: 'signed-in', user: stored.user });
    void this.verify();
  }

  async signIn(credentials: Credentials): Promise<Result<User>> {
    const result = await this.deps.auth.login(credentials);
    if (!result.success) return result;
    this.generation += 1;
    await this.keep(result.data);
    return ok(result.data.user);
  }

  /** Crée le compte ; la session s'ouvre sauf si l'adresse doit d'abord être confirmée. */
  async signUp(credentials: Credentials): Promise<Result<SignUpOutcome>> {
    const result = await this.deps.auth.register(credentials);
    if (!result.success) return result;
    const { user, session } = result.data;
    if (!session) return ok({ user, awaitingConfirmation: true });
    this.generation += 1;
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
    if (!expiresSoon(stored.session, this.now(), RENEW_MARGIN_MS)) return stored.session.accessToken;
    return this.refresh();
  }

  async renewAfterRejection(rejectedToken: string): Promise<string | null> {
    const stored = this.stored;
    if (!stored) return null;
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
    } else if (me.error.status === 401) {
      const renewed = await this.renewAfterRejection(token);
      if (renewed) void this.verifyAgain(renewed, generation);
    }
  }

  private async verifyAgain(token: string, generation: number): Promise<void> {
    const me = await this.deps.auth.me(token);
    if (generation !== this.generation || !this.stored) return;
    if (me.success) await this.keep({ user: me.data, session: this.stored.session });
    else if (me.error.status === 401) await this.end(true);
  }

  /** Un seul renouvellement à la fois : les requêtes qui attendent un jeton partagent le même. */
  private refresh(): Promise<string | null> {
    if (this.refreshing) return this.refreshing;
    const stored = this.stored;
    if (!stored) return Promise.resolve(null);
    const generation = this.generation;
    this.refreshing = (async () => {
      const result = await this.deps.auth.refresh(stored.session.refreshToken);
      if (generation !== this.generation) return null;
      if (result.success) {
        await this.keep(result.data);
        return result.data.session.accessToken;
      }
      // Sans réseau, la session reste : la requête n'aboutira pas, mais rien n'est perdu.
      if (isConnectivityFailure(result.error)) return stored.session.accessToken;
      await this.end(true);
      return null;
    })().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  private async keep(signedIn: SignedIn): Promise<void> {
    this.stored = { session: signedIn.session, user: signedIn.user };
    await this.deps.tokens.write(this.stored).catch(() => undefined);
    this.state.set({ status: 'signed-in', user: signedIn.user });
  }

  private async end(ended: boolean): Promise<void> {
    this.generation += 1;
    this.stored = null;
    await this.deps.tokens.clear().catch(() => undefined);
    this.state.set({ status: 'signed-out', ended });
    this.endListeners.forEach((listener) => listener());
  }

  private now(): number {
    return (this.deps.clock ?? SYSTEM_CLOCK).now();
  }
}
