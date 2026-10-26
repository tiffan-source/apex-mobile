import { useRef, useState } from 'react';
import { View, type TextInputInstance } from 'react-native';
import {
  EBouton,
  EChamp,
  EMarque,
  ENote,
  ESaisie,
  ETexte,
  creerStyles,
} from '@empreinte-studio/react-native';
import {
  AUTH_SERVER_MESSAGES,
  EMPTY_CREDENTIALS,
  authReport,
  validateCredentials,
  type AuthCredentials,
  type AuthField,
  type AuthMode,
  type AuthReport,
} from '@/domain/session/auth';
import { useAnnouncements } from '@/state/announcements';
import { useSession, useSessionActions } from '@/state/session';
import { Ecran } from '@/ui/ecran';
import { pas } from '@/ui/fondations';
import { Panneau } from '@/ui/panneau';
import { AUTH_TEXTS as T } from './auth.texts';

const useStyles = creerStyles(() => ({
  formulaire: {
    gap: pas['pas-8'],
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  entete: {
    gap: pas['pas-6'],
  },
  titres: {
    gap: pas['pas-2'],
  },
  champs: {
    gap: pas['pas-4'],
  },
  envoi: {
    gap: pas['pas-3'],
  },
  bascule: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: pas['pas-2'],
  },
}));

/** Ce qui a été envoyé, et la réponse du serveur : elle ne vaut que pour ces valeurs et ce mode. */
type Attempt = {
  readonly mode: AuthMode;
  readonly email: string;
  readonly password: string;
  readonly report: AuthReport;
};

/**
 * La connexion (`/auth`) : la marque, puis « Te revoilà. » ou « Crée ton compte ». Le bouton sceau (le seul de
 * l'écran) connecte ou crée le compte ; une fois la session ouverte, la navigation mène à l'accueil.
 *
 * Ce qui manque s'écrit sous le champ concerné, en encre, avec la solution. Une réponse du serveur est traduite
 * d'après son code : sous le champ qu'elle concerne (qui reçoit le focus), ou dans une note d'Akari au-dessus du
 * bouton. Elle s'efface dès que la personne change ce qu'elle avait envoyé.
 */
