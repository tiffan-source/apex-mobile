import type { AccessTokenProvider } from '@/application/ports/auth-gateway';
import { HttpAssistantGateway } from '../apex-brain/http-assistant-gateway';
import { HttpAuthGateway } from '../apex-brain/http-auth-gateway';
import { HttpObjectivesGateway } from '../apex-brain/http-objectives-gateway';
import { resolveApiUrl } from '../config/api-url';
import { parseStoredSession } from '../storage/stored-session';
import { createApexClient, failureOf } from './apex-client';

const BASE = 'https://api.apex.test';

type Handler = (request: Request) => Response | Promise<Response>;

/** Un serveur joué à la main : chaque requête reçue est gardée. */
function server(handler: Handler) {
  const received: { method: string; url: string; authorization: string | null; body: unknown }[] = [];
  const transport = async (request: Request) => {
    const text = await request.clone().text();
    received.push({
      method: request.method,
      url: request.url.replace(BASE, ''),
      authorization: request.headers.get('Authorization'),
      body: text ? JSON.parse(text) : undefined,
    });
    return handler(request);
  };
  return { received, transport };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

class FakeTokens implements AccessTokenProvider {
  current: string | null = 'jeton-1';
  renewals = 0;

  async accessToken() {
    return this.current;
  }

  async renewAfterRejection(rejected: string) {
    if (rejected !== this.current) return this.current;
    this.renewals += 1;
    this.current = `jeton-${this.renewals + 1}`;
    return this.current;
  }
}

describe('le client d’Apex Brain', () => {
  it('pose le jeton de la session sur chaque requête', async () => {
    const { received, transport } = server(() => json(200, { objectives: [], tasks: [] }));
    const client = createApexClient({ baseUrl: BASE, tokens: new FakeTokens(), fetch: transport });
    const result = await new HttpObjectivesGateway(client).list();
    expect(result).toEqual({ success: true, data: { objectives: [], tasks: [] } });
    expect(received).toEqual([
      { method: 'GET', url: '/v1/objectives', authorization: 'Bearer jeton-1', body: undefined },
    ]);
  });

  it('après un 401, renouvelle la session une fois et rejoue la requête avec son corps', async () => {
    const tokens = new FakeTokens();
    const { received, transport } = server((request) =>
      request.headers.get('Authorization') === 'Bearer jeton-1'
        ? json(401, { error: { code: 'UNAUTHENTICATED', message: 'expired' } })
        : json(201, { id: 'p9', title: 'Courir', importance: 3, urgency: 2 }),
    );
    const client = createApexClient({ baseUrl: BASE, tokens, fetch: transport });
    const result = await new HttpObjectivesGateway(client).addTask('e1', {
      title: 'Courir',
      importance: 3,
      urgency: 2,
    });
    expect(result).toEqual({ success: true, data: { id: 'p9' } });
    expect(tokens.renewals).toBe(1);
    expect(received.map((item) => [item.authorization, item.body])).toEqual([
      ['Bearer jeton-1', { title: 'Courir', importance: 3, urgency: 2 }],
      ['Bearer jeton-2', { title: 'Courir', importance: 3, urgency: 2 }],
    ]);
  });

  it('ne part pas sans session', async () => {
    const tokens = new FakeTokens();
    tokens.current = null;
    const { received, transport } = server(() => json(200, {}));
    const client = createApexClient({ baseUrl: BASE, tokens, fetch: transport });
    const result = await new HttpObjectivesGateway(client).setTaskDone('p1', true);
    expect(result.success === false && result.error.code).toBe('SIGNED_OUT');
    expect(received).toEqual([]);
  });

  it('rend le code d’Apex Brain, jamais une exception', async () => {
    const { transport } = server(() =>
      json(404, { error: { code: 'TASK_NOT_FOUND', message: 'Task with ID p1 not found' } }),
    );
    const client = createApexClient({ baseUrl: BASE, tokens: new FakeTokens(), fetch: transport });
    const result = await new HttpObjectivesGateway(client).setTaskDone('p1', true);
    expect(result).toEqual({
      success: false,
      error: { code: 'TASK_NOT_FOUND', message: 'Task with ID p1 not found', status: 404 },
    });
  });

  it('sans réseau, ou trop lent : un code du client', async () => {
    const offline = createApexClient({
      baseUrl: BASE,
      tokens: new FakeTokens(),
      fetch: async () => {
        throw new TypeError('Network request failed');
      },
    });
    const unreachable = await new HttpObjectivesGateway(offline).list();
    expect(unreachable.success === false && unreachable.error.code).toBe('NETWORK_UNREACHABLE');

    const slow = createApexClient({
      baseUrl: BASE,
      tokens: new FakeTokens(),
      timeoutMs: 10,
      fetch: (request) =>
        new Promise((_, reject) =>
          request.signal.addEventListener('abort', () => reject(new Error('aborted'))),
        ),
    });
    const timedOut = await new HttpObjectivesGateway(slow).list();
    expect(timedOut.success === false && timedOut.error.code).toBe('TIMEOUT');
  });

  it('lit le détail des champs refusés, et se rabat sur un code sûr', () => {
    expect(
      failureOf(400, {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid',
          details: [{ path: 'title', message: 'Too small' }],
        },
      }),
    ).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Invalid',
      status: 400,
      details: [{ path: 'title', message: 'Too small' }],
    });
    expect(failureOf(502, 'Bad gateway').code).toBe('UNKNOWN_ERROR');
    expect(failureOf(418, null).code).toBe('UNREADABLE_RESPONSE');
  });
});

