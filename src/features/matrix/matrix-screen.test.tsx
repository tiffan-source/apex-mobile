import { fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { createTestApp, renderApp, type TestApp } from '@/testing/test-app';
import { typeset } from '@/domain/shared/typography';

function twoObjectives(app: TestApp) {
  app.objectives.seedObjective({ id: 'o1', title: 'Courir un semi-marathon' });
  app.objectives.seedObjective({ id: 's1', title: 'Endurance', parentId: 'o1' });
  app.objectives.seedObjective({ id: 'o2', title: 'Apprendre le piano' });
  app.objectives.seedTask({
    id: 't1',
    title: 'Sortie de 30 minutes',
    objectiveId: 's1',
    importance: 4,
    urgency: 4,
  });
  app.objectives.seedTask({
    id: 't2',
    title: 'Acheter des chaussures',
    objectiveId: 'o1',
    importance: 3,
    urgency: 2,
  });
  app.objectives.seedTask({
    id: 't3',
    title: 'Trouver une professeure',
    objectiveId: 'o2',
    importance: 2,
    urgency: 4,
  });
}

describe('La matrice', () => {
  it('range les pas par quadrant et ouvre celui qu’on choisit', async () => {
    const app = createTestApp();
    twoObjectives(app);
    await renderApp(app, '/matrice');

    expect(await screen.findByRole('tab', { name: 'Maintenant, Important · urgent, 1 pas' })).toBeSelected();
    expect(screen.getByRole('checkbox', { name: 'Sortie de 30 minutes' })).toBeOnTheScreen();
    expect(screen.getByText('Courir un semi-marathon · étape Endurance')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('tab', { name: 'À planifier, Important · pas urgent, 1 pas' }));
    expect(await screen.findByRole('checkbox', { name: 'Acheter des chaussures' })).toBeOnTheScreen();
    expect(screen.queryByRole('checkbox', { name: 'Sortie de 30 minutes' })).not.toBeOnTheScreen();
  });

  it('déplace un pas vers un autre quadrant', async () => {
    const app = createTestApp();
    twoObjectives(app);
    await renderApp(app, '/matrice');

    await fireEvent.press(
      await screen.findByRole('button', { name: 'Déplacer « Sortie de 30 minutes » vers…' }),
    );
    await fireEvent.press(await screen.findByRole('menuitem', { name: 'À planifier' }));

    await waitFor(() =>
      expect(app.objectives.tasks.find((task) => task.id === 't1')).toMatchObject({
        importance: 4,
        urgency: 2,
      }),
    );
    expect(app.announcer.said.map((item) => item.text)).toContain(
      typeset('Ce pas passe dans « À planifier ».'),
    );
    expect(
      await screen.findByRole('tab', { name: 'Maintenant, Important · urgent, 0 pas' }),
    ).toBeOnTheScreen();
  });

  it('filtre par objectif', async () => {
    const app = createTestApp();
    twoObjectives(app);
    await renderApp(app, '/matrice');

    await fireEvent.press(await screen.findByRole('button', { name: 'Apprendre le piano' }));
    expect(
      await screen.findByRole('tab', { name: 'Maintenant, Important · urgent, 0 pas' }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'À confier, Secondaire · urgent, 1 pas' })).toBeOnTheScreen();
    expect(app.announcer.said.map((item) => item.text)).toContain('Apprendre le piano · 1 pas');
  });

  it("invite à poser des pas quand il n'y en a aucun", async () => {
    const app = createTestApp();
    await renderApp(app, '/matrice');
    expect(
      await screen.findByText(
        "Aucun pas pour l'instant. Ajoute des pas à tes objectifs : ils viennent se ranger ici.",
      ),
    ).toBeOnTheScreen();
  });
});