export function AuthScreen() {
  const styles = useStyles();
  const session = useSession();
  const { signIn, signUp } = useSessionActions();
  const announcements = useAnnouncements();
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [values, setValues] = useState<AuthCredentials>(EMPTY_CREDENTIALS);
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const emailField = useRef<TextInputInstance>(null);
  const passwordField = useRef<TextInputInstance>(null);
  const confirmField = useRef<TextInputInstance>(null);
  const focus = (field: AuthField) =>
    ({ email: emailField, password: passwordField, confirmPassword: confirmField })[field].current?.focus();

  const texts = T.modes[mode];
  const creating = mode === 'create-account';
  const formErrors = submitted ? validateCredentials(mode, values) : {};
  const report = attempt?.mode === mode ? attempt.report : null;
  // Une adresse refusée vaut tant que l'adresse reste ; un mot de passe refusé, tant que les deux restent.
  const emailKept = attempt?.email === values.email.trim();
  const passwordKept = attempt?.password === values.password;
  const serverError = (field: 'email' | 'password') =>
    report?.field === field && emailKept && (field === 'email' || passwordKept) ? report.text : null;
  const note = report && report.field === null ? report.text : null;
  const ended = session.status === 'signed-out' && session.ended && attempt === null && !awaitingConfirmation;

  const change = (patch: Partial<AuthCredentials>) => setValues((current) => ({ ...current, ...patch }));

  const submit = async () => {
    if (pending) return;
    setSubmitted(true);
    const errors = validateCredentials(mode, values);
    const firstInvalid = (['email', 'password', 'confirmPassword'] as const).find((field) => errors[field]);
    if (firstInvalid) {
      focus(firstInvalid);
      return;
    }
    const sent = { email: values.email.trim(), password: values.password };
    setPending(true);
    setAwaitingConfirmation(false);
    const result = mode === 'sign-in' ? await signIn(sent) : await signUp(sent);
    setPending(false);
    if (!result.success) {
      const answer = authReport(result.error, mode);
      setAttempt({ mode, ...sent, report: answer });
      // Sous un champ, le message est lu avec lui quand il prend le focus ; sinon, la note d'Akari est dite.
      if (answer.field) focus(answer.field);
      else announcements.announce(answer.text);
      return;
    }
    // Compte créé, mais l'adresse attend sa confirmation : la personne se connectera ensuite.
    if ('awaitingConfirmation' in result.data && result.data.awaitingConfirmation) {
      setAwaitingConfirmation(true);
      setMode('sign-in');
      setAttempt(null);
      setSubmitted(false);
      change({ confirmPassword: '' });
    }
  };

  const switchMode = () => {
    if (pending) return;
    const next: AuthMode = creating ? 'sign-in' : 'create-account';
    setMode(next);
    setAttempt(null);
    setSubmitted(false);
    setAwaitingConfirmation(false);
    change({ confirmPassword: '' });
    announcements.announce(T.modes[next].title);
  };

  return (
    <Ecran centre testID="ecran-connexion">
      <Panneau style={styles.formulaire}>
        <View style={styles.entete}>
          <EMarque>{T.brand}</EMarque>
          <View style={styles.titres}>
            <ETexte variante="objectif" role="heading">
              {texts.title}
            </ETexte>
            <ETexte variante="voix" couleur="encre-douce">
              {T.tagline}
            </ETexte>
          </View>
        </View>

        {ended ? <ENote>{AUTH_SERVER_MESSAGES.sessionEnded}</ENote> : null}
        {awaitingConfirmation ? <ENote>{AUTH_SERVER_MESSAGES.confirmEmail}</ENote> : null}

        <View style={styles.champs}>
          <EChamp libelle={T.email} erreur={formErrors.email ?? serverError('email')}>
            <ESaisie
              ref={emailField}
              value={values.email}
              onChangeText={(email) => change({ email })}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="username"
              returnKeyType="next"
              onSubmitEditing={() => focus('password')}
              submitBehavior="submit"
              testID="champ-email"
            />
          </EChamp>
          <EChamp
            libelle={T.password}
            {...(creating ? { aide: T.passwordHelp } : {})}
            erreur={formErrors.password ?? serverError('password')}
          >
            <ESaisie
              ref={passwordField}
              value={values.password}
              onChangeText={(password) => change({ password })}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete={creating ? 'new-password' : 'current-password'}
              textContentType={creating ? 'newPassword' : 'password'}
              returnKeyType={creating ? 'next' : 'go'}
              onSubmitEditing={() => (creating ? focus('confirmPassword') : void submit())}
              submitBehavior="submit"
              testID="champ-mot-de-passe"
            />
          </EChamp>
          {creating ? (
            <EChamp libelle={T.confirmPassword} erreur={formErrors.confirmPassword ?? null}>
              <ESaisie
                ref={confirmField}
                value={values.confirmPassword}
                onChangeText={(confirmPassword) => change({ confirmPassword })}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="go"
                onSubmitEditing={() => void submit()}
                testID="champ-confirmation"
              />
            </EChamp>
          ) : null}
        </View>

        {note ? <ENote accessibilityLiveRegion="assertive">{note}</ENote> : null}

        <View style={styles.envoi}>
          <EBouton variante="sceau" aria-busy={pending} onPress={() => void submit()} testID="envoyer">
            {texts.submit}
          </EBouton>
          {pending ? (
            <ETexte variante="detail" couleur="encre-douce" role="status" accessibilityLiveRegion="polite">
              {texts.pending}
            </ETexte>
          ) : null}
          <View style={styles.bascule}>
            <ETexte variante="detail" couleur="encre-douce">
              {texts.question}
            </ETexte>
            <EBouton variante="nu" disabled={pending} onPress={switchMode} testID="basculer">
              {texts.switch}
            </EBouton>
          </View>
        </View>
      </Panneau>
    </Ecran>
  );
}
