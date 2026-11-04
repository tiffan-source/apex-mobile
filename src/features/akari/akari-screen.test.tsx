import { focusManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { awaitingPermission, processingState, readyState } from '@/testing/fakes';
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

  it('dit ce que fait Akari pendant un long tour, et efface son journal à la fin', async () => {
    const app = createTestApp();
    piano(app);
    await renderApp(app, '/objectifs/o1/akari');
    await fireEvent.changeText(await screen.findByLabelText('Réponds à Akari'), 'Où en suis-je ?');
    await fireEvent.press(screen.getByTestId('composeur-envoyer'));
    expect(await screen.findByText('Akari note ton message…')).toBeOnTheScreen();

    app.assistant.upcoming.push(
      processingState('o1', 'reviewing', {
        round: 2,
        done: ['saving-message', 'thinking', 'checking-permission', 'reading'],
      }),
    );
    expect(await screen.findByText('Akari fait le point, 2e tour…', {}, { timeout: 3000 })).toBeOnTheScreen();
    expect(screen.getByText("J'ai noté ton message.")).toBeOnTheScreen();
    expect(screen.getByText("J'ai vérifié s'il me fallait ton accord.")).toBeOnTheScreen();
    expect(screen.getByText("J'ai regardé ton objectif.")).toBeOnTheScreen();

    // L'attente s'allonge : la ligne d'état le dit, le journal reste.
    app.assistant.upcoming.push(
      processingState('o1', 'reviewing', {
        round: 2,
        elapsedMs: 20_000,
        done: ['saving-message', 'thinking', 'checking-permission', 'reading'],
      }),
    );
    expect(await screen.findByText('Akari réfléchit encore…', {}, { timeout: 3000 })).toBeOnTheScreen();
    expect(screen.getByText("J'ai regardé ton objectif.")).toBeOnTheScreen();

    app.assistant.upcoming.push(
      readyState('o1', {
        lastRegisteredMessage: {
          id: 'm-akari',
          sender: 'AI',
          content: 'Ton objectif est vide.',
          createdAt: new Date().toISOString(),
        },
      }),
    );
    expect(await screen.findByText('Ton objectif est vide.', {}, { timeout: 3000 })).toBeOnTheScreen();
    expect(screen.queryByText("J'ai regardé ton objectif.")).not.toBeOnTheScreen();
    expect(screen.queryByText('Akari réfléchit encore…')).not.toBeOnTheScreen();
  });

  it('dit que la réponse à une demande d’accord est partie, le temps que le serveur la rende', async () => {
    const app = createTestApp();
    piano(app);
    app.assistant.state = awaitingPermission('o1', {
      id: 'appel-1',
      name: 'createSubObjective',
      arguments: { title: 'Solfège', parentObjectiveId: 'o1' },
    });
    await renderApp(app, '/objectifs/o1/akari');
    const accept = await screen.findByRole('button', { name: 'Ajouter' });

    app.assistant.holdPosts();
    await fireEvent.press(accept);

    expect(await screen.findByText('Akari reçoit ta réponse…')).toBeOnTheScreen();
    await act(() => app.assistant.releasePosts());
    expect(await screen.findByText('Akari ajoute ce que tu as accepté…')).toBeOnTheScreen();
  });

  it('ne dit pas qu’Akari ajoute quelque chose quand la personne refuse', async () => {
    const app = createTestApp();
    piano(app);
    app.assistant.state = awaitingPermission('o1', {
      id: 'appel-1',
      name: 'createSubObjective',
      arguments: { title: 'Solfège', parentObjectiveId: 'o1' },
    });
    await renderApp(app, '/objectifs/o1/akari');

    await fireEvent.press(await screen.findByRole('button', { name: 'Pas maintenant' }));

    expect(await screen.findByText('Akari fait le point…')).toBeOnTheScreen();
    expect(screen.queryByText('Akari ajoute ce que tu as accepté…')).not.toBeOnTheScreen();
  });

  it('dit dès l’envoi qu’Akari note le message, même si le serveur tarde à répondre', async () => {
    const app = createTestApp();
    piano(app);
    await renderApp(app, '/objectifs/o1/akari');
    await fireEvent.changeText(await screen.findByLabelText('Réponds à Akari'), 'Tu es là ?');
    app.assistant.holdPosts();

    await fireEvent.press(screen.getByTestId('composeur-envoyer'));

    expect(await screen.findByText('Akari note ton message…')).toBeOnTheScreen();
    await act(() => app.assistant.releasePosts());
  });

  it('rouvre la zone de réponse quand le message est refusé', async () => {
    const app = createTestApp();
    piano(app);
    await renderApp(app, '/objectifs/o1/akari');
    await fireEvent.changeText(await screen.findByLabelText('Réponds à Akari'), 'Encore un message');
    app.assistant.nextSendFailure = 'WORKFLOW_BUSY';
    // La relecture qui suit le refus tarde : l'écran revient à l'état d'avant l'envoi sans l'attendre.
    app.assistant.holdStates();

    await fireEvent.press(screen.getByTestId('composeur-envoyer'));

    await waitFor(() => expect(app.assistant.calls).toContain('send:Encore un message'));
    expect(await screen.findByDisplayValue('Encore un message')).toBeOnTheScreen();
    await waitFor(() => expect(screen.queryByText('Akari note ton message…')).not.toBeOnTheScreen());
    expect(screen.getByTestId('composeur-envoyer')).toBeEnabled();
    await act(() => app.assistant.releaseStates());
  });

  it('une lecture partie avant l’envoi n’efface pas la ligne d’état pendant qu’il part', async () => {
    const app = createTestApp();
    piano(app);
    await renderApp(app, '/objectifs/o1/akari');
    await fireEvent.changeText(await screen.findByLabelText('Réponds à Akari'), 'Par où je reprends ?');
    await waitFor(() => expect(screen.getByTestId('composeur-envoyer')).toBeEnabled());

    app.assistant.holdStates();
    await act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await waitFor(() => expect(app.assistant.calls.filter((call) => call === 'state:o1')).toHaveLength(2));

    app.assistant.holdPosts();
    await fireEvent.press(screen.getByTestId('composeur-envoyer'));
    await waitFor(() => expect(app.assistant.calls).toContain('send:Par où je reprends ?'));
    await act(() => app.assistant.releaseStates());
    // Le temps qu'une lecture qui n'aurait pas été abandonnée arrive à l'écran.
    await act(() => jest.advanceTimersByTimeAsync(100));

    expect(screen.getByText('Akari note ton message…')).toBeOnTheScreen();
    await act(() => app.assistant.releasePosts());
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

  it('un état lu avant l’envoi, et arrivé après, ne fait pas croire que le tour est fini', async () => {
    const app = createTestApp();
    piano(app);
    app.assistant.conversation = [
      { id: 'm1', sender: 'AI', content: 'On reprend ?', createdAt: '2026-10-20T10:00:00.000Z' },
    ];
    await renderApp(app, '/objectifs/o1/akari');
    await fireEvent.changeText(await screen.findByTestId('composeur-saisie'), 'Par où je reprends ?');
    await waitFor(() => expect(screen.getByTestId('composeur-envoyer')).toBeEnabled());

    // L'application revient au premier plan : une lecture de l'état part (le serveur répond « prêt »)…
    app.assistant.holdStates();
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await waitFor(() => expect(app.assistant.calls.filter((call) => call === 'state:o1')).toHaveLength(2));

    // … la personne envoie son message, puis la lecture d'avant arrive.
    await fireEvent.press(screen.getByTestId('composeur-envoyer'));
    await waitFor(() => expect(app.assistant.calls).toContain('send:Par où je reprends ?'));
    await act(() => app.assistant.releaseStates());

    // Le tour continue : l'état est encore interrogé, et la réponse d'Akari arrive.
    app.assistant.upcoming.push(
      readyState('o1', {
        lastRegisteredMessage: {
          id: 'm-akari',
          sender: 'AI',
          content: 'Reprends par l’endurance.',
          createdAt: new Date().toISOString(),
        },
      }),
    );
    expect(await screen.findByText('Reprends par l’endurance.', {}, { timeout: 3000 })).toBeOnTheScreen();
  });
});
