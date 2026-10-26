import { CLIENT_ERRORS } from '../shared/result';
import { AUTH_FORM_MESSAGES, AUTH_SERVER_MESSAGES, authReport, validateCredentials } from './auth';
import { expiresSoon, identityOf, initialOf } from './user';

describe('les identifiants', () => {
  it('demandent une adresse complète et un mot de passe assez long', () => {
    expect(validateCredentials('sign-in', { email: '', password: '', confirmPassword: '' })).toEqual({
      email: AUTH_FORM_MESSAGES.emailRequired,
      password: AUTH_FORM_MESSAGES.passwordRequired,
    });
    expect(
      validateCredentials('sign-in', { email: 'anlyou@', password: '123', confirmPassword: '' }),
    ).toEqual({
      email: AUTH_FORM_MESSAGES.emailIncomplete,
      password: AUTH_FORM_MESSAGES.passwordTooShort,
    });
    expect(
      validateCredentials('sign-in', { email: ' anlyou@apex.fr ', password: 'secret1', confirmPassword: '' }),
    ).toEqual({});
  });

  it('à la création d’un compte, la même confirmation', () => {
    const values = { email: 'anlyou@apex.fr', password: 'secret1', confirmPassword: 'secret2' };
    expect(validateCredentials('create-account', values)).toEqual({
      confirmPassword: AUTH_FORM_MESSAGES.passwordMismatch,
    });
    expect(validateCredentials('create-account', { ...values, confirmPassword: 'secret1' })).toEqual({});
  });
});

describe('les réponses du serveur', () => {
  const failure = (code: string, details?: { path: string; message: string }[]) => ({
    code,
    message: 'technique',
    ...(details ? { details } : {}),
  });

  it('chaque code a sa phrase, rattachée à son champ', () => {
    expect(authReport(failure('INVALID_CREDENTIALS'), 'sign-in')).toEqual({
      field: 'password',
      text: AUTH_SERVER_MESSAGES.wrongCredentials,
    });
    expect(authReport(failure('USER_ALREADY_EXIST'), 'create-account').field).toBe('email');
    expect(authReport(failure('EMAIL_NOT_CONFIRMED'), 'sign-in')).toEqual({
      field: null,
      text: AUTH_SERVER_MESSAGES.emailNotConfirmed,
    });
    expect(
      authReport(failure('VALIDATION_ERROR', [{ path: 'email', message: 'Invalid email' }]), 'sign-in').field,
    ).toBe('email');
    expect(authReport(failure(CLIENT_ERRORS.unreachable), 'sign-in').text).toBe(
      AUTH_SERVER_MESSAGES.unreachable,
    );
  });

  it('jamais le message technique : un code inconnu donne la phrase de repli', () => {
    expect(authReport(failure('UNKNOWN_ERROR'), 'sign-in').text).toBe(AUTH_SERVER_MESSAGES.signInFallback);
    expect(authReport(failure('UNKNOWN_ERROR'), 'create-account').text).toBe(
      AUTH_SERVER_MESSAGES.createAccountFallback,
    );
  });
});

describe('la personne et sa session', () => {
  it('se nomme par son nom, sinon son adresse', () => {
    expect(identityOf({ id: '1', name: ' ', email: 'anlyou@apex.fr' })).toBe('anlyou@apex.fr');
    expect(initialOf({ id: '1', name: 'élodie', email: '' })).toBe('É');
    expect(initialOf(null)).toBe('');
  });

  it('sait quand renouveler le jeton', () => {
    const now = Date.parse('2026-10-25T20:00:00.000Z');
    const session = { accessToken: 'a', refreshToken: 'r', expiresAt: '2026-10-25T20:00:30.000Z' };
    expect(expiresSoon(session, now, 60_000)).toBe(true);
    expect(expiresSoon({ ...session, expiresAt: '2026-10-25T21:00:00.000Z' }, now, 60_000)).toBe(false);
    expect(expiresSoon({ ...session, expiresAt: 'illisible' }, now, 60_000)).toBe(true);
  });
});
