import { Linking } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { EmpreinteProvider } from '@empreinte-studio/react-native';
import { Prose, decoderEntites } from '../prose';

function renderProse(texte: string) {
  return render(
    <EmpreinteProvider chargerPolices={false} accorderSysteme={false}>
      <Prose texte={texte} voix="voix" />
    </EmpreinteProvider>,
  );
}

describe('La prose', () => {
  it('rend paragraphes, listes et insistance, sans italique', async () => {
    await renderProse('Commence par :\n\n- le **solfège**\n- les *gammes*\n\nPuis joue.');
    expect(screen.getByText('Commence par :')).toBeOnTheScreen();
    expect(screen.getByText('solfège')).toBeOnTheScreen();
    // *gammes* reste du texte droit, dans la même phrase.
    expect(screen.getByText('les gammes')).not.toHaveStyle({ fontStyle: 'italic' });
    expect(screen.getByText('Puis joue.')).toBeOnTheScreen();
  });

  it('garde un titre à la taille du texte, en semi-gras', async () => {
    await renderProse('## Ton plan\nUn pas après l’autre.');
    expect(screen.getByText('Ton plan')).toHaveStyle({ fontSize: 20, fontFamily: 'ShipporiMincho-SemiBold' });
  });

  it("n'ouvre que les liens du web et des e-mails", async () => {
    const ouvrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await renderProse('[La méthode](https://exemple.fr) et [ceci](javascript:alert(1))');
    await fireEvent.press(screen.getByText('La méthode'));
    await fireEvent.press(screen.getByText('ceci'));
    expect(ouvrir).toHaveBeenCalledTimes(1);
    expect(ouvrir).toHaveBeenCalledWith('https://exemple.fr');
  });

  it('retire le HTML et décode les entités', async () => {
    await renderProse('Un <b>pas</b> &amp; un autre');
    expect(screen.getByText('Un pas & un autre')).toBeOnTheScreen();
    expect(decoderEntites('&lt;3 &#233;t&#xE9;')).toBe('<3 été');
  });
});
