import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';
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
  app.objectives.seedObjective({ id: 's1', title: 'Bases', parentId: 'o1' });
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

  it('dit ce que le serveur sait : cocher le dernier pas fait passer étape et objectif à « faite »', async () => {
    const app = createTestApp();
    semiMarathon(app);
    await renderApp(app, '/objectifs/o1');

    await fireEvent.press(await screen.findByRole('button', { name: 'Endurance : À faire' }));
    await fireEvent.press(await screen.findByRole('checkbox', { name: 'Sortie de 45 minutes' }));

    await waitFor(() => expect(screen.getByText('Étape · faite')).toBeOnTheScreen());
    expect(screen.getByRole('button', { name: 'Endurance : Faite' })).toBeOnTheScreen();
    await waitFor(() => expect(app.objectives.calls.filter((call) => call === 'list')).toHaveLength(2));
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
