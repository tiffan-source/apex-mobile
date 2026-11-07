import { TaskTrace } from './task-trace';

/* La trace d'un pas effacé : une à la fois ; remise, le pas ne part pas ; finie, il part pour de bon, une fois. */

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

  it('« Remettre » : le pas reste, et sa trace qui part ne l’efface pas', () => {
    const { trace, erased } = setup();
    trace.start('p1');
    trace.putBack('p1');
    trace.expire('p1');
    expect(trace.erasing$.get()).toBeNull();
    expect(erased).toEqual([]);
  });

  it('une trace à la fois : un autre pas effacé fait partir celui qui attendait, une seule fois', () => {
    const { trace, erased } = setup();
    trace.start('p1');
    trace.start('p2');
    expect(trace.erasing$.get()).toBe('p2');
    expect(erased).toEqual(['p1']);
    // La trace remplacée le redit en quittant l'écran : rien ne part une seconde fois.
    trace.expire('p1');
    trace.putBack('p1');
    expect(erased).toEqual(['p1']);
    expect(trace.erasing$.get()).toBe('p2');
  });

  it('le pas qui attendait part avant que la trace change : l’écran ne le voit jamais revenir', () => {
    const seen: (string | null)[] = [];
    const trace = new TaskTrace(() => seen.push(trace.erasing$.get()));
    trace.start('p1');
    trace.start('p2');
    trace.expire('p2');
    expect(seen).toEqual(['p1', 'p2']);
  });

  it('un autre effacement (une étape, un objectif) fait d’abord partir le pas qui attendait', () => {
    const { trace, erased } = setup();
    trace.flush();
    expect(erased).toEqual([]);
    trace.start('p1');
    trace.flush();
    expect(erased).toEqual(['p1']);
    expect(trace.erasing$.get()).toBeNull();
  });

  it('sait si l’arête montre un pas, tant qu’elle est ouverte', () => {
    const { trace } = setup();
    expect(trace.canShow('p1')).toBe(false);
    const hide = trace.showing(['p1', 'p2']);
    expect(trace.canShow('p1')).toBe(true);
    const hideNext = trace.showing(['p2']);
    // L'ancienne arête qui se ferme ne cache pas la nouvelle.
    hide();
    expect(trace.canShow('p2')).toBe(true);
    expect(trace.canShow('p1')).toBe(false);
    hideNext();
    expect(trace.canShow('p2')).toBe(false);
  });

  it('la fin d’une session oublie la trace', () => {
    const { trace, erased } = setup();
    trace.showing(['p1']);
    trace.start('p1');
    trace.clear();
    trace.expire('p1');
    expect(trace.erasing$.get()).toBeNull();
    expect(trace.canShow('p1')).toBe(false);
    expect(erased).toEqual([]);
  });
});
