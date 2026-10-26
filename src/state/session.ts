import { useMemo, useSyncExternalStore } from 'react';
import type { User } from '@/domain/session/user';
import type { SessionManager, SessionState } from '@/application/session/session-manager';
import { useServices } from './services';

/** L'état de la session : en cours de restauration, ouverte (avec la personne), ou fermée. */
export function useSession(): SessionState {
  const { session } = useServices();
  return useSyncExternalStore(session.state.subscribe, () => session.state.get());
}

/** La personne connectée, ou null. */
export function useCurrentUser(): User | null {
  const state = useSession();
  return state.status === 'signed-in' ? state.user : null;
}

/** Ouvrir ou fermer la session (l'écran de connexion, les réglages). */
export function useSessionActions(): Pick<SessionManager, 'signIn' | 'signUp' | 'signOut'> {
  const { session } = useServices();
  return useMemo(
    () => ({
      signIn: (credentials) => session.signIn(credentials),
      signUp: (credentials) => session.signUp(credentials),
      signOut: () => session.signOut(),
    }),
    [session],
  );
}
