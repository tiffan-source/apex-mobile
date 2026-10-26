import type { Result } from '@/domain/shared/result';
import type { User } from '@/domain/session/user';
import type { AuthGateway, Credentials, Registered, SignedIn } from '@/application/ports/auth-gateway';
import { mapResult, type ApexClient } from '../http/apex-client';

/**
 * L'authentification par l'API d'Apex Brain (ADR 0003 d'Apex Brain). Le client est public : le jeton des
 * opérations qui en demandent un est passé à la main, la session ne s'appelle pas elle-même.
 */
export class HttpAuthGateway implements AuthGateway {
  constructor(private readonly client: ApexClient) {}

  register(credentials: Credentials): Promise<Result<Registered>> {
    return mapResult(this.client.POST('/v1/auth/register', { body: credentials }), (data) => ({
      user: data.user,
      session: data.session,
    }));
  }

  login(credentials: Credentials): Promise<Result<SignedIn>> {
    return mapResult(this.client.POST('/v1/auth/login', { body: credentials }), (data) => ({
      user: data.user,
      session: data.session,
    }));
  }

  refresh(refreshToken: string): Promise<Result<SignedIn>> {
    return mapResult(this.client.POST('/v1/auth/refresh', { body: { refreshToken } }), (data) => ({
      user: data.user,
      session: data.session,
    }));
  }

  logout(accessToken: string): Promise<Result<void>> {
    return mapResult(this.client.POST('/v1/auth/logout', { headers: bearer(accessToken) }), () => undefined);
  }

  me(accessToken: string): Promise<Result<User>> {
    return mapResult(this.client.GET('/v1/auth/me', { headers: bearer(accessToken) }), (data) => ({
      id: data.id,
      name: data.name,
      email: data.email,
    }));
  }
}

function bearer(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}` };
}
