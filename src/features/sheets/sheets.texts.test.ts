import { typeset } from '@/domain/shared/typography';
import { SHEETS_TEXTS } from './sheets.texts';

/* Ce qu'un effacement emporte, dit en accordant chaque nombre (maquette « Effacer »). */

describe('les mots de l’effacement', () => {
  const stage = SHEETS_TEXTS.eraseStage;
  const objective = SHEETS_TEXTS.eraseObjective;

  it('ce que devient l’arête', () => {
    expect(stage.arete(6)).toBe('Ton arête passe de 6 à 5 étapes.');
    expect(stage.arete(2)).toBe('Ton arête passe de 2 à 1 étape.');
    expect(stage.arete(1)).toBe("Ton arête n'aura plus d'étape.");
  });

  it('ce qu’une étape emporte, nommée', () => {
    expect(stage.carries('Endurance', { done: 4, total: 7 })).toBe(
      'Endurance emporte ses 7 pas, dont 4 faits. Ça ne se récupère pas.',
    );
    expect(stage.carries('Endurance', { done: 1, total: 3 })).toBe(
      'Endurance emporte ses 3 pas, dont 1 fait. Ça ne se récupère pas.',
    );
    expect(stage.carries('Endurance', { done: 0, total: 2 })).toBe(
      'Endurance emporte ses 2 pas. Ça ne se récupère pas.',
    );
    expect(stage.carries('Endurance', { done: 1, total: 1 })).toBe(
      'Endurance emporte son pas, déjà fait. Ça ne se récupère pas.',
    );
    expect(stage.carries('Endurance', { done: 0, total: 1 })).toBe(
      'Endurance emporte son pas. Ça ne se récupère pas.',
    );
    expect(stage.carries('Endurance', { done: 0, total: 0 })).toBe(
      'Endurance sort du plan. Ça ne se récupère pas.',
    );
  });

  it('ce qu’un objectif emporte, conversation avec Akari comprise', () => {
    expect(objective.carries(6, { done: 9, total: 21 })).toBe(
      'Ses 6 étapes, ses 21 pas dont 9 faits et ta conversation avec Akari partent avec lui. Ça ne se récupère pas.',
    );
    expect(objective.carries(1, { done: 0, total: 1 })).toBe(
      'Son étape, son pas et ta conversation avec Akari partent avec lui. Ça ne se récupère pas.',
    );
    expect(objective.carries(2, { done: 0, total: 0 })).toBe(
      'Ses 2 étapes et ta conversation avec Akari partent avec lui. Ça ne se récupère pas.',
    );
    expect(objective.carries(0, { done: 1, total: 3 })).toBe(
      'Ses 3 pas dont 1 fait et ta conversation avec Akari partent avec lui. Ça ne se récupère pas.',
    );
    expect(objective.carries(0, { done: 0, total: 0 })).toBe(
      'Ta conversation avec Akari part avec lui. Ça ne se récupère pas.',
    );
  });

  it('pose la typographie française sur le nom d’une étape', () => {
    expect(stage.carries('Prêt ?', { done: 0, total: 0 })).toBe(
      typeset('Prêt ? sort du plan. Ça ne se récupère pas.'),
    );
  });
});
