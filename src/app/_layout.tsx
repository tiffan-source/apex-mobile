import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';
import { createProductionServices } from '@/composition/production';
import { AppProviders } from '@/features/shell/app-providers';
import { RootNavigator } from '@/features/shell/root-navigator';
import { createQueryClient } from '@/state/query-client';

// L'écran de lancement reste jusqu'à ce que le thème, les polices et la session soient prêts (AppProviders).
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

/** La racine : la racine de composition (les services branchés sur Apex Brain et l'appareil), puis la navigation. */
export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);
  const [services] = useState(() => createProductionServices(queryClient));
  return (
    <AppProviders services={services} queryClient={queryClient}>
      <RootNavigator />
    </AppProviders>
  );
}
