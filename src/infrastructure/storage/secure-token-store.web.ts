import type { StoredSession, TokenStore } from '@/application/ports/platform';
import { SESSION_KEY, parseStoredSession } from './stored-session';

/**
 * L'aperçu web (développement seulement) : le navigateur n'a pas de coffre, la session va dans le stockage de
 * la session de l'onglet. Apex n'est pas livré sur le web : le client web d'Apex est l'application Angular.
 */
export class SecureTokenStore implements TokenStore {
  async read(): Promise<StoredSession | null> {
    return parseStoredSession(globalThis.sessionStorage?.getItem(SESSION_KEY) ?? null);
  }

  async write(stored: StoredSession): Promise<void> {
    globalThis.sessionStorage?.setItem(SESSION_KEY, JSON.stringify(stored));
  }

  async clear(): Promise<void> {
    globalThis.sessionStorage?.removeItem(SESSION_KEY);
  }
}
