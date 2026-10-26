import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { EmpreinteProvider } from '@empreinte-studio/react-native';
import type { AppServices } from '@/application/services';
import { followAppFocus } from '@/state/query-client';
import { ServicesProvider } from '@/state/services';
import { useThemePreference } from '@/state/theme';

/**
 * Ce qui entoure toute l'application : le cache de TanStack Query, les services, Empreinte (thème retenu,
 * polices, haptique, gardien du sceau). L'écran de lancement reste jusqu'à ce que tout soit prêt : le thème relu
 * (pas d'éclair d'un autre thème), les polices chargées, la session retrouvée (pas d'éclair de la connexion).
 */
export function AppProviders({
  services,
  queryClient,
  loadFonts = true,
  children,
}: {
  readonly services: AppServices;
  readonly queryClient: QueryClient;
  /** Charger les polices d'Empreinte au lancement (les tests s'en passent). */
  readonly loadFonts?: boolean;
  readonly children: ReactNode;
}) {
  const theme = useThemePreference(services.preferences);
  const [fontsReady, setFontsReady] = useState(false);
  const session = useSyncExternalStore(services.session.state.subscribe, () => services.session.state.get());
  const ready = theme.ready && fontsReady && session.status !== 'restoring';

  useEffect(() => {
    void services.session.restore();
  }, [services]);

  useEffect(() => followAppFocus(), []);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!theme.ready) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <ServicesProvider services={services}>
        <EmpreinteProvider
          theme={theme.theme}
          onPreferenceChange={theme.choose}
          chargerPolices={loadFonts}
          onPret={() => setFontsReady(true)}
        >
          {children}
        </EmpreinteProvider>
      </ServicesProvider>
    </QueryClientProvider>
  );
}
