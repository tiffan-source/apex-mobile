import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef } from 'react';
import {
  isWriteTool,
  permissionRequestOf,
  type PermissionRequest,
  type WorkflowState,
  type WorkflowValue,
} from '@/domain/akari/assistant';
import {
  AKARI_TEXTS,
  isPendingMessage,
  pendingMessage,
  toThreadMessages,
  upsertRegisteredMessage,
  type ThreadMessage,
} from '@/domain/akari/conversation';
import { unwrap } from '@/domain/shared/result';
import { AKARI_POLL_INTERVAL_MS } from '@/application/akari/akari-writes';
import { useAnnouncements } from './announcements';
import { queryKeys } from './query-keys';
import { useServices } from './services';
import { useCurrentUser } from './session';

/*
 * La conversation avec Akari sur un objectif : son historique, l'état de son workflow (interrogé chaque seconde
 * pendant un tour, comme le client web), l'envoi d'un message et la réponse à une demande d'accord.
 *
 * L'état que rend un envoi ou une réponse est le plus récent : une lecture de l'état partie avant lui est
 * abandonnée, et l'état n'est pas interrogé tant qu'un envoi est en route (une lecture traitée avant lui
 * ramènerait l'état d'avant : la demande d'accord reviendrait, ou le tour semblerait fini).
 */

export type AkariConversation = {
  readonly messages: readonly ThreadMessage[];
  /** L'historique est là (ou n'a pas pu l'être) : une conversation vide est alors vraiment vide. */
  readonly historyLoaded: boolean;
  readonly historyFailed: boolean;
  /** Akari écoute : l'historique est là et le workflow attend un nouveau message. */
  readonly ready: boolean;
  /** Un tour est en cours. */
  readonly processing: boolean;
  readonly value: WorkflowValue | undefined;
  /** Ce qu'Akari demande la permission d'ajouter, ou null. */
  readonly permission: PermissionRequest | null;
  /** Le dernier tour a été interrompu (IA indisponible…) : la personne peut renvoyer son message. */
  readonly interrupted: boolean;
  /** Envoie un message ; vrai s'il est parti. */
  readonly send: (text: string) => Promise<boolean>;
  /** Accepte ou refuse ce qu'Akari propose. */
  readonly respond: (granted: boolean) => Promise<void>;
  readonly reload: () => void;
};

