/* CYBERSLIDE - run scoring that rewards going fast and going far: two multipliers on every banked combo, one for the
   speed you are doing when it banks and one for how far down the hill you are by then. They stack with each other
   and with the combo multiplier. Pure numbers; player.ts applies them, game.ts shows them. */

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

/** what each km down the hill adds to the distance multiplier */
export const DIST_STEP = 0.1;

/** combo multiplier for how far down the hill you are (2-minute runs only): x1.0 for the first km, +0.1 for every
 *  full km after that, no cap (the clock is the cap). Whole km, so the number on the HUD is the one a bank uses. */
export function distMult(dist: number): number {
  return Math.round((1 + DIST_STEP * Math.floor(Math.max(0, dist) / 1000)) * 10) / 10;
}
