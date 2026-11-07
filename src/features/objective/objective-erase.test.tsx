import { router as navigation } from 'expo-router';
import { act, fireEvent, screen, waitFor, within } from 'expo-router/testing-library';
import { DUREE_TRACE } from '@empreinte-studio/react-native';
import { createTestApp, renderApp, type TestApp } from '@/testing/test-app';
import { typeset } from '@/domain/shared/typography';

/*
 * Effacer (maquette « Effacer », mobile), sur un Apex Brain en mémoire : un pas part tout de suite et sa trace laisse
 * le temps de le remettre ; une étape part après une validation ; un objectif, quand on a réécrit son nom.
 */

function semiMarathon(app: TestApp) {
  app.objectives.seedObjective({ id: 'o1', title: 'Courir un semi-marathon', why: 'Tenir six mois' });
  app.objectives.seedObjective({ id: 's1', title: 'Bases', parentId: 'o1' });
  app.objectives.seedObjective({ id: 's2', title: 'Endurance', parentId: 'o1' });
  app.objectives.seedObjective({ id: 's3', title: 'Fractionné', parentId: 'o1' });
  app.objectives.seedTask({ id: 't1', title: 'Marcher 20 minutes', objectiveId: 's1', done: true });
  app.objectives.seedTask({ id: 't2', title: 'Sortie de 30 minutes', objectiveId: 's2', done: true });
  app.objectives.seedTask({ id: 't3', title: 'Sortie de 45 minutes', objectiveId: 's2' });
  app.objectives.seedObjective({ id: 'o2', title: 'Apprendre le piano' });
}

/** L'action « Effacer » d'un pas, comme VoiceOver et TalkBack la proposent (le geste de glisser fait la même). */
async function eraseFromActions(title: string) {
  await fireEvent(screen.getByRole('checkbox', { name: title }), 'accessibilityAction', {
    nativeEvent: { actionName: 'effacer' },
  });
}

const tracePhrase = (title: string) => typeset(`« ${title} » est effacé.`);
const taskIds = (app: TestApp) => app.objectives.tasks.map((task) => task.id);

async function openEndurance(app: TestApp) {
  const router = await renderApp(app, '/objectifs/o1');
  await fireEvent.press(await screen.findByRole('button', { name: 'Endurance : À faire' }));
  await screen.findByRole('checkbox', { name: 'Sortie de 45 minutes' });
  return router;
}

