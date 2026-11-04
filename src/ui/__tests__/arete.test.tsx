import { fireEvent, render, screen } from '@testing-library/react-native';
import { EmpreinteProvider } from '@empreinte-studio/react-native';
import { Arete, type EtapeAreteApex } from '../arete';

const etapes: EtapeAreteApex[] = [
  { id: 's1', nom: 'Bases', faite: true },
  { id: 's2', nom: 'Endurance', faite: false },
  { id: 's3', nom: 'Fractionné', faite: false },
];

function renderArete(props: Partial<Parameters<typeof Arete>[0]> = {}) {
  return render(
    <EmpreinteProvider chargerPolices={false} accorderSysteme={false}>
      <Arete objectif="Courir un semi-marathon" etapes={etapes} interactive {...props} />
    </EmpreinteProvider>,
  );
}

describe("L'arête dressée", () => {
  it('dit chaque étape, faite ou à faire, puis la tête', async () => {
    await renderArete();
    const [premiere, deuxieme, troisieme] = screen.getAllByRole('button');
    expect(premiere).toHaveAccessibleName('Bases : Faite');
    expect(deuxieme).toHaveAccessibleName('Endurance : À faire');
    expect(troisieme).toHaveAccessibleName('Fractionné : À faire');
    expect(
      screen.getByRole('img', {
        name: "Arête de l'objectif « Courir un semi-marathon » : 3 étapes, 1 faite, 2 à faire",
      }),
    ).toBeOnTheScreen();
  });

  it("marque l'étape ouverte et rend celle qu'on choisit", async () => {
    const choisir = jest.fn();
    await renderArete({ choisie: 's2', onChoisir: choisir });
    expect(screen.getByRole('button', { name: 'Endurance : À faire' })).toBeSelected();
    await fireEvent.press(screen.getByRole('button', { name: 'Fractionné : À faire' }));
    expect(choisir).toHaveBeenCalledWith(etapes[2]);
  });

  it('replie les étapes faites au-delà de huit', async () => {
    const nombreuses: EtapeAreteApex[] = Array.from({ length: 10 }, (_, index) => ({
      id: `s${index}`,
      nom: `Étape ${index + 1}`,
      faite: index < 6,
    }));
    await renderArete({ etapes: nombreuses });
    expect(screen.getByRole('button', { name: 'Faites : 6 étapes' })).toBeOnTheScreen();
    expect(screen.getAllByRole('button')).toHaveLength(5);
  });
});
