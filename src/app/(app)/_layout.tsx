import { Stack } from 'expo-router';
import { useTheme } from '@empreinte-studio/react-native';

/** Les onglets sont la base de la pile : les écrans d'un objectif et les feuilles s'empilent au-dessus. */
export const unstable_settings = { anchor: '(onglets)' };

/**
 * Une feuille se pose sur l'écran qui l'ouvre, transparente : elle dessine elle-même son voile et se déplie
 * (`Feuille`). Le geste de retour d'Android la referme.
 */
const SHEET = {
  presentation: 'transparentModal',
  animation: 'none',
  contentStyle: { backgroundColor: 'transparent' },
} as const;

export default function AppLayout() {
  const { couleurs } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: couleurs.fond } }}>
      <Stack.Screen name="(onglets)" />
      <Stack.Screen name="objectifs/nouveau" />
      <Stack.Screen name="objectifs/[id]/index" />
      <Stack.Screen name="objectifs/[id]/akari" />
      <Stack.Screen name="objectifs/[id]/modifier" options={SHEET} />
      <Stack.Screen name="objectifs/[id]/nouvelle-etape" options={SHEET} />
      <Stack.Screen name="etapes/[id]/modifier" options={SHEET} />
      <Stack.Screen name="etapes/[id]/nouveau-pas" options={SHEET} />
      <Stack.Screen name="pas/[id]/modifier" options={SHEET} />
      <Stack.Screen name="reglages" options={SHEET} />
    </Stack>
  );
}
