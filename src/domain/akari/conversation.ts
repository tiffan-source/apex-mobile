import { TEMPORARY_ID_PREFIX, isTemporaryId } from '../objectives/snapshot';
import {
  acceptLabel,
  permissionPrompt,
  processingPhrase,
  type AkariInvitation,
  type ConversationMessage,
  type PermissionRequest,
  type WorkflowValue,
} from './assistant';
import { typeset, typesetTexts } from '../shared/typography';

/*
 * La conversation avec Akari, telle que l'écran la montre : les messages (dans l'ordre, dédoublonnés), le
 * message que la personne vient d'envoyer (optimiste, jusqu'à ce que le workflow l'enregistre), puis
 * l'invitation d'Akari ou sa demande d'accord, et la ligne d'état.
 */

/** Qui parle : la personne, ou Akari. */
export type Speaker = 'personne' | 'akari';

/** Un message du fil. */
export type ThreadMessage = {
  readonly id: string;
  readonly speaker: Speaker;
  readonly text: string;
  /** Instant ISO 8601. */
  readonly createdAt: string;
};

/** Le message envoyé n'est pas encore enregistré : il s'écrit en encre douce jusque-là. */
export function isPendingMessage(message: ThreadMessage): boolean {
  return isTemporaryId(message.id);
}

/** Les messages de la conversation, dans l'ordre chronologique. `sender` vaut l'id de la personne, ou `AI`. */
export function toThreadMessages(
  messages: readonly ConversationMessage[],
  userId: string | null,
): ThreadMessage[] {
  return sortThread(
    messages.map((message) => ({
      id: message.id,
      speaker: message.sender === userId ? 'personne' : 'akari',
      text: message.content,
      createdAt: message.createdAt,
    })),
  );
}

/** Dans l'ordre chronologique ; à égalité, l'ordre d'arrivée. */
export function sortThread(messages: readonly ThreadMessage[]): ThreadMessage[] {
  return messages
    .map((message, index) => ({ message, index, time: Date.parse(message.createdAt) || 0 }))
    .sort((a, b) => a.time - b.time || a.index - b.index)
    .map(({ message }) => message);
}

/** Le message que la personne vient d'envoyer, affiché tout de suite. */
export function pendingMessage(text: string, sequence: number, now: Date = new Date()): ThreadMessage {
  return {
    id: `${TEMPORARY_ID_PREFIX}message-${sequence}`,
    speaker: 'personne',
    text,
    createdAt: now.toISOString(),
  };
}

/**
 * Ajoute un message que le workflow vient d'enregistrer, sans recharger la conversation. Le message de la
 * personne était déjà affiché à l'envoi : son id temporaire est remplacé. Dédoublonné par id : les états
 * répétés de l'interrogation n'ajoutent jamais deux fois le même. `added` vaut null s'il était déjà là.
 */
export function upsertRegisteredMessage(
  messages: readonly ThreadMessage[],
  registered: ConversationMessage,
  userId: string | null,
): { messages: ThreadMessage[]; added: ThreadMessage | null } {
  if (messages.some((message) => message.id === registered.id))
    return { messages: [...messages], added: null };

  const added: ThreadMessage = {
    id: registered.id,
    speaker: registered.sender === userId ? 'personne' : 'akari',
    text: registered.content,
    createdAt: registered.createdAt,
  };

  if (added.speaker === 'personne') {
    const optimistic = messages.findIndex(
      (message) => message.speaker === 'personne' && isPendingMessage(message) && message.text === added.text,
    );
    if (optimistic !== -1) {
      const reconciled = [...messages];
      reconciled[optimistic] = added;
      return { messages: reconciled, added };
    }
  }

  return { messages: sortThread([...messages, added]), added };
}

// #region Le fil tel que l'écran le montre

/** Une action sous une réplique. */
export type ReplyAction = { readonly id: string; readonly label: string };

/** Une réplique du fil : un message, l'invitation d'Akari, ou sa demande d'accord. */
export type Reply = {
  readonly id: string;
  readonly speaker: Speaker;
  /** Ce que l'écran écrit, avec la typographie française ; le message enregistré, lui, ne change pas. */
  readonly text: string;
  /** Un message de la conversation, rendu en Markdown ; les phrases de l'écran restent du texte. */
  readonly markdown: boolean;
  /** Pas encore enregistré. */
  readonly pending: boolean;
  readonly actions: readonly ReplyAction[];
  /** L'invitation qu'accepte son bouton. */
  readonly invitation?: AkariInvitation;
};

export const INVITATION_REPLY_ID = 'akari-invitation';
export const PERMISSION_REPLY_ID = 'akari-demande';
export const ACCEPT_ACTION = 'accepter';
export const DECLINE_ACTION = 'pas-maintenant';

/** Les répliques : les messages, puis l'invitation d'Akari ou sa demande d'accord, avec leurs boutons. */
export function buildReplies(input: {
  messages: readonly ThreadMessage[];
  invitation: AkariInvitation | null;
  permission: PermissionRequest | null;
  stageTitleOf?: (id: string) => string | undefined;
}): Reply[] {
  const replies: Reply[] = input.messages.map((message) => ({
    id: message.id,
    speaker: message.speaker,
    text: typeset(message.text),
    markdown: true,
    pending: isPendingMessage(message),
    actions: [],
  }));
  if (input.invitation) {
    replies.push({
      id: INVITATION_REPLY_ID,
      speaker: 'akari',
      text: input.invitation.phrase,
      markdown: false,
      pending: false,
      actions: [{ id: ACCEPT_ACTION, label: input.invitation.action }],
      invitation: input.invitation,
    });
  }
  if (input.permission) {
    replies.push({
      id: PERMISSION_REPLY_ID,
      speaker: 'akari',
      text: permissionPrompt(input.permission, input.stageTitleOf),
      markdown: false,
      pending: false,
      actions: [
        { id: ACCEPT_ACTION, label: acceptLabel(input.permission) },
        { id: DECLINE_ACTION, label: 'Pas maintenant' },
      ],
    });
  }
  return replies;
}

/** Les phrases de la ligne d'état et des signalements de la conversation. */
export const AKARI_TEXTS = typesetTexts({
  readingHistory: 'Akari relit la conversation…',
  awaitingPermission: 'Akari attend ton accord.',
  lastTurnInterrupted: "Akari n'a pas pu te répondre cette fois. Renvoie ton message quand tu veux.",
  replied: 'Akari a répondu.',
  loadConversation: "Je n'ai pas pu retrouver notre conversation. Vérifie ta connexion, puis réessaie.",
  startConversation: "Je n'arrive pas à te répondre pour l'instant. Vérifie ta connexion, puis réessaie.",
  busy: 'Akari finit de te répondre. Attends un instant, puis renvoie ton message.',
  permissionGone: "Cette proposition n'attend plus ta réponse. Akari est passé à la suite.",
} as const);

/** La ligne d'état, sous la conversation (dite aux lecteurs d'écran). */
export function statusLine(input: {
  loadingHistory: boolean;
  awaitingPermission: boolean;
  processing: boolean;
  value: WorkflowValue | undefined;
  interrupted: boolean;
}): string {
  if (input.loadingHistory) return AKARI_TEXTS.readingHistory;
  if (input.awaitingPermission) return AKARI_TEXTS.awaitingPermission;
  if (input.processing) return processingPhrase(input.value);
  if (input.interrupted) return AKARI_TEXTS.lastTurnInterrupted;
  return '';
}

// #endregion
