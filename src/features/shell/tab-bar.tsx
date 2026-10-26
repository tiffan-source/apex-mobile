import type { BottomTabBarProps } from 'expo-router/js-tabs';
import type { NomIcone } from '@empreinte-studio/react-native';
import { BarreOnglets } from '@/ui/barre-onglets';

/** L'icône de chaque onglet, par nom de route. */
const ICONES: Readonly<Record<string, NomIcone>> = {
  index: 'objectifs',
  matrice: 'matrice',
};

/**
 * La barre d'onglets d'Empreinte branchée sur le navigateur d'Expo Router : un toucher sur l'onglet courant ne
 * fait rien ; sur un autre, il y mène (après l'évènement `tabPress`, que l'écran peut intercepter).
 */
export function TabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  return (
    <BarreOnglets
      basSur={insets.bottom}
      onglets={state.routes.map((route, index) => {
        const actif = index === state.index;
        const options = descriptors[route.key]?.options;
        return {
          cle: route.key,
          libelle: options?.title ?? route.name,
          icone: ICONES[route.name] ?? 'objectifs',
          actif,
          testID: `onglet-${route.name}`,
          onPress: () => {
            const evenement = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!actif && !evenement.defaultPrevented) navigateToTab(route.key);
          },
          onLongPress: () => {
            emitter.emit({ type: 'tabLongPress', target: route.key });
          },
        };
      })}
    />
  );
}
