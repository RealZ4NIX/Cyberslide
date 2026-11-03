# Project structure

The game used to be one `index.html` with 11 `<script>` blocks that shared a global `window.ND`. Each block is now
an ES module in `src/`, and the shared namespace lives in `src/nd.ts`. Modules still register on `ND` so the
game loop finds them the same way it always did; typed modules also export their pieces directly, which is what
tests and new code should import.

```
index.html            page markup (menus, HUD, overlays); loads src/main.ts
src/
  main.ts             entry: imports the modules in order, then boots the game
  nd.ts               shared namespace
  styles.css          all styling

  course.ts           the hill as pure data: segment kinds, bends, ramps, rails, dips, walls, height field
  world.ts            turns the course into meshes and streams chunks around the rider
  powerups.ts         power-ups as pure data: where pickups sit, what each does, the timers on the rider
  pickups.ts          draws the pickups as spinning holograms and finds when the rider touches one
  city.ts             neon city scenery: districts, signs, billboards, steam, cables
  riders.ts           the four rider models plus secret SKELLY, their stats and stat-to-physics multipliers
  riderSelect.ts      the spinning rider ring in the menu
  player.ts           rider physics, tricks, grinds, landings, combo scoring
  tricks.ts           the trick list and how each trick is input
  tutorial.ts         learn-by-doing practice courses
  game.ts             renderer, camera, input, HUD, menus, modes, settings
  audio.ts            generated drum & bass soundtrack and sound effects (WebAudio)
  gamepad.ts          controller reading: dead-zone, edge detection, glyph names, rumble
  scores.ts           local scoreboard with a swappable backend
  secretCode.ts       watches typed letters or controller buttons for a cheat-code sequence

  *.test.ts           tests sit next to the module they cover
  test-utils/         fake canvas/DOM and in-memory localStorage for tests
```

## Load order

`main.ts` imports modules in the same order the old `<script>` tags ran. Later modules read what earlier ones
registered on `ND` when they load (for example `city.ts` reads `ND.C` from the course), so keep that order when
adding imports.

## Typing status

`tsconfig.json` is strict. These modules are fully typed: `course`, `world`, `audio`, `scores`, `tricks`,
`gamepad`, `riderSelect`, `secretCode`, `powerups`, `pickups`.

These were ported as-is and still start with `// @ts-nocheck`, so the compiler doesn't check them yet:
`player`, `game`, `city`, `riders`, `tutorial`. They behave exactly as before; typing them is the next step.
Removing the `@ts-nocheck` line from one shows its errors (`npm run typecheck`). Most are untyped parameters
and objects built up property by property.

## Tests

`npm test` runs Vitest in Node. three.js works without a GPU for geometry and maths, so the tests use the real
course and the real player physics. `test-utils/fakeDom.ts` stubs just enough canvas for modules that draw
textures when they load; import it first in a test that needs it.

- `course.test.ts`: determinism, layout rules, smooth bends, height field, rails
- `player.test.ts`: headless rides at 60 fps: speed, steering, charged jumps, landing, a kickflip, rider stats
- `tricks.test.ts`: every input is unique, point scaling, input labels
- `scores.test.ts`: ranking, ties, top 10, name cleaning, corrupt or blocked storage, swappable backend
- `gamepad.test.ts`: pad detection, dead-zone, press/release edges, stick hysteresis, rumble
- `audio.test.ts`: safe before the context exists, mixer setup, every sound effect, music scheduling
- `riders.test.ts`: stats, multipliers, every model builds, the secret rider unlock
- `secretCode.test.ts`: code sequences, junk input, wrong order, timeout between inputs
- `powerups.test.ts`: placement (deterministic, leaves the course alone, track common / sky rare), touching,
  timers, every effect on the real player, and that a real jump reaches every sky pickup

## Power-ups

`powerups.ts` places them with its own seeded random stream, so the course itself never changes. Track pickups
(about one in every two segments) sit just above the snow, on the run-in to a ramp, or on top of a ground rail.
Sky pickups sit only above kickers, big ramps, mega ramps and side quarterpipes, a little above where an easy jump
peaks, so you have to commit to reach them; the test in `powerups.test.ts` rides real jumps to prove each one can be
reached. Sky versions last about 50% longer (shield: 2 bails for 30 s instead of 1 for 20 s, time: +10 s). Grabbing a power that is already running
refreshes its timer. Time chips only appear as time chips in the 2-minute mode; in endless the same spot gives
another power. The tutorial has none.

Picking one up shows a pop-up at the top centre with its icon, name and a draining bar; after about a second it
shrinks into its chip (boosts bottom left, shield bottom right) or, for a time chip, flies into the clock.

The effects live in `player.ts` (`power()`, plus the hooks in `addCombo`, `crash`, `ride`, `air` and `predict`), the
clock, HUD rack and screen effects in `game.ts`.
