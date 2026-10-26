import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { AKARI_TEXTS } from '@/domain/akari/conversation';
import { failureReport } from '@/domain/objectives/messages';
import type { ObjectivesSnapshot } from '@/domain/objectives/objective';
import { CLIENT_ERRORS, FailureError } from '@/domain/shared/result';
import type { AnnouncementCenter } from '@/application/announcements/announcement-center';

/*
 * Les lectures qui n'aboutissent pas, signalées une fois (après les nouvelles tentatives de TanStack Query),
 * comme le font les stores du client web :
 * - le premier chargement des objectifs ; un rechargement de fond, lui, se tait : l'écran garde ce qu'il montre
 *   et le prochain retour au premier plan relira (un rechargement demandé, en tirant l'écran, est signalé par
 *   `useObjectives`) ;
 * - l'historique d'une conversation avec Akari, et l'état de son workflow.
 */

const isObjectivesKey = (key: QueryKey) => key[0] === 'objectives';
const isAkariKey = (key: QueryKey, part: 'messages' | 'state') => key[0] === 'akari' && key[3] === part;

const codeOf = (error: unknown) => (error instanceof FailureError ? error.failure.code : undefined);

/** Écoute le cache et signale ce qui n'a pas pu être lu ; rend de quoi arrêter. */
export function reportLoadFailures(queryClient: QueryClient, announcements: AnnouncementCenter): () => void {
  return queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || event.action.type !== 'error') return;
    const { queryKey } = event.query;
    const error = event.action.error;
    // Plus de session : l'écran de connexion le dit, rien d'autre n'est à signaler.
    if (codeOf(error) === CLIENT_ERRORS.signedOut) return;
    if (isObjectivesKey(queryKey)) {
      const snapshot = event.query.state.data as ObjectivesSnapshot | undefined;
      if (!snapshot?.loaded) announcements.report(failureReport('loadObjectives', codeOf(error)));
    } else if (isAkariKey(queryKey, 'messages')) {
      announcements.report(AKARI_TEXTS.loadConversation);
    } else if (isAkariKey(queryKey, 'state')) {
      announcements.report(AKARI_TEXTS.startConversation);
    }
  });
}
