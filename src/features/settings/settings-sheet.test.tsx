import { fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { ALICE } from '@/testing/fakes';
import { createTestApp, renderApp } from '@/testing/test-app';

describe('Les réglages', () => {
  it('retient le thème choisi et le dit', async () => {
    const app = createTestApp();
    await renderApp(app, '/reglages');

    await fireEvent.press(await screen.findByRole('radio', { name: 'Thème Nuit' }));
    expect(await screen.findByRole('radio', { name: 'Thème Nuit' })).toBeChecked();
    await waitFor(() => expect(app.preferences.theme).toBe('nuit'));
    expect(app.announcer.said.map((item) => item.text)).toContain('Thème Nuit choisi.');
  });

  it("ferme la session sur l'appareil et chez Apex Brain", async () => {
    const app = createTestApp();
    const router = await renderApp(app, '/reglages');
    expect(await screen.findByText(ALICE.name)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Me déconnecter' }));
    expect(await screen.findByText('Te revoilà.')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/auth');
    expect(app.tokens.stored).toBeNull();
    await waitFor(() => expect(app.auth.calls).toContain('logout'));
  });
});

describe('La session', () => {
  it('dit quand la session a pris fin', async () => {
    const app = createTestApp();
    // Le jeton d'accès a expiré et son renouvellement est refusé.
    const stored = app.tokens.stored;
    if (!stored) throw new Error('session attendue');
    app.tokens.stored = {
      ...stored,
      session: { ...stored.session, expiresAt: new Date(app.clock.now() - 1000).toISOString() },
    };
    app.auth.failNextRefresh('INVALID_SESSION');

    await renderApp(app, '/');
    expect(
      await screen.findByText('Ta session a pris fin. Reconnecte-toi pour continuer.'),
    ).toBeOnTheScreen();
  });

  it('crée un compte, puis attend la confirmation de l’adresse', async () => {
    const app = createTestApp({ signedIn: false });
    await renderApp(app, '/auth');

    await fireEvent.press(await screen.findByRole('button', { name: 'Créer un compte' }));
    expect(await screen.findByText('Crée ton compte')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId('champ-email'), 'lea@apex.test');
    await fireEvent.changeText(screen.getByTestId('champ-mot-de-passe'), 'secret-123');
    await fireEvent.changeText(screen.getByTestId('champ-confirmation'), 'secret-12');
    await fireEvent.press(screen.getByTestId('envoyer'));
    expect(
      await screen.findByText("Ce n'est pas le même mot de passe. Recopie celui du dessus."),
    ).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByTestId('champ-confirmation'), 'secret-123');
    await fireEvent.press(screen.getByTestId('envoyer'));
    expect(
      await screen.findByText('Confirme ton adresse : ouvre le lien reçu par e-mail, puis connecte-toi.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Te revoilà.')).toBeOnTheScreen();
  });

  it('rattache un refus du serveur au champ concerné', async () => {
    const app = createTestApp({ signedIn: false });
    await renderApp(app, '/auth');
    await fireEvent.changeText(await screen.findByTestId('champ-email'), 'alice@apex.test');
    await fireEvent.changeText(screen.getByTestId('champ-mot-de-passe'), 'pas-le-bon');
    await fireEvent.press(screen.getByTestId('envoyer'));
    expect(
      await screen.findByText(
        'Ce mot de passe ne correspond pas à cette adresse. Vérifie-le, ou crée un compte.',
      ),
    ).toBeOnTheScreen();
    // Le message s'efface dès que la personne change ce qu'elle avait envoyé.
    await fireEvent.changeText(screen.getByTestId('champ-mot-de-passe'), 'mot-de-pass');
    expect(
      screen.queryByText('Ce mot de passe ne correspond pas à cette adresse. Vérifie-le, ou crée un compte.'),
    ).not.toBeOnTheScreen();
  });
});
