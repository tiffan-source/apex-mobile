import { ALICE, FakeClock, InMemoryAuthGateway, InMemoryTokenStore, sessionFor } from '@/testing/fakes';
import { flush } from '@/testing/in-memory-objectives-gateway';
import { SessionManager } from './session-manager';

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
