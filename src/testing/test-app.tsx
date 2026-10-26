import { QueryClient } from '@tanstack/react-query';
import { renderRouter, type RenderRouterResult } from 'expo-router/testing-library';
import type { AppServices } from '@/application/services';
import type { Timers } from '@/application/ports/platform';
import { assembleServices } from '@/composition/assemble-services';
import { AppProviders } from '@/features/shell/app-providers';
import { RootNavigator } from '@/features/shell/root-navigator';
import {
  ALICE,
  FakeClock,
  InMemoryAuthGateway,
  InMemoryPreferencesStore,
  InMemoryTokenStore,
  RecordingAnnouncer,
  ScriptedAssistantGateway,
} from './fakes';
import { InMemoryObjectivesGateway } from './in-memory-objectives-gateway';

/*
 * L'application entière sur des doublures en mémoire : les vraies routes (`src/app`), les vrais écrans et les
 * vrais services, assemblés comme en production par `assembleServices`, mais branchés sur un Apex Brain en
 * mémoire. Seule la route racine est remplacée, pour y poser ces services.
 */

export type TestApp = {
  readonly services: AppServices;
  readonly queryClient: QueryClient;
  readonly objectives: InMemoryObjectivesGateway;
  readonly assistant: ScriptedAssistantGateway;
  readonly auth: InMemoryAuthGateway;
  readonly tokens: InMemoryTokenStore;
  readonly preferences: InMemoryPreferencesStore;
  readonly announcer: RecordingAnnouncer;
  readonly clock: FakeClock;
};

/** L'interrogation d'Akari sans attendre la seconde entre deux lectures : les tests ne dorment pas. */
const IMMEDIATE_TIMERS: Timers = {
  setTimeout: (callback) => setTimeout(callback, 0),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export function createTestApp({ signedIn = true }: { readonly signedIn?: boolean } = {}): TestApp {
  const clock = new FakeClock(Date.now());
  const auth = new InMemoryAuthGateway(clock);
  auth.addAccount(ALICE.email, 'mot-de-passe', ALICE);
  const tokens = new InMemoryTokenStore(signedIn ? { session: auth.issue(), user: ALICE } : null);
  const preferences = new InMemoryPreferencesStore();
  const announcer = new RecordingAnnouncer();
  const objectives = new InMemoryObjectivesGateway();
  const assistant = new ScriptedAssistantGateway();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY, staleTime: 30_000 } },
  });
  const services = assembleServices(
    {
      auth,
      tokens,
      preferences,
      announcer,
      clock,
      timers: IMMEDIATE_TIMERS,
      gateways: () => ({ objectives, assistant }),
    },
    queryClient,
  );
  return { services, queryClient, objectives, assistant, auth, tokens, preferences, announcer, clock };
}

/** Ouvre l'application à cette adresse (avec les minuteries simulées de `renderRouter`). */
export async function renderApp(app: TestApp, initialUrl = '/'): Promise<RenderRouterResult> {
  function TestRootLayout() {
    return (
      <AppProviders services={app.services} queryClient={app.queryClient} loadFonts={false}>
        <RootNavigator />
      </AppProviders>
    );
  }
  return renderRouter({ appDir: 'src/app', overrides: { _layout: TestRootLayout } }, { initialUrl });
}
