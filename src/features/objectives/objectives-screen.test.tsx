import { fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { createTestApp, renderApp } from '@/testing/test-app';

/*
 * L'accueil sur un Apex Brain en mémoire : les vraies routes, les vrais services.
 */

describe('Objectifs', () => {
  it('montre les objectifs en marche, leur prochain pas, et le coche sur place', async () => {
    const app = createTestApp();
    app.objectives.seedObjective({ id: 'o1', title: 'Courir un semi-marathon', why: 'Tenir six mois' });
    app.objectives.seedObjective({ id: 's1', title: 'Endurance', parentId: 'o1' });
    app.objectives.seedTask({ id: 't1', title: 'Sortie de 30 minutes', objectiveId: 's1' });
    app.objectives.seedTask({ id: 't2', title: 'Sortie de 45 minutes', objectiveId: 's1' });

    await renderApp(app, '/');

    expect(await screen.findByText('Courir un semi-marathon')).toBeOnTheScreen();
    expect(screen.getByText('« Tenir six mois »')).toBeOnTheScreen();
    expect(screen.getByText('1 en marche')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Sortie de 30 minutes' }));
    await waitFor(() => expect(app.objectives.tasks.find((task) => task.id === 't1')?.done).toBe(true));
    // Le pas suivant devient le prochain pas de la carte.
    expect(await screen.findByRole('checkbox', { name: 'Sortie de 45 minutes' })).toBeOnTheScreen();
    expect(app.announcer.said.map((item) => item.text)).toContain('Un pas de plus.');
  });

  it("invite à construire le premier objectif quand il n'y en a aucun", async () => {
    const app = createTestApp();
    await renderApp(app, '/');
    expect(await screen.findByText("Qu'est-ce que tu veux construire ?")).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Commencer' })).toBeOnTheScreen();
  });

  it("signale un chargement qui n'aboutit pas, et le range avec « Compris »", async () => {
    const app = createTestApp();
    app.objectives.failNext('list', 'NETWORK_UNREACHABLE');
    await renderApp(app, '/');
    expect(
      await screen.findByText("Je n'ai pas pu charger tes objectifs. Vérifie ta connexion, puis réessaie."),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Compris' }));
    expect(
      await screen.findByText('Tes objectifs ne sont pas chargés. Vérifie ta connexion, puis recharge.'),
    ).toBeOnTheScreen();
  });

  it("ouvre la connexion sans session, et l'accueil une fois connecté", async () => {
    const app = createTestApp({ signedIn: false });
    const router = await renderApp(app, '/');
    expect(await screen.findByText('Te revoilà.')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/auth');

    await fireEvent.changeText(screen.getByTestId('champ-email'), 'alice@apex.test');
    await fireEvent.changeText(screen.getByTestId('champ-mot-de-passe'), 'mot-de-passe');
    await fireEvent.press(screen.getByTestId('envoyer'));

    expect(await screen.findByText('Mes objectifs')).toBeOnTheScreen();
  });
});
