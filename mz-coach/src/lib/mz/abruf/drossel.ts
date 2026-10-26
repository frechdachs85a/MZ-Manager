// Höfliches Abrufverhalten (Auftrag, Funktion 1): höchstens N Anfragen gleichzeitig und
// zwischen zwei Starts eine zufällige Pause. Ohne Abhängigkeit von Playwright, damit testbar.

export type DrosselOptionen = {
  maxParallel: number;
  pauseMinMs: number;
  pauseMaxMs: number;
  warte?: (ms: number) => Promise<void>;
  zufall?: () => number;
};

export const STANDARD_DROSSEL: DrosselOptionen = { maxParallel: 2, pauseMinMs: 2000, pauseMaxMs: 4000 };

const schlafen = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Drossel: höchstens N gleichzeitig, Pause zwischen den Starts
export function erzeugeDrossel(opt: DrosselOptionen = STANDARD_DROSSEL) {
  const warte = opt.warte ?? schlafen;
  const zufall = opt.zufall ?? Math.random;
  let laufend = 0;
  const schlange: (() => void)[] = [];
  // Starts laufen nacheinander durch diese Kette, damit die Pause zwischen allen Starts gilt.
  let startKette: Promise<void> = Promise.resolve();
  let ersterStart = true;

  async function platz() {
    if (laufend < opt.maxParallel) {
      laufend++;
      return;
    }
    await new Promise<void>((r) => schlange.push(r));
  }

  function frei() {
    const naechster = schlange.shift();
    if (naechster) naechster();
    else laufend--;
  }

  return async function gedrosselt<T>(aufgabe: () => Promise<T>): Promise<T> {
    await platz();
    try {
      const start = startKette.then(async () => {
        if (!ersterStart) {
          await warte(opt.pauseMinMs + Math.round(zufall() * (opt.pauseMaxMs - opt.pauseMinMs)));
        }
        ersterStart = false;
      });
      startKette = start;
      await start;
      return await aufgabe();
    } finally {
      frei();
    }
  };
}
