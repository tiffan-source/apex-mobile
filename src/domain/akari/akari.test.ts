import {
  AKARI_STATUS,
  CREATE_STAGE_TOOL,
  CREATE_TASK_TOOL,
  isExecutingTool,
  isWriteTool,
  objectiveInvitation,
  permissionPrompt,
  permissionRequestOf,
  processingPhrase,
  stageInvitation,
} from './assistant';
import { NBSP, typeset } from '../shared/typography';
import {
  ACCEPT_ACTION,
  AKARI_TEXTS,
  DECLINE_ACTION,
  INVITATION_REPLY_ID,
  PERMISSION_REPLY_ID,
  buildReplies,
  pendingMessage,
  statusLine,
  toThreadMessages,
  upsertRegisteredMessage,
} from './conversation';

const USER = 'u1';
const at = (minute: number) => new Date(2026, 9, 19, 10, minute).toISOString();

describe('le workflow d’Akari', () => {
  it('dit ce que fait Akari, étape par étape', () => {
    expect(processingPhrase('SendingPromptToAI')).toBe(AKARI_STATUS.SendingPromptToAI);
    expect(processingPhrase({ ExecutingAllTool: 'ExecutingTool' })).toBe(AKARI_STATUS.ExecutingAllTool);
    expect(processingPhrase('Inconnue')).toBe('Akari réfléchit…');
    expect(isExecutingTool({ ExecutingAllTool: 'ExecutingTool' })).toBe(true);
    expect(isExecutingTool({ ExecutingAllTool: 'WaitingForUserPermission' })).toBe(false);
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

  it('écrit la ligne d’état', () => {
    const base = {
      loadingHistory: false,
      awaitingPermission: false,
      processing: false,
      value: undefined,
      interrupted: false,
    };
    expect(statusLine({ ...base, loadingHistory: true })).toBe(AKARI_TEXTS.readingHistory);
    expect(statusLine({ ...base, awaitingPermission: true })).toBe(AKARI_TEXTS.awaitingPermission);
    expect(statusLine({ ...base, processing: true, value: 'RegisteringAIResponseInConversation' })).toBe(
      'Akari écrit sa réponse…',
    );
    expect(statusLine({ ...base, interrupted: true })).toBe(AKARI_TEXTS.lastTurnInterrupted);
    expect(statusLine(base)).toBe('');
  });
});
