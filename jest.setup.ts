// Reanimated tourne en JavaScript pendant les tests : ses animations CSS s'appliquent sans le moteur natif.
import { setUpTests } from 'react-native-reanimated';

setUpTests();

// Le stockage des préférences, en mémoire.
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- la fabrique de jest.mock est synchrone
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Les mesures natives, simulées : un bouton mesure 44 points, posé en haut de l'écran. Sans elles, une liste
// dépliée sous son bouton (menu, sélection) ne saurait pas où se poser.
type Mesures = {
  measureInWindow: jest.Mock;
  measureLayout: jest.Mock;
};
const mesures = jest.requireActual<{ default: Mesures }>(
  '@react-native/jest-preset/jest/MockNativeMethods',
).default;
mesures.measureInWindow.mockImplementation((rappel: (x: number, y: number, l: number, h: number) => void) =>
  rappel(16, 120, 44, 44),
);
mesures.measureLayout.mockImplementation(
  (_relatif: unknown, rappel: (x: number, y: number, l: number, h: number) => void) => rappel(0, 0, 343, 44),
);

// Le calendrier du téléphone, simulé : le module natif n'existe pas pendant les tests. Le calendrier d'iOS se pose
// dans l'écran (`testID="calendrier"`) et rend la date qu'on lui fait choisir ; la boîte de dialogue d'Android
// s'ouvre par `DateTimePickerAndroid.open`, que chaque test peut faire répondre.
jest.mock('@react-native-community/datetimepicker', () => {
  const { createElement } = jest.requireActual<{ createElement: (type: unknown, props: object) => unknown }>(
    'react',
  );
  const { View } = jest.requireActual<{ View: unknown }>('react-native');
  // `onChange` passe tel quel : un test l'appelle avec `fireEvent(calendrier, 'change', evenement, date)`.
  const Calendrier = (props: Record<string, unknown>) =>
    createElement(View, { testID: 'calendrier', onChange: props.onChange });
  return {
    __esModule: true,
    default: Calendrier,
    DateTimePickerAndroid: { open: jest.fn(), dismiss: jest.fn() },
  };
});
