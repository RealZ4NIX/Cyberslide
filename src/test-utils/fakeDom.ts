/* Test helper: just enough DOM for modules that draw canvas textures when they load (world, player).
   Import it first in a test file: ES modules evaluate in import order, so the globals exist before the game code runs.
   Every 2D-context call is a harmless no-op; three.js only keeps a reference to the canvas, nothing is rendered. */

const noop = (): void => {};
const gradient = { addColorStop: noop };

function fakeContext(): CanvasRenderingContext2D {
  const store: Record<string | symbol, unknown> = {};
  return new Proxy(store, {
    get(t, prop) {
      if (prop in t) return t[prop];
      if (prop === 'measureText') return () => ({ width: 10 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradient;
      if (prop === 'getImageData')
        return (_x: number, _y: number, w: number, h: number) => ({
          data: new Uint8ClampedArray(w * h * 4),
          width: w,
          height: h,
        });
      return noop;
    },
    set(t, prop, v) {
      t[prop] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

function fakeCanvas() {
  const ctx = fakeContext();
  return { width: 300, height: 150, style: {}, getContext: () => ctx, addEventListener: noop };
}

const g = globalThis as unknown as Record<string, unknown>;
if (!g.document) {
  g.document = {
    createElement: (tag: string) =>
      tag === 'canvas' ? fakeCanvas() : { style: {}, appendChild: noop },
    createElementNS: (_ns: string, tag: string) =>
      tag === 'canvas' ? fakeCanvas() : { style: {} },
    getElementById: () => null,
    querySelectorAll: () => [],
  };
}

export {};
