import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** Le port d'Apex Brain en développement (`npx nx serve api`). */
export const DEV_API_PORT = 3000;

/**
 * L'adresse d'Apex Brain.
 *
 * - `EXPO_PUBLIC_APEX_API_URL` d'abord (inscrite à la construction : `.env`, profil EAS) ;
 * - en développement, sinon, l'ordinateur qui sert Metro, sur le port 3000 : un téléphone du même réseau le
 *   joint par son adresse locale, comme il joint Metro ;
 * - à défaut, l'émulateur Android voit l'ordinateur en 10.0.2.2, le simulateur iOS en localhost.
 *
 * En production, l'adresse doit être fournie : sans elle, l'application refuse de démarrer plutôt que
 * d'appeler une adresse au hasard.
 */
export function resolveApiUrl(
  env: {
    readonly configured?: string;
    readonly hostUri?: string | null;
    readonly dev: boolean;
    readonly os: string;
  } = {
    configured: process.env.EXPO_PUBLIC_APEX_API_URL,
    hostUri: Constants.expoConfig?.hostUri ?? null,
    dev: __DEV__,
    os: Platform.OS,
  },
): string {
  const configured = env.configured?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  if (!env.dev) {
    throw new Error(
      "EXPO_PUBLIC_APEX_API_URL manque : l'adresse d'Apex Brain doit être fournie à la construction.",
    );
  }
  const host = env.hostUri?.split(':')[0];
  if (host && host !== 'localhost' && host !== '127.0.0.1') return `http://${host}:${DEV_API_PORT}`;
  return env.os === 'android' ? `http://10.0.2.2:${DEV_API_PORT}` : `http://localhost:${DEV_API_PORT}`;
}
