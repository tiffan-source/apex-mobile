import { TaskTrace } from './task-trace';

/* La trace d'un pas effacé : une à la fois ; remise, le pas ne part pas ; finie, il part pour de bon. */

function setup() {
  const erased: string[] = [];
  const trace = new TaskTrace((taskId) => erased.push(taskId));
  return { trace, erased };
}

describe('TaskTrace', () => {
  it('un pas effacé laisse sa trace ; il ne part qu’à la fin de la trace', () => {
    const { trace, erased } = setup();
    trace.start('p1');
    expect(trace.erasing$.get()).toBe('p1');
    expect(erased).toEqual([]);
    trace.expire('p1');
    expect(trace.erasing$.get()).toBeNull();
    expect(erased).toEqual(['p1']);
  });

  it('« Remettre » : le pas reste', () => {
    const { trace, erased } = setup();
    trace.start('p1');
    trace.putBack('p1');
    expect(trace.erasing$.get()).toBeNull();
    expect(erased).toEqual([]);
  });

  it('une trace à la fois : un autre pas effacé fait partir celui qui attendait', () => {
    const { trace, erased } = setup();
    trace.start('p1');
    trace.start('p2');
    expect(trace.erasing$.get()).toBe('p2');
    expect(erased).toEqual(['p1']);
    // La trace remplacée le redit en partant : l'effacement l'ignore (le pas n'est plus là).
    trace.expire('p1');
    expect(trace.erasing$.get()).toBe('p2');
    // Une trace remise après avoir été remplacée ne touche pas à celle qui est à l'écran.
    trace.putBack('p1');
    expect(trace.erasing$.get()).toBe('p2');
  });

  it('la fin d’une session oublie la trace', () => {
    const { trace, erased } = setup();
    trace.start('p1');
    trace.clear();
    expect(trace.erasing$.get()).toBeNull();
    expect(erased).toEqual([]);
  });
});
