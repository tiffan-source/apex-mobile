import type { User } from '@/domain/session/user';
import type { Result } from '@/domain/shared/result';
import type { SignedIn } from '../ports/auth-gateway';
import { ALICE, FakeClock, InMemoryAuthGateway, InMemoryTokenStore, sessionFor } from '@/testing/fakes';
import { flush } from '@/testing/in-memory-objectives-gateway';
import { SessionManager } from './session-manager';

const BOB: User = { id: 'u-bob', name: 'Bob', email: 'bob@apex.test' };

function setup(options: { stored?: boolean; ttlMs?: number } = {}) {
  const clock = new FakeClock();
  const auth = new InMemoryAuthGateway(clock);
  auth.addAccount('alice@apex.test', 'secret1', ALICE);
  const tokens = new InMemoryTokenStore(
    options.stored ? { session: auth.issue(options.ttlMs), user: ALICE } : null,
  );
  const session = new SessionManager({ auth, tokens, clock });
  return { clock, auth, tokens, session };
}

describe('SessionManager', () => {
  it('sans session retenue, attend la connexion', async () => {
    const t = setup();
    expect(t.session.state.get()).toEqual({ status: 'restoring' });
    await t.session.restore();
    expect(t.session.state.get()).toEqual({ status: 'signed-out', ended: false });
    expect(await t.session.accessToken()).toBeNull();
  });

  it('une session retenue ouvre l’application tout de suite, puis se vérifie', async () => {
    const t = setup({ stored: true });
    await t.session.restore();
    expect(t.session.state.get()).toEqual({ status: 'signed-in', user: ALICE });
    await flush();
    expect(t.auth.calls).toEqual(['me']);
  });

  it('se connecte, garde la session dans le coffre, et rend le jeton tant qu’il est valable', async () => {
    const t = setup();
    await t.session.restore();
    const result = await t.session.signIn({ email: 'alice@apex.test', password: 'secret1' });
    expect(result).toEqual({ success: true, data: ALICE });
    expect(t.tokens.stored?.user).toEqual(ALICE);
    expect(await t.session.accessToken()).toBe(t.tokens.stored?.session.accessToken);
    expect(t.auth.calls).toEqual(['login']);
  });

  it('rend le refus du serveur tel quel (son code choisit la phrase)', async () => {
    const t = setup();
    const result = await t.session.signIn({ email: 'alice@apex.test', password: 'mauvais' });
    expect(result.success).toBe(false);
    expect(!result.success && result.error.code).toBe('INVALID_CREDENTIALS');
    expect(t.tokens.stored).toBeNull();
  });

  it('renouvelle le jeton une minute avant son échéance, une seule fois pour plusieurs requêtes', async () => {
    const t = setup({ stored: true, ttlMs: 30_000 });
    const first = t.tokens.stored?.session.accessToken;
    await t.session.restore();
    const tokens = await Promise.all([
      t.session.accessToken(),
      t.session.accessToken(),
      t.session.accessToken(),
    ]);
    expect(new Set(tokens).size).toBe(1);
    expect(tokens[0]).not.toBe(first);
    expect(t.auth.calls.filter((call) => call === 'refresh')).toHaveLength(1);
  });

  it('après un refus du serveur, renouvelle une fois ; un jeton déjà renouvelé sert tel quel', async () => {
    const t = setup({ stored: true });
    await t.session.restore();
    await flush();
    const rejected = t.tokens.stored?.session.accessToken as string;
    const renewed = await t.session.renewAfterRejection(rejected);
    expect(renewed).not.toBe(rejected);
    expect(await t.session.renewAfterRejection(rejected)).toBe(renewed);
    expect(t.auth.calls.filter((call) => call === 'refresh')).toHaveLength(1);
  });

  it('sans réseau, la session reste ouverte', async () => {
    const t = setup({ stored: true, ttlMs: 30_000 });
    t.auth.failNextRefresh('NETWORK_UNREACHABLE');
    await t.session.restore();
    await flush();
    expect(t.session.state.get().status).toBe('signed-in');
  });

  it('un renouvellement refusé met fin à la session, et prévient ceux qui gardent ses données', async () => {
    const t = setup({ stored: true });
    await t.session.restore();
    await flush();
    const ended = jest.fn();
    t.session.onSignedOut(ended);
    t.auth.failNextRefresh('INVALID_SESSION');
    expect(await t.session.renewAfterRejection(t.tokens.stored?.session.accessToken as string)).toBeNull();
    expect(t.session.state.get()).toEqual({ status: 'signed-out', ended: true });
    expect(t.tokens.stored).toBeNull();
    expect(ended).toHaveBeenCalledTimes(1);
  });

  it('se déconnecte tout de suite sur l’appareil, puis côté serveur', async () => {
    const t = setup({ stored: true });
    await t.session.restore();
    await t.session.signOut();
    expect(t.session.state.get()).toEqual({ status: 'signed-out', ended: false });
    expect(t.tokens.stored).toBeNull();
    await flush();
    expect(t.auth.calls).toContain('logout');
  });

  it('une inscription à confirmer ne connecte pas', async () => {
    const t = setup();
    const result = await t.session.signUp({ email: 'nouveau@apex.test', password: 'secret1' });
    expect(result.success && result.data.awaitingConfirmation).toBe(true);
    expect(t.tokens.stored).toBeNull();
    expect(sessionFor('x', 0).accessToken).toBe('acces-x');
  });
});

