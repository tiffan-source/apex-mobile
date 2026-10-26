import { Platform } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { createTestApp, renderApp } from '@/testing/test-app';

/** Choisit une date dans le calendrier du téléphone (simulé : en ligne sur iOS, en boîte de dialogue sur Android). */
async function chooseDate(trigger: string, date: Date) {
  if (Platform.OS === 'android') {
    jest
      .mocked(DateTimePickerAndroid.open)
      .mockImplementationOnce(({ onChange }) =>
        onChange?.({ type: 'set', nativeEvent: { timestamp: date.getTime() } } as never, date),
      );
    await fireEvent.press(screen.getByRole('button', { name: trigger }));
    return;
  }
  await fireEvent.press(screen.getByRole('button', { name: trigger }));
  await fireEvent(screen.getByTestId('calendrier'), 'change', { type: 'set' }, date);
}

describe('Nouvel objectif', () => {
  it('relit le brouillon en direct, puis ouvre Akari sur l’objectif enregistré', async () => {
    const app = createTestApp();
    const router = await renderApp(app, '/objectifs/nouveau');

    expect(await screen.findByText("Ton objectif s'écrit ici.")).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: "Je m'y engage" })).toBeDisabled();

    await fireEvent.changeText(screen.getByTestId('champ-titre'), 'Apprendre le piano');
    expect(screen.getByRole('heading', { name: 'Apprendre le piano' })).toBeOnTheScreen();
    expect(
      screen.getByText("Relis ton brouillon. Change ce que tu veux avant de t'engager."),
    ).toBeOnTheScreen();

    const nextYear = new Date().getFullYear() + 1;
    await chooseDate('Ton horizon : Choisis une date', new Date(nextYear, 4, 15));
    expect(await screen.findByText(`Jusqu'en mai ${nextYear}`)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: "Je m'y engage" }));
    await waitFor(() => expect(router.getPathname()).toBe('/objectifs/o-1/akari'));
    expect(app.objectives.objectives[0]).toMatchObject({ id: 'o-1', title: 'Apprendre le piano' });
    expect(
      await screen.findByText('Je peux te proposer des étapes pour « Apprendre le piano ». On commence ?'),
    ).toBeOnTheScreen();
  });

  it("garde le brouillon et le dit quand l'enregistrement n'aboutit pas", async () => {
    const app = createTestApp();
    app.objectives.failNext('createObjective', 'NETWORK_UNREACHABLE');
    const router = await renderApp(app, '/objectifs/nouveau');

    await fireEvent.changeText(await screen.findByTestId('champ-titre'), 'Apprendre le piano');
    await fireEvent.press(screen.getByRole('button', { name: "Je m'y engage" }));

    expect(
      await screen.findByText(
        "Je n'ai pas pu enregistrer cet objectif. Vérifie ta connexion, puis réessaie.",
      ),
    ).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/objectifs/nouveau');
    expect(screen.getByTestId('champ-titre')).toHaveDisplayValue('Apprendre le piano');
  });
});
