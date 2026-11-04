import {
  AKARI_JOURNAL,
  AKARI_JOURNAL_LINES,
  AKARI_LONG_WAIT_MS,
  AKARI_STATUS,
  AKARI_STILL_THINKING,
  AKARI_TAKING_LONGER,
  AKARI_THINKING,
  AKARI_VERY_LONG_WAIT_MS,
  CREATE_STAGE_TOOL,
  CREATE_TASK_TOOL,
  isWriteTool,
  isWriting,
  journalLines,
  objectiveInvitation,
  permissionPrompt,
  permissionRequestOf,
  processingPhrase,
  stageInvitation,
  type WorkflowActivity,
  type WorkflowActivityStep,
} from './assistant';
import { NBSP, typeset } from '../shared/typography';
import {
  ACCEPT_ACTION,
  AKARI_TEXTS,
  DECLINE_ACTION,
  INVITATION_REPLY_ID,
  PERMISSION_REPLY_ID,
  JOURNAL_REPLY_ID,
  buildReplies,
  pendingMessage,
  statusLine,
  toThreadMessages,
  upsertRegisteredMessage,
} from './conversation';

const USER = 'u1';
const at = (minute: number) => new Date(2026, 9, 19, 10, minute).toISOString();
const activity = (
  step: WorkflowActivityStep,
  overrides: Partial<WorkflowActivity> = {},
): WorkflowActivity => ({ step, elapsedMs: 0, round: 1, done: [], ...overrides });

