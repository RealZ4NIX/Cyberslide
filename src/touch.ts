/* CYBERSLIDE - touch controls for phones and tablets: a D-pad on one side, a diamond of four buttons on the other,
   and a pause button at the top. The D-pad reads 8 directions from where the thumb is (sliding between arms gives the
   diagonals the trickbook uses). The diamond lets a thumb slide from one button to the next, so JUMP can roll into
   FLIP without lifting. game.ts merges what this reports with the keyboard and the controller. */

export type TouchAct = 'space' | 'flip' | 'grab' | 'trick';
export interface TouchInput {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  space: boolean;
  trick: boolean;
  grab: boolean;
  flip: boolean;
}
export interface Dirs {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
}

/** labels on the buttons, also used for prompts in the tutorial, trickbook and menus */
export const TOUCH_LABEL: Record<TouchAct, string> = {
  space: 'JUMP',
  flip: 'FLIP',
  grab: 'GRAB',
  trick: 'SPIN',
};
/** where each button sits in the diamond */
export const DIAMOND: Record<TouchAct, 'b' | 'l' | 'r' | 't'> = {
  space: 'b',
  flip: 'l',
  grab: 'r',
  trick: 't',
};

const NONE: Dirs = { left: false, right: false, up: false, down: false };

/**
 * D-pad: the thumb's offset from the centre (screen pixels, y down) and the pad radius give the pushed arms.
 * Inside the dead zone nothing is pushed. The circle is cut into 8 equal slices: the four straight ones push one arm,
 * the four between them push two (a diagonal).
 */
export function dpadDirs(dx: number, dy: number, radius: number, dead = 0.22): Dirs {
  const d = Math.hypot(dx, dy);
  if (d < radius * dead) return { ...NONE };
  const a = Math.atan2(-dy, dx); // 0 = right, counter-clockwise, up is +90°
  const slice = Math.round(a / (Math.PI / 4)); // -4..4
  const s = ((slice % 8) + 8) % 8; // 0 R, 1 UR, 2 U, 3 UL, 4 L, 5 DL, 6 D, 7 DR
  return {
    right: s === 7 || s === 0 || s === 1,
    up: s === 1 || s === 2 || s === 3,
    left: s === 3 || s === 4 || s === 5,
    down: s === 5 || s === 6 || s === 7,
  };
}

export interface ButtonSpot {
  act: TouchAct;
  x: number;
  y: number;
  r: number;
}
/** which button a finger is on: the nearest one whose (slightly enlarged) circle contains the point, or null */
export function pickButton(
  spots: readonly ButtonSpot[],
  x: number,
  y: number,
  grow = 1.2,
): TouchAct | null {
  let best: TouchAct | null = null,
    bd = Infinity;
  for (const s of spots) {
    const d = Math.hypot(x - s.x, y - s.y);
    if (d <= s.r * grow && d < bd) {
      bd = d;
      best = s.act;
    }
  }
  return best;
}

export interface TouchLayout {
  size: number; // 0.8 small, 1 medium, 1.2 large
  alpha: number; // 0.3 .. 1
  swap: boolean; // true: D-pad on the right, buttons on the left
}

export interface TouchControls {
  readonly input: TouchInput;
  /** show the controls (a run is on screen) or hide them (menus, or another device took over) */
  setVisible(on: boolean): void;
  setLayout(l: TouchLayout): void;
  /** let go of everything, e.g. when a menu opens */
  release(): void;
}

const svgArm = (cls: string, d: string) => '<path class="' + cls + '" d="' + d + '"/>';

