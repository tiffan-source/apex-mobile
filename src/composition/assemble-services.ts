import type { QueryClient } from '@tanstack/react-query';
import { AkariWritesWatcher } from '@/application/akari/akari-writes';
import { AnnouncementCenter } from '@/application/announcements/announcement-center';
import { createTemporaryIds } from '@/application/objectives/objectives-cache';
import { ObjectiveCommands } from '@/application/objectives/objective-commands';
import { ObjectivesLoader } from '@/application/objectives/objectives-loader';
import { WriteQueue } from '@/application/objectives/write-queue';
import type { AssistantGateway } from '@/application/ports/assistant-gateway';
import type { AccessTokenProvider, AuthGateway } from '@/application/ports/auth-gateway';
import type { ObjectivesGateway } from '@/application/ports/objectives-gateway';
import type { Announcer, Clock, PreferencesStore, Timers, TokenStore } from '@/application/ports/platform';
import type { AppServices } from '@/application/services';
import { SessionManager } from '@/application/session/session-manager';
import { reportLoadFailures } from '@/state/load-failure-reports';
import { createQueryObjectivesCache } from '@/state/objectives';
import { OBJECTIVES_ROOT_KEY, queryKeys } from '@/state/query-keys';

/** Les adaptateurs de la plateforme et du serveur, que l'application ne connaît que par leurs ports. */
export type Adapters = {
  readonly auth: AuthGateway;
  readonly tokens: TokenStore;
  readonly preferences: PreferencesStore;
  readonly announcer: Announcer;
  /** Les passerelles dont les requêtes portent la session. */
  readonly gateways: (session: AccessTokenProvider) => {
    readonly objectives: ObjectivesGateway;
    readonly assistant: AssistantGateway;
  };
  readonly clock?: Clock;
  readonly timers?: Timers;
};

/**
 * La racine de composition : le seul endroit où les ports rencontrent leurs adaptateurs, comme
 * `apps/apex-client/src/chore/providers` dans Apex et `ProductionAdaptersModule` dans Apex Brain. Les tests
 * assemblent les mêmes services sur des doublures en mémoire.
 */
export function assembleServices(adapters: Adapters, queryClient: QueryClient): AppServices {
  const session = new SessionManager({
    auth: adapters.auth,
    tokens: adapters.tokens,
    ...(adapters.clock ? { clock: adapters.clock } : {}),
  });
  const gateways = adapters.gateways(session);
  const announcements = new AnnouncementCenter(adapters.announcer);
  // Une lecture qui n'aboutit pas (le premier chargement des objectifs, une conversation) est signalée une fois.
  reportLoadFailures(queryClient, announcements);
  const writes = new WriteQueue();
  const cache = createQueryObjectivesCache(queryClient, () => {
    const user = session.user;
    return user ? queryKeys.objectives(user.id) : null;
  });
  const commands = new ObjectiveCommands({
    gateway: gateways.objectives,
    cache,
    writes,
    announcements,
    ids: createTemporaryIds(),
  });
  const loader = new ObjectivesLoader({ gateway: gateways.objectives, writes, cache });
  const akariWrites = new AkariWritesWatcher({
    assistant: gateways.assistant,
    onObjectivesChanged: () => void queryClient.invalidateQueries({ queryKey: OBJECTIVES_ROOT_KEY }),
    ...(adapters.timers ? { timers: adapters.timers } : {}),
  });

  // Une session qui se ferme emporte tout ce qui lui appartenait : ce qui attend dans la file ne part plus.
  session.onSignedOut(() => {
    akariWrites.stop();
    writes.close();
    commands.forget();
    queryClient.clear();
    announcements.acknowledge();
  });

  return {
    session,
    objectives: { loader, commands },
    assistant: gateways.assistant,
    akariWrites,
    announcements,
    preferences: adapters.preferences,
  };
}
