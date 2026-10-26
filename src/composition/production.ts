import type { QueryClient } from '@tanstack/react-query';
import type { AppServices } from '@/application/services';
import { NativeAnnouncer } from '@/infrastructure/accessibility/native-announcer';
import { HttpAssistantGateway } from '@/infrastructure/apex-brain/http-assistant-gateway';
import { HttpAuthGateway } from '@/infrastructure/apex-brain/http-auth-gateway';
import { HttpObjectivesGateway } from '@/infrastructure/apex-brain/http-objectives-gateway';
import { resolveApiUrl } from '@/infrastructure/config/api-url';
import { createApexClient } from '@/infrastructure/http/apex-client';
import { AsyncPreferencesStore } from '@/infrastructure/storage/async-preferences-store';
import { SecureTokenStore } from '@/infrastructure/storage/secure-token-store';
import { assembleServices } from './assemble-services';

/** Les services branchés sur Apex Brain, le coffre de l'appareil et les lecteurs d'écran. */
export function createProductionServices(queryClient: QueryClient): AppServices {
  const baseUrl = resolveApiUrl();
  return assembleServices(
    {
      auth: new HttpAuthGateway(createApexClient({ baseUrl })),
      tokens: new SecureTokenStore(),
      preferences: new AsyncPreferencesStore(),
      announcer: new NativeAnnouncer(),
      gateways: (session) => {
        const client = createApexClient({ baseUrl, tokens: session });
        return { objectives: new HttpObjectivesGateway(client), assistant: new HttpAssistantGateway(client) };
      },
    },
    queryClient,
  );
}
