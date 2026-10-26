/*
 * La personne connectée, telle qu'Apex Brain la décrit (`GET /v1/auth/me`) : son id, son nom d'affichage
 * (à défaut son adresse e-mail) et son adresse.
 */

export type User = {
  readonly id: string;
  readonly name: string;
  readonly email: string;
};

/** La session ouverte : le jeton d'accès, celui qui le renouvelle, et son échéance (instant ISO 8601). */
export type Session = {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: string;
};

/** Le nom de la personne, sinon son adresse. */
export function identityOf(user: User | null | undefined): string {
  return (user?.name ?? '').trim() || (user?.email ?? '').trim();
}

/** La première lettre du nom, sinon de l'adresse, en capitale. */
export function initialOf(user: User | null | undefined): string {
  return ([...identityOf(user)][0] ?? '').toLocaleUpperCase('fr');
}

/** Vrai si la session expire dans moins de `marginMs` (ou a déjà expiré). */
export function expiresSoon(session: Session, now: number, marginMs: number): boolean {
  const expiresAt = Date.parse(session.expiresAt);
  return Number.isNaN(expiresAt) || expiresAt - now <= marginMs;
}