describe('Effacer un pas', () => {
  it('sa trace prend sa place et le laisse revenir : « Remettre », et rien ne part', async () => {
    const app = createTestApp();
    semiMarathon(app);
    await openEndurance(app);

    await eraseFromActions('Sortie de 45 minutes');
    expect(await screen.findByText(tracePhrase('Sortie de 45 minutes'))).toBeOnTheScreen();
    expect(screen.queryByRole('checkbox', { name: 'Sortie de 45 minutes' })).not.toBeOnTheScreen();
    // Il ne compte plus dans l'étape.
    expect(screen.getByText('1 pas fait', { includeHiddenElements: true })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Remettre' }));
    expect(await screen.findByRole('checkbox', { name: 'Sortie de 45 minutes' })).toBeOnTheScreen();
    await act(() => jest.advanceTimersByTimeAsync(DUREE_TRACE + 1000));
    expect(taskIds(app)).toContain('t3');
    expect(app.objectives.calls).not.toContain('deleteTask');
  });

  it('la trace finie, le pas part pour de bon', async () => {
    const app = createTestApp();
    semiMarathon(app);
    await openEndurance(app);

    await eraseFromActions('Sortie de 45 minutes');
    await screen.findByText(tracePhrase('Sortie de 45 minutes'));
    await act(() => jest.advanceTimersByTimeAsync(DUREE_TRACE + 1000));

    await waitFor(() => expect(taskIds(app)).not.toContain('t3'));
    expect(screen.queryByText(tracePhrase('Sortie de 45 minutes'))).not.toBeOnTheScreen();
    expect(screen.queryByRole('checkbox', { name: 'Sortie de 45 minutes' })).not.toBeOnTheScreen();
    // Son étape n'a plus que des pas faits : le serveur la dit faite à la relecture.
    await waitFor(() => expect(screen.getByText('Étape · faite')).toBeOnTheScreen());
  });

  it('le pas qui part pour de bon ne réapparaît pas le temps que la copie prévienne l’écran', async () => {
    const app = createTestApp();
    semiMarathon(app);
    await openEndurance(app);

    await eraseFromActions('Sortie de 45 minutes');
    await screen.findByText(tracePhrase('Sortie de 45 minutes'));
    // La fin de la trace, sans laisser passer l'horloge : la copie n'a pas encore prévenu ceux qui la lisent.
    await act(async () => app.services.objectives.trace.expire('t3'));
    expect(screen.queryByRole('checkbox', { name: 'Sortie de 45 minutes' })).not.toBeOnTheScreen();
    expect(screen.queryByText(tracePhrase('Sortie de 45 minutes'))).not.toBeOnTheScreen();
  });

  it('une trace à la fois : un autre pas effacé fait partir celui qui attendait', async () => {
    const app = createTestApp();
    semiMarathon(app);
    await openEndurance(app);

    await eraseFromActions('Sortie de 30 minutes');
    await screen.findByText(tracePhrase('Sortie de 30 minutes'));
    await eraseFromActions('Sortie de 45 minutes');

    expect(await screen.findByText(tracePhrase('Sortie de 45 minutes'))).toBeOnTheScreen();
    expect(screen.queryByText(tracePhrase('Sortie de 30 minutes'))).not.toBeOnTheScreen();
    await waitFor(() => expect(taskIds(app)).not.toContain('t2'));
    expect(taskIds(app)).toContain('t3');
    expect(app.objectives.calls.filter((call) => call === 'deleteTask')).toHaveLength(1);
  });

  it('quitter l’arête fait partir le pas dont la trace était à l’écran', async () => {
    const app = createTestApp();
    semiMarathon(app);
    const router = await openEndurance(app);

    await eraseFromActions('Sortie de 45 minutes');
    await screen.findByText(tracePhrase('Sortie de 45 minutes'));
    await act(async () => navigation.back());

    await waitFor(() => expect(router.getPathname()).toBe('/'));
    await waitFor(() => expect(taskIds(app)).not.toContain('t3'));
  });

  it('s’efface aussi sans glisser, depuis le pied de sa feuille : sa trace attend dans l’arête', async () => {
    const app = createTestApp();
    semiMarathon(app);
    const router = await openEndurance(app);

    await fireEvent.press(screen.getByRole('button', { name: 'Modifier « Sortie de 45 minutes »' }));
    const sheet = await screen.findByTestId('feuille-pas');
    await fireEvent.press(within(sheet).getByRole('button', { name: 'Effacer ce pas' }));

    await waitFor(() => expect(router.getPathname()).toBe('/objectifs/o1'));
    expect(await screen.findByText(tracePhrase('Sortie de 45 minutes'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Remettre' }));
    expect(await screen.findByRole('checkbox', { name: 'Sortie de 45 minutes' })).toBeOnTheScreen();
    expect(app.objectives.calls).not.toContain('deleteTask');
  });

  it('depuis une feuille ouverte par un lien, sans l’arête dessous, le pas part tout de suite', async () => {
    const app = createTestApp();
    semiMarathon(app);
    const router = await renderApp(app, '/pas/t3/modifier');

    const sheet = await screen.findByTestId('feuille-pas');
    await fireEvent.press(within(sheet).getByRole('button', { name: 'Effacer ce pas' }));

    await waitFor(() => expect(taskIds(app)).not.toContain('t3'));
    expect(router.getPathname()).toBe('/');
    expect(app.services.objectives.trace.erasing$.get()).toBeNull();
  });

  it('un pas qui n’est pas effacé revient à sa place, et la note le dit', async () => {
    const app = createTestApp();
    semiMarathon(app);
    await openEndurance(app);
    app.objectives.failNext('deleteTask', 'NETWORK_UNREACHABLE');

    await eraseFromActions('Sortie de 45 minutes');
    await screen.findByText(tracePhrase('Sortie de 45 minutes'));
    await act(() => jest.advanceTimersByTimeAsync(DUREE_TRACE + 1000));

    expect(
      await screen.findByText(
        typeset(
          "Je n'ai pas pu effacer ce pas : il est revenu à sa place. Vérifie ta connexion, puis réessaie.",
        ),
      ),
    ).toBeOnTheScreen();
    expect(screen.getByRole('checkbox', { name: 'Sortie de 45 minutes' })).toBeOnTheScreen();
    expect(taskIds(app)).toContain('t3');
  });
});

describe('Effacer une étape', () => {
  it('une validation dit ce qui part ; l’étape quitte l’arête avec ses pas', async () => {
    const app = createTestApp();
    semiMarathon(app);
    const router = await openEndurance(app);

    await fireEvent.press(screen.getByRole('button', { name: "Effacer l'étape" }));
    const sheet = await screen.findByTestId('feuille-effacer-etape');
    expect(router.getPathname()).toBe('/etapes/s2/effacer');
    expect(within(sheet).getByText(typeset('Effacer cette étape de ton plan ?'))).toBeOnTheScreen();
    expect(within(sheet).getByLabelText('Ton arête passe de 3 à 2 étapes.')).toBeOnTheScreen();
    expect(
      within(sheet).getByText('Endurance emporte ses 2 pas, dont 1 fait. Ça ne se récupère pas.'),
    ).toBeOnTheScreen();

    await fireEvent.press(within(sheet).getByRole('button', { name: "Effacer l'étape" }));

    await waitFor(() => expect(router.getPathname()).toBe('/objectifs/o1'));
    expect(await screen.findByText("L'arête · 2 étapes")).toBeOnTheScreen();
    expect(screen.getByText(typeset("Choisis une étape sur l'arête pour voir ses pas."))).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Endurance : À faire' })).not.toBeOnTheScreen();
    await waitFor(() => expect(app.objectives.objectives.map((item) => item.id)).not.toContain('s2'));
    expect(taskIds(app)).toEqual(['t1']);
    await waitFor(() => expect(app.announcer.said.map((item) => item.text)).toContain('Étape effacée.'));
  });

  it('le pas dont la trace attendait part d’abord, et ne revient pas avec l’étape refusée', async () => {
    const app = createTestApp();
    semiMarathon(app);
    await openEndurance(app);

    await eraseFromActions('Sortie de 45 minutes');
    await screen.findByText(tracePhrase('Sortie de 45 minutes'));
    app.objectives.failNext('deleteObjective', 'NETWORK_UNREACHABLE');
    await fireEvent.press(screen.getByRole('button', { name: "Effacer l'étape" }));
    const sheet = await screen.findByTestId('feuille-effacer-etape');
    // Le pas qui part déjà ne compte plus dans ce que l'étape emporte.
    expect(
      within(sheet).getByText('Endurance emporte son pas, déjà fait. Ça ne se récupère pas.'),
    ).toBeOnTheScreen();
    await fireEvent.press(within(sheet).getByRole('button', { name: "Effacer l'étape" }));

    await waitFor(() =>
      expect(app.objectives.calls.filter((call) => call.startsWith('delete'))).toEqual([
        'deleteTask',
        'deleteObjective',
      ]),
    );
    // L'étape revient (sans ce pas, elle est faite : le serveur le dit).
    expect(await screen.findByRole('button', { name: /^Endurance : / })).toBeOnTheScreen();
    expect(screen.getByText("L'arête · 3 étapes")).toBeOnTheScreen();
    expect(taskIds(app)).not.toContain('t3');
    expect(screen.queryByText(tracePhrase('Sortie de 45 minutes'))).not.toBeOnTheScreen();
  });

  it('« Garder l’étape » referme la validation sans rien effacer', async () => {
    const app = createTestApp();
    semiMarathon(app);
    const router = await openEndurance(app);

    await fireEvent.press(screen.getByRole('button', { name: "Effacer l'étape" }));
    const sheet = await screen.findByTestId('feuille-effacer-etape');
    await fireEvent.press(within(sheet).getByRole('button', { name: "Garder l'étape" }));

    await waitFor(() => expect(router.getPathname()).toBe('/objectifs/o1'));
    expect(screen.getByRole('heading', { name: 'Endurance' })).toBeOnTheScreen();
    expect(app.objectives.calls).not.toContain('deleteObjective');
  });

  it('une étape qui n’est pas effacée revient sur l’arête, et la note le dit', async () => {
    const app = createTestApp();
    semiMarathon(app);
    await openEndurance(app);
    app.objectives.failNext('deleteObjective', 'NETWORK_UNREACHABLE');

    await fireEvent.press(screen.getByRole('button', { name: "Effacer l'étape" }));
    const sheet = await screen.findByTestId('feuille-effacer-etape');
    await fireEvent.press(within(sheet).getByRole('button', { name: "Effacer l'étape" }));

    expect(
      await screen.findByText(
        typeset(
          "Je n'ai pas pu effacer cette étape : elle est revenue à sa place. Vérifie ta connexion, puis réessaie.",
        ),
      ),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Endurance : À faire' })).toBeOnTheScreen();
    expect(screen.getByText("L'arête · 3 étapes")).toBeOnTheScreen();
  });
});

describe('Effacer un objectif', () => {
  const name = 'Courir un semi-marathon';

  async function openErasure(app: TestApp) {
    const router = await renderApp(app, '/objectifs/o1');
    await fireEvent.press(await screen.findByRole('button', { name: "Modifier l'objectif" }));
    const edit = await screen.findByTestId('feuille-objectif');
    expect(within(edit).getByText(typeset("Cet objectif n'a plus sa place ?"))).toBeOnTheScreen();
    await fireEvent.press(within(edit).getByRole('button', { name: "Effacer l'objectif" }));
    const sheet = await screen.findByTestId('feuille-effacer-objectif');
    return { router, sheet };
  }

  it('depuis le pied de sa feuille : on réécrit son nom, puis il quitte la liste', async () => {
    const app = createTestApp();
    semiMarathon(app);
    const { router, sheet } = await openErasure(app);

    expect(router.getPathname()).toBe('/objectifs/o1/effacer');
    expect(screen.queryByTestId('feuille-objectif')).not.toBeOnTheScreen();
    expect(
      within(sheet).getByText(
        'Ses 3 étapes, ses 3 pas dont 2 faits et ta conversation avec Akari partent avec lui. Ça ne se récupère pas.',
      ),
    ).toBeOnTheScreen();
    const confirm = within(sheet).getByRole('button', { name: "Effacer l'objectif" });
    expect(confirm).toBeDisabled();

    await fireEvent.changeText(
      within(sheet).getByLabelText('Pour confirmer, écris son nom'),
      'courir un semi',
    );
    expect(confirm).toBeDisabled();
    await fireEvent.changeText(within(sheet).getByLabelText('Pour confirmer, écris son nom'), name);
    expect(within(sheet).getByRole('button', { name: "Effacer l'objectif" })).toBeEnabled();
    await fireEvent.press(within(sheet).getByRole('button', { name: "Effacer l'objectif" }));

    await waitFor(() => expect(router.getPathname()).toBe('/'));
    expect(await screen.findByRole('heading', { name: 'Apprendre le piano' })).toBeOnTheScreen();
    expect(screen.queryByRole('heading', { name })).not.toBeOnTheScreen();
    expect(screen.queryByText('Cet objectif est introuvable')).not.toBeOnTheScreen();
    await waitFor(() => expect(app.objectives.objectives.map((item) => item.id)).toEqual(['o2']));
    expect(app.objectives.tasks).toEqual([]);
    await waitFor(() => expect(app.announcer.said.map((item) => item.text)).toContain('Objectif effacé.'));
  });

  it('« Garder l’objectif » ramène à l’arête, sans rien effacer', async () => {
    const app = createTestApp();
    semiMarathon(app);
    const { router, sheet } = await openErasure(app);

    await fireEvent.press(within(sheet).getByRole('button', { name: "Garder l'objectif" }));
    await waitFor(() => expect(router.getPathname()).toBe('/objectifs/o1'));
    expect(screen.getByText("L'arête · 3 étapes")).toBeOnTheScreen();
    expect(app.objectives.calls).not.toContain('deleteObjective');
  });

  it('un objectif qui n’est pas effacé revient parmi tes objectifs, et la note le dit', async () => {
    const app = createTestApp();
    semiMarathon(app);
    const { router, sheet } = await openErasure(app);
    app.objectives.failNext('deleteObjective', 'NETWORK_UNREACHABLE');

    await fireEvent.changeText(within(sheet).getByLabelText('Pour confirmer, écris son nom'), name);
    await fireEvent.press(within(sheet).getByRole('button', { name: "Effacer l'objectif" }));

    await waitFor(() => expect(router.getPathname()).toBe('/'));
    expect(
      await screen.findByText(
        typeset(
          "Je n'ai pas pu effacer cet objectif : il est revenu parmi tes objectifs. Vérifie ta connexion, puis réessaie.",
        ),
      ),
    ).toBeOnTheScreen();
    expect(screen.getByRole('heading', { name })).toBeOnTheScreen();
  });
});
