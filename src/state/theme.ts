import { useCallback, useEffect, useState } from 'react';
import type { PreferenceTheme } from '@empreinte-studio/noyau';
import type { PreferencesStore } from '@/application/ports/platform';

/**
 * Le thème retenu par la personne (Jour, Nuit, ou comme l'appareil), relu au lancement et retenu à chaque
 * choix. `ready` passe à vrai une fois relu : l'écran de lancement reste jusque-là, sans éclair d'un autre thème.
 */
export function useThemePreference(store: PreferencesStore): {
  readonly theme: PreferenceTheme;
  readonly ready: boolean;
  readonly choose: (theme: PreferenceTheme) => void;
} {
  const [theme, setTheme] = useState<PreferenceTheme>('systeme');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    store
      .readTheme()
      .catch(() => null)
      .then((stored) => {
        if (!active) return;
        if (stored) setTheme(stored);
        setReady(true);
      });
    return () => {
      active = false;
    };
  }, [store]);

  const choose = useCallback(
    (next: PreferenceTheme) => {
      setTheme(next);
      void store.writeTheme(next).catch(() => undefined);
    },
    [store],
  );

  return { theme, ready, choose };
}
