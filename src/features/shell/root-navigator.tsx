import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { Stack, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { useTheme } from '@empreinte-studio/react-native';
import { useSession } from '@/state/session';
import { navigationTheme } from './navigation-theme';

/**
 * La navigation de la racine. L'espace d'Apex n'est ouvert qu'avec une session ; sans elle, seule la connexion
 * l'est (`Stack.Protected`) : se connecter mène à l'accueil, une session qui prend fin ramène à la connexion.
 * Rien ne s'affiche tant que la session retenue n'est pas relue (l'écran de lancement reste).
 */
export function RootNavigator() {
  const session = useSession();
  const { couleurs, actif } = useTheme();

  useEffect(() => {
    // Le fond de la fenêtre, derrière les écrans : celui du thème.
    void SystemUI.setBackgroundColorAsync(couleurs.fond).catch(() => undefined);
  }, [couleurs.fond]);

  if (session.status === 'restoring') return null;
  const signedIn = session.status === 'signed-in';

  return (
    <ThemeProvider value={navigationTheme(couleurs, actif === 'nuit')}>
      <StatusBar style={actif === 'nuit' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: couleurs.fond } }}>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="auth" />
        </Stack.Protected>
        <Stack.Screen name="+not-found" />
      </Stack>
    </ThemeProvider>
  );
}