describe('le workflow d’Akari', () => {
  it.each([
    ['saving-message', 'Akari note ton message…'],
    ['thinking', 'Akari réfléchit…'],
    ['checking-permission', "Akari vérifie s'il lui faut ton accord…"],
    ['reading', 'Akari regarde ton objectif…'],
    ['writing', 'Akari ajoute ce que tu as accepté…'],
    ['saving-reply', 'Akari écrit sa réponse…'],
  ] as const)('%s : « %s »', (step, phrase) => {
    expect(processingPhrase(activity(step))).toBe(phrase);
  });

  it('numérote les tours de boucle', () => {
    expect(processingPhrase(activity('reviewing', { round: 2 }))).toBe('Akari fait le point, 2e tour…');
    expect(processingPhrase(activity('reviewing', { round: 3 }))).toBe('Akari fait le point, 3e tour…');
    // Un tour commencé avant le journal ne sait pas où il en est : la phrase ne donne pas de numéro.
    expect(processingPhrase(activity('reviewing', { round: 0 }))).toBe('Akari fait le point…');
  });

  it('dit qu’Akari réfléchit encore quand un appel à l’IA dure', () => {
    const waited = (step: WorkflowActivityStep, elapsedMs: number) =>
      processingPhrase(activity(step, { round: 2, elapsedMs }));

    expect(waited('thinking', AKARI_LONG_WAIT_MS - 1)).toBe('Akari réfléchit…');
    expect(waited('thinking', AKARI_LONG_WAIT_MS)).toBe(AKARI_STILL_THINKING);
    expect(waited('reviewing', AKARI_LONG_WAIT_MS)).toBe(AKARI_STILL_THINKING);
    expect(waited('thinking', AKARI_VERY_LONG_WAIT_MS)).toBe(AKARI_TAKING_LONGER);
    expect(waited('reviewing', AKARI_VERY_LONG_WAIT_MS)).toBe(AKARI_TAKING_LONGER);
    expect(waited('writing', AKARI_VERY_LONG_WAIT_MS)).toBe(AKARI_STATUS.writing);
  });

  it('garde une phrase par défaut pour un code que ce client ne connaît pas, ou sans activité', () => {
    expect(processingPhrase(activity('nouveau-code' as WorkflowActivityStep))).toBe(AKARI_THINKING);
    expect(processingPhrase(null)).toBe(AKARI_THINKING);
    expect(processingPhrase(undefined)).toBe(AKARI_THINKING);
  });

  it('reconnaît l’écriture de ce que la personne a accepté', () => {
    const processing = (step: WorkflowActivityStep) =>
      ({ status: 'processing', activity: activity(step) }) as const;

    expect(isWriting(processing('writing'))).toBe(true);
    expect(isWriting(processing('reading'))).toBe(false);
    expect(isWriting(processing('awaiting-permission'))).toBe(false);
    expect(isWriting({ status: 'ready', activity: null })).toBe(false);
  });

  it('attend encore un tour qui ne dit pas ce qu’il fait', () => {
    expect(isWriting({ status: 'processing', activity: null })).toBe(true);
    expect(isWriting({ status: 'awaiting-permission', activity: null })).toBe(false);
  });

  it('écrit le journal du tour, dans l’ordre', () => {
    expect(
      journalLines(
        activity('reviewing', { done: ['saving-message', 'thinking', 'checking-permission', 'reading'] }),
      ),
    ).toEqual([
      "J'ai noté ton message.",
      "J'ai réfléchi à ta demande.",
      "J'ai vérifié s'il me fallait ton accord.",
      "J'ai regardé ton objectif.",
    ]);
    expect(Object.keys(AKARI_JOURNAL).sort()).toEqual(Object.keys(AKARI_STATUS).sort());
  });

  it('ne garde que les dernières lignes d’un long tour', () => {
    const done: WorkflowActivityStep[] = [
      'saving-message',
      'thinking',
      'checking-permission',
      'reading',
      'reviewing',
      'checking-permission',
      'writing',
    ];
    const lines = journalLines(activity('reviewing', { done }));

    expect(lines).toHaveLength(AKARI_JOURNAL_LINES);
    expect(lines.at(-1)).toBe(AKARI_JOURNAL.writing);
    expect(lines).not.toContain(AKARI_JOURNAL['saving-message']);
  });

  it('passe un code que ce client ne connaît pas, et n’a rien à dire sans activité', () => {
    expect(
      journalLines(activity('reviewing', { done: ['nouveau-code' as WorkflowActivityStep, 'reading'] })),
    ).toEqual([AKARI_JOURNAL.reading]);
    expect(journalLines(null)).toEqual([]);
  });

  it('lit ce qu’Akari demande d’ajouter', () => {
    const stage = {
      id: 'c1',
      name: CREATE_STAGE_TOOL,
      arguments: { parentObjectiveId: 'o', title: ' Portfolio ' },
    };
    const step = {
      id: 'c2',
      name: CREATE_TASK_TOOL,
      arguments: { objectiveId: 'e1', title: 'Écrire le CV' },
    };
    expect(permissionRequestOf(stage)).toEqual({ kind: 'stage', title: 'Portfolio', parentId: 'o' });
    expect(permissionRequestOf(step)).toEqual({ kind: 'task', title: 'Écrire le CV', objectiveId: 'e1' });
    expect(permissionRequestOf({ id: 'c3', name: 'autre', arguments: null })).toEqual({ kind: 'other' });
    expect(permissionRequestOf(null)).toBeNull();
    expect(isWriteTool(stage)).toBe(true);
    expect(isWriteTool({ id: 'c4', name: 'getObjectiveTree', arguments: {} })).toBe(false);
  });

  it('demande l’accord dans la voix d’Empreinte, avec les insécables de la typographie française', () => {
    expect(permissionPrompt({ kind: 'stage', title: 'Portfolio', parentId: 'o' })).toBe(
      `Je te propose d'ajouter l'étape «${NBSP}Portfolio${NBSP}». On l'ajoute${NBSP}?`,
    );
    expect(
      permissionPrompt({ kind: 'task', title: 'Écrire le CV', objectiveId: 'e1' }, () => 'Candidatures'),
    ).toBe(
      typeset("Je te propose d'ajouter le pas « Écrire le CV » à l'étape « Candidatures ». On l'ajoute ?"),
    );
    expect(permissionPrompt({ kind: 'task', title: '', objectiveId: null })).toBe(
      typeset("Je te propose d'ajouter un pas. On l'ajoute ?"),
    );
  });

  it('invite à commencer : la phrase est typographiée, le message part comme la personne l’écrirait', () => {
    const invitation = objectiveInvitation('Décrocher un stage');
    expect(invitation.phrase).toBe(
      typeset('Je peux te proposer des étapes pour « Décrocher un stage ». On commence ?'),
    );
    expect(invitation.action).toBe('Propose-moi des étapes');
    expect(invitation.message).toBe('Propose-moi des étapes pour « Décrocher un stage ».');
    expect(stageInvitation('Portfolio').message).toBe("Propose-moi des pas pour l'étape « Portfolio ».");
  });
});

