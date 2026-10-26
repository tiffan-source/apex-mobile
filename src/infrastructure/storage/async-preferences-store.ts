import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PreferenceTheme } from '@empreinte-studio/noyau';
import type { PreferencesStore } from '@/application/ports/platform';

const THEME_KEY = 'apex.preferences.theme';
const THEMES: readonly PreferenceTheme[] = ['jour', 'nuit', 'systeme'];

/** Les préférences de la personne sur l'appareil (rien de secret : AsyncStorage suffit). */
export class AsyncPreferencesStore implements PreferencesStore {
  async readTheme(): Promise<PreferenceTheme | null> {
    const value = await AsyncStorage.getItem(THEME_KEY);
    return THEMES.find((theme) => theme === value) ?? null;
  }

  async writeTheme(theme: PreferenceTheme): Promise<void> {
    await AsyncStorage.setItem(THEME_KEY, theme);
  }
}
