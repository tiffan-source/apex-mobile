import type { PreferenceTheme } from '@empreinte-studio/noyau';
import type { Session, User } from '@/domain/session/user';

/*
 * Ce que l'application demande à la plateforme : garder la session à l'abri, retenir les préférences,
 * parler aux lecteurs d'écran, lire l'heure. Les adaptateurs vivent dans l'infrastructure.
 */

/** La session retenue entre deux lancements, avec la personne (pour l'afficher sans attendre le réseau). */
export type StoredSession = {
  readonly session: Session;
  readonly user: User;
};

/** Le coffre de la session : le trousseau sur iOS, le Keystore sur Android. */
export interface TokenStore {
  read(): Promise<StoredSession | null>;
  write(stored: StoredSession): Promise<void>;
  clear(): Promise<void>;
}

/** Les préférences de la personne, sur l'appareil. */
export interface PreferencesStore {
  readTheme(): Promise<PreferenceTheme | null>;
  writeTheme(theme: PreferenceTheme): Promise<void>;
}

/** Ce qui est dit aux lecteurs d'écran (VoiceOver, TalkBack) sans rien afficher. */
export interface Announcer {
  announce(text: string, politeness?: 'polite' | 'assertive'): void;
}

/** L'heure, remplaçable dans les tests. */
export interface Clock {
  now(): number;
}

export const SYSTEM_CLOCK: Clock = { now: () => Date.now() };

/** Une minuterie, remplaçable dans les tests. */
export interface Timers {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export const SYSTEM_TIMERS: Timers = {
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};
