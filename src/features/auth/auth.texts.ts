import { PASSWORD_MIN_LENGTH } from '@/domain/session/auth';
import { typesetTexts } from '@/domain/shared/typography';

/**
 * Les textes de la connexion (`/auth`), repris du client web. La bascule est un bouton : moins de 4 mots ; la
 * question qui l'amène est écrite à côté, en détail.
 */
export const AUTH_TEXTS = typesetTexts({
  brand: 'Apex',
  tagline: 'Chaque pas laisse une empreinte.',
  email: 'Ton adresse e-mail',
  password: 'Ton mot de passe',
  confirmPassword: 'Confirme ton mot de passe',
  passwordHelp: `Au moins ${PASSWORD_MIN_LENGTH} caractères.`,
  modes: {
    'sign-in': {
      title: 'Te revoilà.',
      submit: 'Me connecter',
      pending: 'Je te connecte…',
      question: 'Pas encore de compte ?',
      switch: 'Créer un compte',
    },
    'create-account': {
      title: 'Crée ton compte',
      submit: 'Créer mon compte',
      pending: 'Je crée ton compte…',
      question: 'Déjà un compte ?',
      switch: 'Me connecter',
    },
  },
} as const);
