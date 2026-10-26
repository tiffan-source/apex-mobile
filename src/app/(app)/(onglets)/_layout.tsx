import { Tabs } from 'expo-router/js-tabs';
import { useTheme } from '@empreinte-studio/react-native';
import { SHELL_TEXTS } from '@/features/shell/shell.texts';
import { TabBar } from '@/features/shell/tab-bar';

/** Les deux entrées de la navigation du client web, au pied de l'écran : Objectifs et Matrice. */
export default function TabsLayout() {
  const { couleurs } = useTheme();
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: couleurs.fond } }}
    >
      <Tabs.Screen name="index" options={{ title: SHELL_TEXTS.tabs.objectives }} />
      <Tabs.Screen name="matrice" options={{ title: SHELL_TEXTS.tabs.matrix }} />
    </Tabs>
  );
}