/** builds the controls into `root` (the game container). onPause runs when the pause button is tapped. */
export function createTouchControls(root: HTMLElement, onPause: () => void): TouchControls {
  const input: TouchInput = {
    left: false,
    right: false,
    up: false,
    down: false,
    space: false,
    trick: false,
    grab: false,
    flip: false,
  };
  const wrap = document.createElement('div');
  wrap.id = 'touch';
  wrap.hidden = true;
  wrap.innerHTML =
    '<div class="t-pad" aria-hidden="true"><svg viewBox="0 0 100 100">' +
    '<circle class="t-ring" cx="50" cy="50" r="47"/>' +
    svgArm('t-arm u', 'M38 8H62V36L50 46 38 36Z') +
    svgArm('t-arm d', 'M38 92H62V64L50 54 38 64Z') +
    svgArm('t-arm l', 'M8 38V62H36L46 50 36 38Z') +
    svgArm('t-arm r', 'M92 38V62H64L54 50 64 38Z') +
    '<circle class="t-hub" cx="50" cy="50" r="7"/>' +
    '<circle class="t-thumb" cx="50" cy="50" r="13"/>' +
    '</svg></div>' +
    '<div class="t-dia" aria-hidden="true">' +
    (Object.keys(DIAMOND) as TouchAct[])
      .map(
        (a) =>
          '<div class="t-btn ' +
          DIAMOND[a] +
          ' a-' +
          a +
          '" data-act="' +
          a +
          '"><b>' +
          TOUCH_LABEL[a] +
          '</b></div>',
      )
      .join('') +
    '</div>' +
    '<button class="t-pause" type="button" aria-label="Pause"><i></i><i></i></button>';
  root.appendChild(wrap);
  const pad = wrap.querySelector('.t-pad') as HTMLElement;
  const dia = wrap.querySelector('.t-dia') as HTMLElement;
  const thumb = wrap.querySelector('.t-thumb') as SVGCircleElement;
  const arms: Record<keyof Dirs, Element> = {
    up: wrap.querySelector('.t-arm.u')!,
    down: wrap.querySelector('.t-arm.d')!,
    left: wrap.querySelector('.t-arm.l')!,
    right: wrap.querySelector('.t-arm.r')!,
  };
  const btnEl = {} as Record<TouchAct, HTMLElement>;
  dia.querySelectorAll<HTMLElement>('.t-btn').forEach((b) => {
    btnEl[b.dataset.act as TouchAct] = b;
  });
  wrap.addEventListener('contextmenu', (e) => e.preventDefault());

  /* ---- D-pad: one finger owns it at a time ---- */
  let padId: number | null = null;
  function padAt(cx: number, cy: number) {
    const r = pad.getBoundingClientRect();
    const rad = r.width / 2,
      dx = cx - (r.left + rad),
      dy = cy - (r.top + rad);
    const d = dpadDirs(dx, dy, rad);
    for (const k of ['left', 'right', 'up', 'down'] as const) {
      input[k] = d[k];
      arms[k].classList.toggle('on', d[k]);
    }
    // the thumb dot follows the finger, kept inside the ring (viewBox units: 100 = the pad's width)
    const len = Math.hypot(dx, dy),
      lim = rad * 0.62,
      k = len > lim ? lim / len : 1;
    thumb.setAttribute('cx', String(50 + ((dx * k) / rad) * 50));
    thumb.setAttribute('cy', String(50 + ((dy * k) / rad) * 50));
    pad.classList.add('held');
  }
  function padOff() {
    padId = null;
    for (const k of ['left', 'right', 'up', 'down'] as const) {
      input[k] = false;
      arms[k].classList.remove('on');
    }
    thumb.setAttribute('cx', '50');
    thumb.setAttribute('cy', '50');
    pad.classList.remove('held');
  }
  pad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (padId !== null) return;
    padId = e.pointerId;
    try {
      pad.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    padAt(e.clientX, e.clientY);
  });
  pad.addEventListener('pointermove', (e) => {
    if (e.pointerId === padId) padAt(e.clientX, e.clientY);
  });
  const padUp = (e: PointerEvent) => {
    if (e.pointerId === padId) padOff();
  };
  pad.addEventListener('pointerup', padUp);
  pad.addEventListener('pointercancel', padUp);
  pad.addEventListener('lostpointercapture', padUp);

  /* ---- diamond: every finger is on at most one button, and can slide to another ---- */
  const fingers = new Map<number, TouchAct | null>();
  let spots: ButtonSpot[] = [];
  function measure() {
    spots = (Object.keys(btnEl) as TouchAct[]).map((a) => {
      const r = btnEl[a].getBoundingClientRect();
      return { act: a, x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 };
    });
  }
  function paintButtons() {
    const held = new Set(fingers.values());
    for (const a of Object.keys(btnEl) as TouchAct[]) {
      input[a] = held.has(a);
      btnEl[a].classList.toggle('on', input[a]);
    }
  }
  function diaAt(id: number, x: number, y: number) {
    const was = fingers.get(id) ?? null,
      now = pickButton(spots, x, y);
    if (was === now && fingers.has(id)) return;
    fingers.set(id, now);
    paintButtons();
  }
  dia.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    measure();
    try {
      dia.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    diaAt(e.pointerId, e.clientX, e.clientY);
  });
  dia.addEventListener('pointermove', (e) => {
    if (fingers.has(e.pointerId)) diaAt(e.pointerId, e.clientX, e.clientY);
  });
  const diaUp = (e: PointerEvent) => {
    if (fingers.delete(e.pointerId)) paintButtons();
  };
  dia.addEventListener('pointerup', diaUp);
  dia.addEventListener('pointercancel', diaUp);
  dia.addEventListener('lostpointercapture', diaUp);

  const pauseBtn = wrap.querySelector('.t-pause') as HTMLButtonElement;
  pauseBtn.addEventListener('pointerdown', (e) => e.preventDefault());
  pauseBtn.addEventListener('click', () => onPause());

  function release() {
    padOff();
    fingers.clear();
    paintButtons();
  }
  return {
    input,
    setVisible(on) {
      if (wrap.hidden === !on) return;
      wrap.hidden = !on;
      if (!on) release();
    },
    setLayout(l) {
      // on the game container, so the HUD can make room for the controls too
      root.style.setProperty('--ts', String(l.size));
      root.style.setProperty('--ta', String(l.alpha));
      root.classList.toggle('tswap', l.swap);
    },
    release,
  };
}
