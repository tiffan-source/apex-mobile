import type { AkariWritesWatcher } from './akari/akari-writes';
import type { AnnouncementCenter } from './announcements/announcement-center';
import type { ObjectiveCommands } from './objectives/objective-commands';
import type { ObjectivesLoader } from './objectives/objectives-loader';
import type { AssistantGateway } from './ports/assistant-gateway';
import type { PreferencesStore } from './ports/platform';
import type { SessionManager } from './session/session-manager';

/**
 * Ce que l'application offre aux écrans, assemblé par la racine de composition (`src/composition`) : les
 * écrans ne connaissent que ces services et les ports, jamais leurs adaptateurs.
 */
export type AppServices = {
  readonly session: SessionManager;
  readonly objectives: {
    readonly loader: ObjectivesLoader;
    readonly commands: ObjectiveCommands;
  };
  readonly assistant: AssistantGateway;
  readonly akariWrites: AkariWritesWatcher;
  readonly announcements: AnnouncementCenter;
  readonly preferences: PreferencesStore;
};
