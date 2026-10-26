import { fireEvent, render, screen } from '@testing-library/react-native';
import { EmpreinteProvider } from '@empreinte-studio/react-native';
import { Arete, type EtapeAreteApex } from '../arete';

const etapes: EtapeAreteApex[] = [
  { id: 's1', nom: 'Bases', etat: 'faite' },
  { id: 's2', nom: 'Endurance', etat: 'en-cours', detail: '1 pas fait' },
  { id: 's3', nom: 'Fractionné', etat: 'a-venir' },
];

function renderArete(props: Partial<Parameters<typeof Arete>[0]> = {}) {
  return render(
    <EmpreinteProvider chargerPolices={false} accorderSysteme={false}>
      <Arete objectif="Courir un semi-marathon" etapes={etapes} interactive {...props} />
    </EmpreinteProvider>,
  );
}

describe("L'arête dressée", () => {
  it('lit les étapes dans leur ordre, puis la tête', async () => {
    await renderArete();
    const [premiere, deuxieme, troisieme] = screen.getAllByRole('button');
    expect(premiere).toHaveAccessibleName('Bases : Faite');
    expect(deuxieme).toHaveAccessibleName('Endurance : 1 pas fait');
    expect(troisieme).toHaveAccessibleName('Fractionné : À venir');
    expect(
      screen.getByRole('img', {
        name: "Arête de l'objectif « Courir un semi-marathon » : 3 étapes, 1 faite, 1 en cours, 1 à venir",
      }),
    ).toBeOnTheScreen();
  });

  it("marque l'étape ouverte et rend celle qu'on choisit", async () => {
    const choisir = jest.fn();
    await renderArete({ choisie: 's2', onChoisir: choisir });
    expect(screen.getByRole('button', { name: 'Endurance : 1 pas fait' })).toBeSelected();
    await fireEvent.press(screen.getByRole('button', { name: 'Fractionné : À venir' }));
    expect(choisir).toHaveBeenCalledWith(etapes[2]);
  });

  it('replie les étapes faites au-delà de huit', async () => {
    const nombreuses: EtapeAreteApex[] = Array.from({ length: 10 }, (_, index) => ({
      id: `s${index}`,
      nom: `Étape ${index + 1}`,
      etat: index < 6 ? 'faite' : index === 6 ? 'en-cours' : 'a-venir',
    }));
    await renderArete({ etapes: nombreuses });
    expect(screen.getByRole('button', { name: 'Faites : 6 étapes' })).toBeOnTheScreen();
    expect(screen.getAllByRole('button')).toHaveLength(5);
  });
});
