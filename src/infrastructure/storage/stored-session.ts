import type { StoredSession } from '@/application/ports/platform';

/** La clé de la session dans le coffre. */
export const SESSION_KEY = 'apex.session';

/** La session lue dans le coffre, si elle a la forme attendue ; sinon null (une ancienne version, un coffre abîmé). */
export function parseStoredSession(raw: string | null): StoredSession | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredSession> | null;
    const session = value?.session;
    const user = value?.user;
    if (
      typeof session?.accessToken === 'string' &&
      typeof session.refreshToken === 'string' &&
      typeof session.expiresAt === 'string' &&
      typeof user?.id === 'string' &&
      typeof user.email === 'string'
    ) {
      return {
        session: {
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          expiresAt: session.expiresAt,
        },
        user: {
          id: user.id,
          name: typeof user.name === 'string' ? user.name : user.email,
          email: user.email,
        },
      };
    }
  } catch {
    // Illisible : on repart sans session.
  }
  return null;
}