export function useAkari(objectiveId: string, enabled: boolean): AkariConversation {
  const { assistant, akariWrites, session } = useServices();
  const announcements = useAnnouncements();
  const user = useCurrentUser();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();
  const messagesKey = useMemo(() => queryKeys.akariMessages(userId, objectiveId), [userId, objectiveId]);
  const stateKey = useMemo(() => queryKeys.akariState(userId, objectiveId), [userId, objectiveId]);
  const sequence = useRef(0);
  /** Les envois et réponses en route : l'état n'est pas interrogé pendant ce temps. */
  const sending = useRef(0);

  /** Un état du workflow arrive : son dernier message rejoint le fil, sans recharger la conversation. */
  const absorb = useCallback(
    (previous: WorkflowState | undefined, next: WorkflowState) => {
      const registered = next.lastRegisteredMessage;
      // Sans historique encore chargé, rien à compléter : l'historique, quand il arrive, contient ce message.
      const current = queryClient.getQueryData<ThreadMessage[]>(messagesKey);
      if (!registered || !current) return;
      const { messages, added } = upsertRegisteredMessage(current, registered, userId);
      if (!added) return;
      queryClient.setQueryData<ThreadMessage[]>(messagesKey, messages);
      // Un tour était en cours : un message d'Akari qui arrive est une nouvelle réponse.
      if (added.speaker === 'akari' && previous?.status === 'processing') {
        announcements.announce(AKARI_TEXTS.replied);
      }
    },
    [announcements, messagesKey, queryClient, userId],
  );

  const history = useQuery({
    queryKey: messagesKey,
    queryFn: async () => {
      const conversation = unwrap(await assistant.getConversation(objectiveId));
      const loaded = toThreadMessages(conversation.messages, userId);
      // Un message tout juste envoyé, pas encore enregistré, reste au fil.
      const pending = (queryClient.getQueryData<ThreadMessage[]>(messagesKey) ?? []).filter(
        (message) => isPendingMessage(message) && !loaded.some((item) => item.text === message.text),
      );
      return [...loaded, ...pending];
    },
    enabled: enabled && userId !== null,
    staleTime: 0,
  });

  const workflow = useQuery({
    queryKey: stateKey,
    queryFn: async () => {
      const previous = queryClient.getQueryData<WorkflowState>(stateKey);
      const next = unwrap(await assistant.getState(objectiveId));
      absorb(previous, next);
      return next;
    },
    enabled: enabled && userId !== null,
    staleTime: 0,
    refetchInterval: (query) =>
      query.state.data?.status === 'processing' && sending.current === 0 ? AKARI_POLL_INTERVAL_MS : false,
  });

  /** L'état rendu par un envoi : plus récent que toute lecture partie avant lui, qui est abandonnée. */
  const settle = useCallback(
    async (previous: WorkflowState | undefined, next: WorkflowState) => {
      await queryClient.cancelQueries({ queryKey: stateKey });
      absorb(previous, next);
      queryClient.setQueryData<WorkflowState>(stateKey, next);
    },
    [absorb, queryClient, stateKey],
  );

  /** La session a pris fin (ou une autre a commencé) pendant l'envoi : rien n'est à dire. */
  const sessionChanged = useCallback(() => session.user?.id !== userId, [session, userId]);

  /** Un envoi au workflow, pendant lequel l'état n'est pas interrogé. */
  const post = useCallback(async <T>(call: () => Promise<T>): Promise<T> => {
    sending.current += 1;
    try {
      return await call();
    } finally {
      sending.current -= 1;
    }
  }, []);

  const state = workflow.data;
  const historyLoaded = history.isSuccess || history.isError;

  const send = useCallback(
    async (text: string): Promise<boolean> => {
      const message = text.trim();
      if (!message) return false;
      sequence.current += 1;
      const pending = pendingMessage(message, sequence.current);
      queryClient.setQueryData<ThreadMessage[]>(messagesKey, (current) => [...(current ?? []), pending]);
      const previous = queryClient.getQueryData<WorkflowState>(stateKey);
      const result = await post(() => assistant.sendMessage(objectiveId, message));
      if (sessionChanged()) return false;
      if (!result.success) {
        queryClient.setQueryData<ThreadMessage[]>(messagesKey, (current) =>
          (current ?? []).filter((item) => item.id !== pending.id),
        );
        announcements.report(
          result.error.code === 'WORKFLOW_BUSY' ? AKARI_TEXTS.busy : AKARI_TEXTS.startConversation,
        );
        void workflow.refetch();
        return false;
      }
      await settle(previous, result.data);
      return true;
    },
    [
      announcements,
      assistant,
      messagesKey,
      objectiveId,
      post,
      queryClient,
      sessionChanged,
      settle,
      stateKey,
      workflow,
    ],
  );

  const respond = useCallback(
    async (granted: boolean): Promise<void> => {
      const current = queryClient.getQueryData<WorkflowState>(stateKey);
      const call = current?.pendingToolCall;
      // Un second toucher pendant que la réponse part n'en envoie pas une autre.
      if (!current || !call || sending.current > 0) return;
      const result = await post(async () => {
        // La demande disparaît tout de suite : Akari reprend son tour (interrogé une fois la réponse partie). Une
        // lecture en route est abandonnée d'abord : elle ramènerait la demande.
        await queryClient.cancelQueries({ queryKey: stateKey });
        queryClient.setQueryData<WorkflowState>(stateKey, {
          ...current,
          status: 'processing',
          pendingToolCall: null,
        });
        return assistant.respondToPermission(objectiveId, granted, call.id);
      });
      if (sessionChanged()) return;
      if (!result.success) {
        announcements.report(
          result.error.code === 'NO_PENDING_PERMISSION'
            ? AKARI_TEXTS.permissionGone
            : AKARI_TEXTS.startConversation,
        );
        void workflow.refetch();
        return;
      }
      await settle(current, result.data);
      // Ce qu'Akari ajoute arrive sur l'arête dès que l'outil a fini, même si l'écran est quitté avant.
      if (granted && isWriteTool(call)) akariWrites.watch(objectiveId);
    },
    [
      akariWrites,
      announcements,
      assistant,
      objectiveId,
      post,
      queryClient,
      sessionChanged,
      settle,
      stateKey,
      workflow,
    ],
  );

  const status = state?.status;
  return {
    messages: history.data ?? [],
    historyLoaded,
    historyFailed: history.isError,
    ready: historyLoaded && status === 'ready',
    processing: status === 'processing',
    value: state?.value,
    permission: status === 'awaiting-permission' ? permissionRequestOf(state?.pendingToolCall ?? null) : null,
    interrupted: status === 'ready' && state?.lastError != null,
    send,
    respond,
    reload: () => {
      void history.refetch();
      void workflow.refetch();
    },
  };
}