describe('SessionManager : seul un refus du serveur ferme la session', () => {
  it.each(['TOO_MANY_REQUESTS', 'UNKNOWN_ERROR', 'TIMEOUT'])(
    'un renouvellement qui rend %s laisse la session ouverte, et le suivant réessaie',
    async (code) => {
      const t = setup({ stored: true, ttlMs: 30_000 });
      const kept = t.tokens.stored;
      t.auth.failNextRefresh(code);
      await t.session.restore();
      await flush();
      expect(t.session.state.get()).toEqual({ status: 'signed-in', user: ALICE });
      expect(t.tokens.stored).toEqual(kept);
      // Tout de suite après, on ne réessaie pas : le jeton actuel est tenté.
      expect(await t.session.accessToken()).toBe(kept?.session.accessToken);
      expect(t.auth.calls.filter((call) => call === 'refresh')).toHaveLength(1);
      // Quelques secondes plus tard, le prochain besoin d'un jeton renouvelle la session.
      t.clock.time += 5_000;
      const token = await t.session.accessToken();
      expect(token).not.toBe(kept?.session.accessToken);
      expect(t.auth.calls.filter((call) => call === 'refresh')).toHaveLength(2);
    },
  );

  it('un jeton refusé au lancement, puis un renouvellement sans réseau : la session reste', async () => {
    const t = setup({ stored: true });
    const stored = t.tokens.stored;
    t.auth.validAccessTokens.delete(stored?.session.accessToken as string);
    t.auth.failNextRefresh('TIMEOUT');
    await t.session.restore();
    await flush();
    expect(t.session.state.get().status).toBe('signed-in');
    expect(t.tokens.stored).toEqual(stored);
    // La requête refusée ne repart pas avec le même jeton.
    expect(t.auth.calls).toEqual(['me', 'refresh']);
  });

  it('une horloge en avance ne renouvelle pas à chaque requête : le serveur dira quand le jeton ne vaut plus', async () => {
    const server = new FakeClock();
    const device = new FakeClock(server.time + 60 * 60 * 1000);
    const auth = new InMemoryAuthGateway(server);
    const tokens = new InMemoryTokenStore({ session: auth.issue(), user: ALICE });
    const session = new SessionManager({ auth, tokens, clock: device });
    await session.restore();
    await flush();
    for (let request = 0; request < 10; request += 1) expect(await session.accessToken()).toBeTruthy();
    expect(auth.calls.filter((call) => call === 'refresh')).toHaveLength(1);
    device.time += 61_000;
    await session.accessToken();
    expect(auth.calls.filter((call) => call === 'refresh')).toHaveLength(2);
  });
});

describe('SessionManager : une session ne prête rien à la suivante', () => {
  function twoAccounts() {
    const t = setup();
    t.auth.addAccount('bob@apex.test', 'secret2', BOB);
    return t;
  }

  it('une requête de la session précédente, refusée, ne repart pas avec le jeton de la suivante', async () => {
    const t = twoAccounts();
    await t.session.restore();
    await t.session.signIn({ email: 'alice@apex.test', password: 'secret1' });
    const alice = t.tokens.stored?.session.accessToken as string;
    await t.session.signOut();
    await t.session.signIn({ email: 'bob@apex.test', password: 'secret2' });
    expect(await t.session.renewAfterRejection(alice)).toBeNull();
    expect(t.auth.calls.filter((call) => call === 'refresh')).toHaveLength(0);
  });

  it('un renouvellement encore en route à la déconnexion ne sert pas à la session suivante', async () => {
    const t = twoAccounts();
    await t.session.restore();
    await t.session.signIn({ email: 'alice@apex.test', password: 'secret1' });
    // Le renouvellement d'Alice attend sa réponse…
    let answer: () => void = () => undefined;
    const refresh = t.auth.refresh.bind(t.auth);
    t.auth.refresh = (token: string): Promise<Result<SignedIn>> =>
      new Promise((resolve) => {
        answer = () => void refresh(token).then(resolve);
      });
    t.clock.time += 60 * 60 * 1000 - 30_000;
    const aliceToken = t.session.accessToken();
    await flush();
    // … pendant qu'elle se déconnecte et que Bob se connecte.
    await t.session.signOut();
    t.auth.refresh = refresh;
    await t.session.signIn({ email: 'bob@apex.test', password: 'secret2' });
    const bob = t.tokens.stored?.session.accessToken as string;
    const renewed = t.session.renewAfterRejection(bob);
    answer();
    expect(await aliceToken).toBeNull();
    expect(await renewed).toBeTruthy();
    expect(await renewed).not.toBe(bob);
    expect(t.session.state.get()).toEqual({ status: 'signed-in', user: BOB });
  });
});
