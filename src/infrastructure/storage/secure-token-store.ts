import * as SecureStore from 'expo-secure-store';
import type { StoredSession, TokenStore } from '@/application/ports/platform';
import { SESSION_KEY, parseStoredSession } from './stored-session';

/**
 * La session dans le coffre de l'appareil : le trousseau sur iOS, le Keystore sur Android. Elle reste sur cet
 * appareil (pas de migration vers un nouveau téléphone) et se lit après le premier déverrouillage, pour qu'un
 * lancement en arrière-plan la retrouve.
 */
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export class SecureTokenStore implements TokenStore {
  async read(): Promise<StoredSession | null> {
    return parseStoredSession(await SecureStore.getItemAsync(SESSION_KEY, OPTIONS));
  }

  async write(stored: StoredSession): Promise<void> {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(stored), OPTIONS);
  }

  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(SESSION_KEY, OPTIONS);
  }
}
