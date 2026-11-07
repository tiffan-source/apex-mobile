import { act, fireEvent, screen, waitFor, within } from 'expo-router/testing-library';
import { ScrollView } from 'react-native';
import { createTestApp, renderApp, type TestApp } from '@/testing/test-app';
import { typeset } from '@/domain/shared/typography';

/*
 * L'arête d'un objectif, ses étapes, ses pas et ses feuilles, sur un Apex Brain en mémoire.
 */

function semiMarathon(app: TestApp) {
  app.objectives.seedObjective({
    id: 'o1',
    title: 'Courir un semi-marathon',
    why: 'Tenir six mois',
    dueDate: new Date(2027, 4, 15).toISOString(),
  });
  app.objectives.seedObjective({ id: 's1', title: 'Bases', parentId: 'o1', done: true });
  app.objectives.seedObjective({ id: 's2', title: 'Endurance', parentId: 'o1' });
  app.objectives.seedObjective({ id: 's3', title: 'Fractionné', parentId: 'o1' });
  app.objectives.seedTask({ id: 't1', title: 'Marcher 20 minutes', objectiveId: 's1', done: true });
  app.objectives.seedTask({ id: 't2', title: 'Sortie de 30 minutes', objectiveId: 's2', done: true });
  app.objectives.seedTask({ id: 't3', title: 'Sortie de 45 minutes', objectiveId: 's2' });
}

