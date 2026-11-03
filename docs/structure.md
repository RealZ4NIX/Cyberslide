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
  city.ts             neon city scenery: districts, signs, billboards, steam, cables
  riders.ts           the four rider models, their stats and stat-to-physics multipliers
  riderSelect.ts      the spinning rider ring in the menu
  player.ts           rider physics, tricks, grinds, landings, combo scoring
  tricks.ts           the trick list and how each trick is input
  tutorial.ts         learn-by-doing practice courses
  game.ts             renderer, camera, input, HUD, menus, modes, settings
  audio.ts            generated drum & bass soundtrack and sound effects (WebAudio)
  gamepad.ts          controller reading: dead-zone, edge detection, glyph names, rumble
  scores.ts           local scoreboard with a swappable backend

  *.test.ts           tests sit next to the module they cover
  test-utils/         fake canvas/DOM and in-memory localStorage for tests
```

## Load order

`main.ts` imports modules in the same order the old `<script>` tags ran. Later modules read what earlier ones
registered on `ND` when they load (for example `city.ts` reads `ND.C` from the course), so keep that order when
adding imports.

## Typing status

`tsconfig.json` is strict. These modules are fully typed: `course`, `world`, `audio`, `scores`, `tricks`,
`gamepad`, `riderSelect`.

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
- `riders.test.ts`: stats, multipliers, every model builds
