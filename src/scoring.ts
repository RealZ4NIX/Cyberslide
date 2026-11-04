/* CYBERSLIDE - run scoring that rewards going fast and going far: the speed multiplier on banked combos and the
   distance points that trickle in as you ride down the hill. Pure numbers; player.ts applies them, game.ts shows them. */

/** km/h where the speed multiplier starts climbing */
export const SPEED_FLOOR = 100;
/** km/h for each +0.1 */
export const SPEED_STEP = 40;
/** highest speed multiplier (reached at 300 km/h) */
export const SPEED_MAX = 1.5;

/** combo multiplier for riding at `speed` (m/s): x1.0 up to 100 km/h, +0.1 for every 40 km/h above, x1.5 at most.
 *  Whole 0.1 steps, so the number on the HUD is the one a bank uses. */
export function speedMult(speed: number): number {
  const kmh = speed * 3.6;
  const steps = Math.floor(Math.max(0, kmh - SPEED_FLOOR) / SPEED_STEP);
  return Math.min(SPEED_MAX, Math.round((1 + 0.1 * steps) * 10) / 10);
}

/** distance points per metre at the start of the hill */
export const DIST_BASE = 1;
/** extra points per metre for every km already ridden */
export const DIST_GROW = 1;
/** most points per metre (reached 9 km down) */
export const DIST_MAX = 10;

/** distance points per metre at `dist` metres down the hill: 1 at the top, +1 every km, 10 at most */
export function distRate(dist: number): number {
  return Math.min(DIST_MAX, DIST_BASE + (DIST_GROW * Math.max(0, dist)) / 1000);
}

/** total distance points for riding from the top to `dist` metres (the integral of distRate) */
export function distPoints(dist: number): number {
  const d = Math.max(0, dist),
    cap = ((DIST_MAX - DIST_BASE) / DIST_GROW) * 1000; // where the rate stops growing
  const a = Math.min(d, cap);
  return DIST_BASE * a + (DIST_GROW * a * a) / 2000 + DIST_MAX * Math.max(0, d - cap);
}