describe('les passerelles', () => {
  it('lit les objectifs à plat : parentObjective devient parentId', async () => {
    const { transport } = server(() =>
      json(200, {
        objectives: [
          { id: 'o', title: 'O', description: '', why: '', dueDate: null, parentObjective: null },
          {
            id: 'e',
            title: 'E',
            description: '',
            why: '',
            dueDate: '2027-04-01T00:00:00.000Z',
            parentObjective: 'o',
          },
        ],
        tasks: [{ id: 'p', title: 'P', importance: 3, urgency: 2, done: false, objectiveId: 'e' }],
      }),
    );
    const result = await new HttpObjectivesGateway(
      createApexClient({ baseUrl: BASE, tokens: new FakeTokens(), fetch: transport }),
    ).list();
    expect(
      result.success && result.data.objectives.map((objective) => [objective.id, objective.parentId]),
    ).toEqual([
      ['o', null],
      ['e', 'o'],
    ]);
  });

  it('modifie un objectif sans toucher à ce qui est absent, et retire une échéance avec null', async () => {
    const { received, transport } = server(() => json(200, { id: 'o', title: 'O' }));
    const gateway = new HttpObjectivesGateway(
      createApexClient({ baseUrl: BASE, tokens: new FakeTokens(), fetch: transport }),
    );
    await gateway.editObjective('o', { title: 'O', dueDate: null });
    expect(received[0]).toMatchObject({
      method: 'PATCH',
      url: '/v1/objectives/o',
      body: { title: 'O', dueDate: null },
    });
  });

  it('lit l’état du workflow d’Akari, et répond à une demande d’accord', async () => {
    const state = {
      objectiveId: 'o',
      value: { ExecutingAllTool: 'WaitingForUserPermission' },
      status: 'awaiting-permission',
      pendingToolCall: { id: 'c1', name: 'createSubObjective', arguments: { title: 'Portfolio' } },
      lastRegisteredMessage: null,
      lastError: null,
    };
    const { received, transport } = server(() => json(202, state));
    const gateway = new HttpAssistantGateway(
      createApexClient({ baseUrl: BASE, tokens: new FakeTokens(), fetch: transport }),
    );
    const result = await gateway.respondToPermission('o', true, 'c1');
    expect(result.success && result.data.pendingToolCall?.name).toBe('createSubObjective');
    expect(received[0]).toMatchObject({
      url: '/v1/objectives/o/assistant/permission',
      body: { granted: true, toolCallId: 'c1' },
    });
  });

  it('se connecte sans jeton, et passe le jeton à la main pour « me » et la déconnexion', async () => {
    const { received, transport } = server((request) =>
      request.url.endsWith('/logout')
        ? new Response(null, { status: 204 })
        : json(200, { id: 'u', name: 'Alice', email: 'alice@apex.test' }),
    );
    const gateway = new HttpAuthGateway(createApexClient({ baseUrl: BASE, fetch: transport }));
    expect(await gateway.me('jeton-x')).toEqual({
      success: true,
      data: { id: 'u', name: 'Alice', email: 'alice@apex.test' },
    });
    expect(await gateway.logout('jeton-x')).toEqual({ success: true, data: undefined });
    expect(received.map((item) => item.authorization)).toEqual(['Bearer jeton-x', 'Bearer jeton-x']);
  });
});

describe('la configuration', () => {
  it("trouve l'adresse d'Apex Brain", () => {
    expect(resolveApiUrl({ configured: 'https://api.apex.app/', dev: false, os: 'ios' })).toBe(
      'https://api.apex.app',
    );
    expect(resolveApiUrl({ hostUri: '192.168.1.20:8081', dev: true, os: 'ios' })).toBe(
      'http://192.168.1.20:3000',
    );
    expect(resolveApiUrl({ hostUri: 'localhost:8081', dev: true, os: 'android' })).toBe(
      'http://10.0.2.2:3000',
    );
    expect(resolveApiUrl({ hostUri: null, dev: true, os: 'ios' })).toBe('http://localhost:3000');
    expect(() => resolveApiUrl({ dev: false, os: 'ios' })).toThrow('EXPO_PUBLIC_APEX_API_URL');
  });

  it('relit la session du coffre, ou repart sans', () => {
    const stored = {
      session: { accessToken: 'a', refreshToken: 'r', expiresAt: '2026-10-25T21:00:00.000Z' },
      user: { id: 'u', name: 'Alice', email: 'alice@apex.test' },
    };
    expect(parseStoredSession(JSON.stringify(stored))).toEqual(stored);
    expect(parseStoredSession('{"session":{}}')).toBeNull();
    expect(parseStoredSession('pas du json')).toBeNull();
    expect(parseStoredSession(null)).toBeNull();
  });
});