describe("L'arête", () => {
  it("n'ouvre aucune étape d'elle-même, et ouvre celle qu'on choisit sur l'arête", async () => {
    const app = createTestApp();
    semiMarathon(app);
    await renderApp(app, '/objectifs/o1');

    expect(
      await screen.findByText(typeset("Choisis une étape sur l'arête pour voir ses pas.")),
    ).toBeOnTheScreen();
    expect(screen.getByText("L'arête · 3 étapes")).toBeOnTheScreen();
    expect(screen.queryByRole('heading', { name: 'Endurance' })).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Fractionné : À faire' }));
    expect(await screen.findByText('Étape · à faire')).toBeOnTheScreen();
    expect(screen.getByRole('heading', { name: 'Fractionné' })).toBeOnTheScreen();
    expect(app.announcer.said.map((item) => item.text)).toContain(typeset('Fractionné · à faire'));
  });

  it('cocher le dernier pas ne relit rien : l’étape reste « à faire » tant que le serveur ne la dit pas faite', async () => {
    const app = createTestApp();
    semiMarathon(app);
    await renderApp(app, '/objectifs/o1');
    const legende = (texte: string) => screen.queryByText(texte, { includeHiddenElements: true });

    await fireEvent.press(await screen.findByRole('button', { name: 'Endurance : À faire' }));
    await fireEvent.press(await screen.findByRole('checkbox', { name: 'Sortie de 45 minutes' }));

    await waitFor(() => expect(app.objectives.calls).toContain('completeTask'));
    await waitFor(() => expect(legende('2 pas faits')).toBeOnTheScreen());
    expect(screen.getByText('Étape · à faire')).toBeOnTheScreen();
    expect(app.objectives.calls.filter((call) => call === 'getObjectiveTree')).toHaveLength(1);
  });

  it('dit l’étape faite quand le serveur la dit faite, à la lecture suivante', async () => {
    const app = createTestApp();
    semiMarathon(app);
    await renderApp(app, '/objectifs/o1');
    const legende = (texte: string) => screen.queryByText(texte, { includeHiddenElements: true });

    await fireEvent.press(await screen.findByRole('button', { name: 'Endurance : À faire' }));
    await fireEvent.press(await screen.findByRole('checkbox', { name: 'Sortie de 45 minutes' }));
    await waitFor(() => expect(app.objectives.calls).toContain('completeTask'));

    app.objectives.objectives = app.objectives.objectives.map((item) =>
      item.id === 's2' ? { ...item, done: true } : item,
    );
    await act(async () =>
      screen.getByTestId('ecran-arete-defilement').props.refreshControl.props.onRefresh(),
    );
    await waitFor(() => expect(screen.getByText('Étape · faite')).toBeOnTheScreen());
    expect(screen.getByRole('button', { name: 'Endurance : Faite' })).toBeOnTheScreen();
    expect(legende('2 pas faits · étape accomplie')).toBeOnTheScreen();
  });

  it('ne montre le spinner que pour le geste de tirer, pas pour un pas coché', async () => {
    const app = createTestApp();
    semiMarathon(app);
    await renderApp(app, '/objectifs/o1');
    await fireEvent.press(await screen.findByRole('button', { name: 'Endurance : À faire' }));
    const spinner = () => screen.getByTestId('ecran-arete-defilement').props.refreshControl.props;

    app.objectives.hold();
    await fireEvent.press(await screen.findByRole('checkbox', { name: 'Sortie de 45 minutes' }));
    await act(() => jest.advanceTimersByTimeAsync(100));
    expect(spinner().refreshing).toBe(false);
    await app.objectives.release();
    await waitFor(() => expect(app.objectives.calls).toContain('completeTask'));

    app.objectives.hold();
    await act(async () => spinner().onRefresh());
    expect(spinner().refreshing).toBe(true);
    await app.objectives.release();
    await waitFor(() => expect(spinner().refreshing).toBe(false));
  });

  it("amène à l'écran l'étape choisie quand elle est hors de vue", async () => {
    const app = createTestApp();
    semiMarathon(app);
    await renderApp(app, '/objectifs/o1');
    const bouton = await screen.findByRole('button', { name: 'Endurance : À faire' });

    const mesures = jest.requireActual<{ default: { measureInWindow: jest.Mock } }>(
      '@react-native/jest-preset/jest/MockNativeMethods',
    ).default;
    const parDefaut = mesures.measureInWindow.getMockImplementation();
    const defilement = ScrollView.prototype as unknown as { getInnerViewRef: jest.Mock; scrollTo: jest.Mock };
    defilement.scrollTo.mockClear();
    defilement.getInnerViewRef.mockReturnValue({});
    mesures.measureInWindow.mockImplementation(
      (rappel: (x: number, y: number, largeur: number, hauteur: number) => void) => rappel(0, 5000, 343, 400),
    );
    try {
      await fireEvent.press(bouton);
      await waitFor(() => expect(defilement.scrollTo).toHaveBeenCalledWith({ y: 0, animated: true }));
    } finally {
      mesures.measureInWindow.mockImplementation(parDefaut);
      defilement.getInnerViewRef.mockReset();
    }
  });

  it("ajoute un pas à l'étape ouverte, rangé selon son importance et son urgence", async () => {
    const app = createTestApp();
    semiMarathon(app);
    const router = await renderApp(app, '/objectifs/o1');

    await fireEvent.press(await screen.findByRole('button', { name: 'Endurance : À faire' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Ajouter un pas' }));
    const sheet = await screen.findByTestId('feuille-ajout-pas');
    expect(router.getPathname()).toBe('/etapes/s2/nouveau-pas');
    expect(
      within(sheet).getByText('Dans la matrice, ce pas se range dans « À planifier ».'),
    ).toBeOnTheScreen();

    await fireEvent.changeText(within(sheet).getByTestId('champ-pas'), 'Sortie de 60 minutes');
    await fireEvent.press(within(sheet).getByRole('button', { name: 'Urgence : Pas urgent' }));
    await fireEvent.press(await screen.findByRole('radio', { name: 'Très urgent' }));
    expect(
      await screen.findByText('Dans la matrice, ce pas se range dans « Maintenant ».'),
    ).toBeOnTheScreen();

    await fireEvent.press(within(sheet).getByRole('button', { name: 'Ajouter' }));
    expect(await screen.findByRole('checkbox', { name: 'Sortie de 60 minutes' })).toBeOnTheScreen();
    await waitFor(() =>
      expect(app.objectives.tasks.find((task) => task.title === 'Sortie de 60 minutes')).toMatchObject({
        objectiveId: 's2',
        importance: 3,
        urgency: 4,
      }),
    );
    expect(router.getPathname()).toBe('/objectifs/o1');
  });

  it("dit ce qui manque, sans rien enregistrer, quand un pas n'a pas d'intitulé", async () => {
    const app = createTestApp();
    semiMarathon(app);
    await renderApp(app, '/etapes/s2/nouveau-pas');

    const sheet = await screen.findByTestId('feuille-ajout-pas');
    await fireEvent.press(within(sheet).getByRole('button', { name: 'Ajouter' }));
    expect(await screen.findByText("Écris ce pas en quelques mots pour l'ajouter.")).toBeOnTheScreen();
    expect(app.objectives.calls).not.toContain('addTask');
  });

  it("retire l'horizon d'un objectif", async () => {
    const app = createTestApp();
    semiMarathon(app);
    await renderApp(app, '/objectifs/o1');

    expect((await screen.findAllByText("Jusqu'en mai 2027")).length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByRole('button', { name: "Modifier l'objectif" }));
    const sheet = await screen.findByTestId('feuille-objectif');
    await fireEvent.press(within(sheet).getByRole('button', { name: "Retirer l'horizon" }));
    await fireEvent.press(within(sheet).getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(screen.queryByText("Jusqu'en mai 2027")).not.toBeOnTheScreen());
    await waitFor(() =>
      expect(app.objectives.objectives.find((item) => item.id === 'o1')?.dueDate).toBeNull(),
    );
  });

  it('invite à poser des étapes, et en ajoute une', async () => {
    const app = createTestApp();
    app.objectives.seedObjective({ id: 'o1', title: 'Apprendre le piano' });
    await renderApp(app, '/objectifs/o1');

    expect(
      await screen.findByText(
        "Une arête se construit avec des étapes. Ajoute-en une, ou demande-moi de t'en proposer.",
      ),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter une étape' }));
    const sheet = await screen.findByTestId('feuille-ajout-etape');
    await fireEvent.changeText(within(sheet).getByTestId('champ-nom-etape'), 'Solfège');
    await fireEvent.press(within(sheet).getByRole('button', { name: 'Ajouter' }));

    expect(await screen.findByRole('button', { name: 'Solfège : À faire' })).toBeOnTheScreen();
    await waitFor(() => expect(app.announcer.said.map((item) => item.text)).toContain('Étape ajoutée.'));
  });

  it("dit qu'un objectif est introuvable", async () => {
    const app = createTestApp();
    await renderApp(app, '/objectifs/inconnu');
    expect(await screen.findByText('Cet objectif est introuvable')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Voir mes objectifs' })).toBeOnTheScreen();
  });
});