describe('la conversation', () => {
  it('dit qui parle, dans l’ordre', () => {
    const messages = toThreadMessages(
      [
        { id: 'm2', sender: 'AI', content: 'Bonjour', createdAt: at(2) },
        { id: 'm1', sender: USER, content: 'Salut', createdAt: at(1) },
      ],
      USER,
    );
    expect(messages.map((message) => [message.id, message.speaker])).toEqual([
      ['m1', 'personne'],
      ['m2', 'akari'],
    ]);
  });

  it('remplace le message optimiste par celui enregistré, et ne double jamais un message', () => {
    const pending = pendingMessage('Propose-moi des étapes', 1, new Date(2026, 9, 19, 10, 5));
    const first = upsertRegisteredMessage(
      [pending],
      { id: 'm9', sender: USER, content: 'Propose-moi des étapes', createdAt: at(5) },
      USER,
    );
    expect(first.messages.map((message) => message.id)).toEqual(['m9']);
    expect(first.added?.speaker).toBe('personne');
    const reply = { id: 'm10', sender: 'AI', content: 'Voici trois étapes.', createdAt: at(6) };
    const second = upsertRegisteredMessage(first.messages, reply, USER);
    expect(second.added?.speaker).toBe('akari');
    expect(upsertRegisteredMessage(second.messages, reply, USER).added).toBeNull();
  });

  it('ajoute l’invitation et la demande d’accord, avec leurs boutons', () => {
    const replies = buildReplies({
      messages: [pendingMessage('Salut', 1)],
      invitation: objectiveInvitation('Décrocher un stage'),
      permission: { kind: 'stage', title: 'Portfolio', parentId: 'o' },
    });
    expect(
      replies.map((reply) => [
        reply.id.startsWith('temp-id-') ? 'optimiste' : reply.id,
        reply.markdown,
        reply.pending,
      ]),
    ).toEqual([
      ['optimiste', true, true],
      [INVITATION_REPLY_ID, false, false],
      [PERMISSION_REPLY_ID, false, false],
    ]);
    expect(replies[2]?.actions).toEqual([
      { id: ACCEPT_ACTION, label: 'Ajouter' },
      { id: DECLINE_ACTION, label: 'Pas maintenant' },
    ]);
  });

  it('écrit les messages avec la typographie française, sans toucher au message enregistré', () => {
    const message = pendingMessage('On regarde l’étape « Fractionné » ?', 1);
    const [reply] = buildReplies({ messages: [message], invitation: null, permission: null });
    expect(reply?.text).toBe(`On regarde l’étape «${NBSP}Fractionné${NBSP}»${NBSP}?`);
    expect(message.text).toBe('On regarde l’étape « Fractionné » ?');
  });

  it('pose le journal après les messages, avant la demande d’accord', () => {
    const replies = buildReplies({
      messages: [pendingMessage('Ajoute un pas', 1)],
      invitation: null,
      journal: ["J'ai noté ton message."],
      permission: { kind: 'stage', title: 'Portfolio', parentId: 'o' },
    });

    expect(replies.map((reply) => reply.id)).toEqual([
      expect.any(String),
      JOURNAL_REPLY_ID,
      PERMISSION_REPLY_ID,
    ]);
    expect(replies[1]).toMatchObject({ speaker: 'akari', journal: ["J'ai noté ton message."], actions: [] });
    expect(buildReplies({ messages: [], invitation: null, journal: [], permission: null })).toEqual([]);
  });

  it('écrit la ligne d’état', () => {
    const base = {
      loadingHistory: false,
      awaitingPermission: false,
      processing: false,
      activity: undefined,
      interrupted: false,
    };
    expect(statusLine({ ...base, loadingHistory: true })).toBe(AKARI_TEXTS.readingHistory);
    expect(statusLine({ ...base, awaitingPermission: true })).toBe(AKARI_TEXTS.awaitingPermission);
    expect(statusLine({ ...base, processing: true, activity: activity('saving-reply') })).toBe(
      'Akari écrit sa réponse…',
    );
    expect(statusLine({ ...base, interrupted: true })).toBe(AKARI_TEXTS.lastTurnInterrupted);
    expect(statusLine(base)).toBe('');
  });
});
