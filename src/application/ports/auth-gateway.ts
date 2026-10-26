import type { Result } from '@/domain/shared/result';
import type { Session, User } from '@/domain/session/user';

/*
 * L'authentification d'Apex Brain (`/v1/auth/*`). Le port est sans état : les opérations qui demandent une
 * session reçoivent le jeton, qu'aucun client authentifié n'injecte ici (la session en dépend elle-même).
 */

export type Credentials = {
  readonly email: string;
  readonly password: string;
};

/** Une session ouverte. */
export type SignedIn = {
  readonly user: User;
  readonly session: Session;
};

/** Un compte créé ; la session vaut null tant que l'adresse e-mail doit être confirmée. */
export type Registered = {
  readonly user: User;
  readonly session: Session | null;
};

export interface AuthGateway {
  /** `POST /v1/auth/register` */
  register(credentials: Credentials): Promise<Result<Registered>>;
  /** `POST /v1/auth/login` */
  login(credentials: Credentials): Promise<Result<SignedIn>>;
  /** `POST /v1/auth/refresh` : une nouvelle session à partir du jeton de renouvellement. */
  refresh(refreshToken: string): Promise<Result<SignedIn>>;
  /** `POST /v1/auth/logout` : la session se ferme côté serveur. */
  logout(accessToken: string): Promise<Result<void>>;
  /** `GET /v1/auth/me` : la personne à qui appartient ce jeton. */
  me(accessToken: string): Promise<Result<User>>;
}

/**
 * Ce que les clients authentifiés demandent à la session : un jeton valide pour la requête, et un nouveau
 * jeton quand le serveur a refusé le précédent (`401`). `null` : plus de session, la requête ne part pas.
 */
export interface AccessTokenProvider {
  accessToken(): Promise<string | null>;
  renewAfterRejection(rejectedToken: string): Promise<string | null>;
}
