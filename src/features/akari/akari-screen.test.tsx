import { fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { awaitingPermission, readyState } from '@/testing/fakes';
import { createTestApp, renderApp, type TestApp } from '@/testing/test-app';
import { typeset } from '@/domain/shared/typography';

/*
 * Akari sur un objectif : l'invitation, le message envoyé, la demande d'accord, et ce qu'Akari ajoute à l'arête.
 */

function piano(app: TestApp) {
  app.objectives.seedObjective({ id: 'o1', title: 'Apprendre le piano' });
}

describe('Akari', () => {
  it("invite à proposer des étapes, demande l'accord, et l'étape rejoint l'arête", async () => {
    const app = createTestApp();
    piano(app);
    await renderApp(app, '/objectifs/o1/akari');

    await fireEvent.press(await screen.findByRole('button', { name: 'Propose-moi des étapes' }));
    expect(app.assistant.calls).toContain('send:Propose-moi des étapes pour « Apprendre le piano ».');
    // Le message part tout de suite, en encre douce jusqu'à son enregistrement.
    expect(await screen.findByText('Propose-moi des étapes pour « Apprendre le piano ».')).toBeOnTheScreen();

    // Akari demande la permission d'ajouter une étape.
    app.assistant.upcoming.push(
      awaitingPermission('o1', {
        id: 'appel-1',
        name: 'createSubObjective',
        arguments: { title: 'Solfège', parentObjectiveId: 'o1' },
      }),
    );
    expect(
      await screen.findByText(
        "Je te propose d'ajouter l'étape « Solfège ». On l'ajoute ?",
        {},
        { timeout: 3000 },
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText('Akari attend ton accord.')).toBeOnTheScreen();
    expect(app.announcer.said.map((item) => item.text)).toContain(
      typeset("Je te propose d'ajouter l'étape « Solfège ». On l'ajoute ?"),
    );

    // L'outil s'exécute côté serveur ; une fois fait, les objectifs se rechargent.
    app.objectives.seedObjective({ id: 'e-1', title: 'Solfège', parentId: 'o1' });
    app.assistant.upcoming.push(
      readyState('o1', {
        lastRegisteredMessage: {
          id: 'm-akari',
          sender: 'AI',
          content: "C'est ajouté. **Solfège** ouvre ton arête.",
          createdAt: new Date().toISOString(),
        },
      }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter' }));
    expect(app.assistant.calls).toContain('permission:true:appel-1');

    expect(await screen.findByText('Solfège', {}, { timeout: 3000 })).toBeOnTheScreen();
    await waitFor(
      () => expect(app.objectives.calls.filter((call) => call === 'list').length).toBeGreaterThan(1),
      {
        timeout: 3000,
      },
    );
  });

  it('propose des pas pour l’étape d’où l’on vient', async () => {
    const app = createTestApp();
    piano(app);
    app.objectives.seedObjective({ id: 's1', title: 'Solfège', parentId: 'o1' });
    await renderApp(app, '/objectifs/o1/akari?etape=s1');
    expect(
      await screen.findByText("Je peux te proposer des pas pour l'étape « Solfège »."),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Propose-moi des pas' })).toBeOnTheScreen();
  });

  it('reprend une conversation en cours, rendue en Markdown', async () => {
    const app = createTestApp();
    piano(app);
    app.assistant.conversation = [
      { id: 'm1', sender: 'u-alice', content: 'Par où commencer ?', createdAt: '2026-10-20T10:00:00.000Z' },
      {
        id: 'm2',
        sender: 'AI',
        content: 'Commence par :\n\n- le **solfège**\n- les gammes',
        createdAt: '2026-10-20T10:00:05.000Z',
      },
    ];
    await renderApp(app, '/objectifs/o1/akari');
    expect(await screen.findByText('Par où commencer ?')).toBeOnTheScreen();
    expect(screen.getByText('solfège')).toBeOnTheScreen();
    expect(screen.getByText('les gammes')).toBeOnTheScreen();
    // Une conversation déjà commencée n'a pas d'invitation.
    expect(screen.queryByRole('button', { name: 'Propose-moi des étapes' })).not.toBeOnTheScreen();
  });
});
