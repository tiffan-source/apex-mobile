import type { Failure } from '../shared/result';
import { CLIENT_ERRORS } from '../shared/result';
import { typesetTexts } from '../shared/typography';

/*
 * La connexion et la création de compte : ce qu'on vérifie avant d'envoyer, et ce qu'on répond au serveur,
 * dans la voix d'Empreinte (tutoiement, phrases courtes, en encre, avec la solution). Jamais « erreur »,
 * « échec » ni « invalide » ; jamais le message technique du serveur : Apex Brain donne des codes stables
 * (`INVALID_CREDENTIALS`, `USER_ALREADY_EXIST`…), chacun a sa phrase.
 */

/** Se connecter, ou créer son compte. */
export type AuthMode = 'sign-in' | 'create-account';

/** Ce que la personne écrit. La confirmation ne compte qu'à la création d'un compte. */
export type AuthCredentials = {
  readonly email: string;
  readonly password: string;
  readonly confirmPassword: string;
};

export const EMPTY_CREDENTIALS: AuthCredentials = { email: '', password: '', confirmPassword: '' };

/** La longueur minimale d'un mot de passe (celle de Supabase, derrière Apex Brain). */
export const PASSWORD_MIN_LENGTH = 6;

/** Ce que disent les champs quand il manque quelque chose. */
export const AUTH_FORM_MESSAGES = typesetTexts({
  emailRequired: 'Écris ton adresse e-mail pour continuer.',
  emailIncomplete: 'Cette adresse semble incomplète. Ajoute la fin, par exemple @gmail.com.',
  passwordRequired: 'Écris ton mot de passe pour continuer.',
  passwordTooShort: `Encore un peu : au moins ${PASSWORD_MIN_LENGTH} caractères.`,
  confirmRequired: 'Recopie ton mot de passe pour le confirmer.',
  passwordMismatch: "Ce n'est pas le même mot de passe. Recopie celui du dessus.",
} as const);

export type AuthField = 'email' | 'password' | 'confirmPassword';

/** Une adresse complète : quelque chose, une arobase, un domaine avec un point. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

/** La validation : une adresse complète, un mot de passe assez long et, à la création, la même confirmation. */
export function validateCredentials(
  mode: AuthMode,
  values: AuthCredentials,
): Partial<Record<AuthField, string>> {
  const errors: Partial<Record<AuthField, string>> = {};
  const email = values.email.trim();
  if (!email) errors.email = AUTH_FORM_MESSAGES.emailRequired;
  else if (!EMAIL.test(email)) errors.email = AUTH_FORM_MESSAGES.emailIncomplete;

  if (!values.password) errors.password = AUTH_FORM_MESSAGES.passwordRequired;
  else if (values.password.length < PASSWORD_MIN_LENGTH)
    errors.password = AUTH_FORM_MESSAGES.passwordTooShort;

  if (mode === 'create-account') {
    if (!values.confirmPassword) errors.confirmPassword = AUTH_FORM_MESSAGES.confirmRequired;
    else if (values.confirmPassword !== values.password)
      errors.confirmPassword = AUTH_FORM_MESSAGES.passwordMismatch;
  }
  return errors;
}

/** Les phrases qui répondent au serveur. */
export const AUTH_SERVER_MESSAGES = typesetTexts({
  wrongCredentials: 'Ce mot de passe ne correspond pas à cette adresse. Vérifie-le, ou crée un compte.',
  accountExists: 'Un compte existe déjà avec cette adresse. Connecte-toi plutôt.',
  emailRejected: "Cette adresse n'est pas acceptée. Vérifie-la, puis réessaie.",
  passwordTooWeak: 'Ce mot de passe est trop simple. Allonge-le, puis réessaie.',
  emailNotConfirmed:
    "Ton adresse n'est pas encore confirmée. Ouvre le lien reçu par e-mail, puis connecte-toi.",
  confirmEmail: 'Confirme ton adresse : ouvre le lien reçu par e-mail, puis connecte-toi.',
  tooManyAttempts: "Trop d'essais à la suite. Attends une minute, puis réessaie.",
  unreachable: "Je n'arrive pas à joindre Apex. Vérifie ta connexion, puis réessaie.",
  signInFallback: "Je n'ai pas pu te connecter. Vérifie ta connexion, puis réessaie.",
  createAccountFallback: "Je n'ai pas pu créer ton compte. Vérifie ta connexion, puis réessaie.",
  sessionEnded: 'Ta session a pris fin. Reconnecte-toi pour continuer.',
} as const);

/** Une réponse du serveur, dite dans la voix, avec le champ qu'elle concerne (null : une note d'Akari). */
export type AuthReport = {
  readonly field: 'email' | 'password' | null;
  readonly text: string;
};

/** La phrase qui répond à un refus du serveur, d'après son code. */
export function authReport(failure: Failure, mode: AuthMode): AuthReport {
  switch (failure.code) {
    case 'INVALID_CREDENTIALS':
      return { field: 'password', text: AUTH_SERVER_MESSAGES.wrongCredentials };
    case 'USER_ALREADY_EXIST':
      return { field: 'email', text: AUTH_SERVER_MESSAGES.accountExists };
    case 'INVALID_EMAIL':
      return { field: 'email', text: AUTH_SERVER_MESSAGES.emailRejected };
    case 'WEAK_PASSWORD':
      return { field: 'password', text: AUTH_SERVER_MESSAGES.passwordTooWeak };
    case 'EMAIL_NOT_CONFIRMED':
      return { field: null, text: AUTH_SERVER_MESSAGES.emailNotConfirmed };
    case 'TOO_MANY_REQUESTS':
      return { field: null, text: AUTH_SERVER_MESSAGES.tooManyAttempts };
    case 'VALIDATION_ERROR': {
      const fields = new Set((failure.details ?? []).map((detail) => detail.path.split('.')[0]));
      if (fields.has('email')) return { field: 'email', text: AUTH_FORM_MESSAGES.emailIncomplete };
      if (fields.has('password')) return { field: 'password', text: AUTH_FORM_MESSAGES.passwordRequired };
      break;
    }
    case CLIENT_ERRORS.unreachable:
    case CLIENT_ERRORS.timeout:
      return { field: null, text: AUTH_SERVER_MESSAGES.unreachable };
  }
  return {
    field: null,
    text:
      mode === 'sign-in' ? AUTH_SERVER_MESSAGES.signInFallback : AUTH_SERVER_MESSAGES.createAccountFallback,
  };
}
