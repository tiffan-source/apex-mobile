import { QueryClient, focusManager } from '@tanstack/react-query';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { FailureError, isConnectivityFailure } from '@/domain/shared/result';

/**
 * Le cache des données d'Apex Brain. Une lecture qui échoue faute de réseau est retentée deux fois ; un refus du
 * serveur (introuvable, plus de session) ne l'est pas. Les écritures ne passent pas par TanStack Query mais par
 * les commandes de l'application et leur file (`ObjectiveCommands`).
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error) =>
          failureCount < 2 && (!(error instanceof FailureError) || isConnectivityFailure(error.failure)),
      },
    },
  });
}

/**
 * Au retour au premier plan, les données périmées se relisent (TanStack Query écoute le focus de la fenêtre sur
 * le web ; sur iOS et Android, c'est l'état de l'application). Rend de quoi arrêter.
 */
export function followAppFocus(): () => void {
  if (Platform.OS === 'web') return () => undefined;
  const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
    focusManager.setFocused(status === 'active');
  });
  return () => subscription.remove();
}
