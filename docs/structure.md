# Project structure

The game used to be one `index.html` with 11 `<script>` blocks that shared a global `window.ND`. Each block is now
an ES module in `src/`, and the shared namespace lives in `src/nd.ts`. Modules still register on `ND` so the
game loop finds them the same way it always did; typed modules also export their pieces directly, which is what
tests and new code should import.

```
index.html            page markup (menus, HUD, overlays); loads src/main.ts
public/               copied as-is into the build: favicon.svg, favicon.ico, apple-touch-icon.png
docs/brand/           the icon source (icon.svg) and the GitHub social preview image
src/
  main.ts             entry: imports the modules in order, then boots the game
  nd.ts               shared namespace
  styles.css          all styling

  course.ts           the hill as pure data: run seed, feature deck, district order, bends, ramps, rails, dips,
                      walls, height field
  world.ts            turns the course into meshes and streams chunks around the rider
  powerups.ts         power-ups as pure data: where pickups sit, what each does, the timers on the rider
  pickups.ts          draws the pickups as spinning holograms and finds when the rider touches one
  city.ts             neon city scenery: districts, signs, billboards, steam, cables
  riders.ts           the four rider models plus secret SKELLY, their stats and stat-to-physics multipliers
  riderSelect.ts      the spinning rider ring in the menu
  player.ts           rider physics, tricks, grinds, landings, combo scoring
  scoring.ts          the speed and distance multipliers on banked combos
  tricks.ts           the trick list and how each trick is input
  tutorial.ts         learn-by-doing practice courses
  game.ts             renderer, camera, input, HUD, menus, modes, settings
  audio.ts            generated drum & bass soundtrack and sound effects (WebAudio)
  gamepad.ts          controller reading: dead-zone, edge detection, glyph names, rumble
  scores.ts           local scoreboard with a swappable backend
  secretCode.ts       watches typed letters or controller buttons for a cheat-code sequence
  rival.ts            the other rider in a 1v1 link: their model posed from received frames, glow, name tag
  net/
    codes.ts          invite/reply codes: the WebRTC offer/answer, compressed, with the build id inside
    link.ts           WebRTC peer connection: a reliable channel for messages, an unreliable one for poses
    protocol.ts       every 1v1 message and its validation
    session.ts        one link from lobby to rematch: hello, ready, the host's seed, poses, scores, results
    linkSteps.ts      the code-swap screens as a pure state machine
    pose.ts           the rider's whole look as one flat array: capture, blend, apply

  *.test.ts           tests sit next to the module they cover
  test-utils/         fake canvas/DOM and in-memory localStorage for tests
```

## Load order

`main.ts` imports modules in the same order the old `<script>` tags ran. Later modules read what earlier ones
registered on `ND` when they load (for example `city.ts` reads `ND.C` from the course), so keep that order when
adding imports.

## Typing status

`tsconfig.json` is strict. These modules are fully typed: `course`, `world`, `audio`, `scores`, `tricks`,
`gamepad`, `riderSelect`, `secretCode`, `powerups`, `pickups`, `rival`, `scoring` and everything in `net/`.

These were ported as-is and still start with `// @ts-nocheck`, so the compiler doesn't check them yet:
`player`, `game`, `city`, `riders`, `tutorial`. They behave exactly as before; typing them is the next step.
Removing the `@ts-nocheck` line from one shows its errors (`npm run typecheck`). Most are untyped parameters
and objects built up property by property.

## Tests

`npm test` runs Vitest in Node. three.js works without a GPU for geometry and maths, so the tests use the real
course and the real player physics. `test-utils/fakeDom.ts` stubs just enough canvas for modules that draw
textures when they load; import it first in a test that needs it.

- `course.test.ts`: same seed = same hill, different seeds differ, layout rules, the feature deck, the district
  shuffle bag, smooth bends, height field, rails (layout rules run on several seeds)
- `player.test.ts`: headless rides at 60 fps: speed, steering, charged jumps, landing, a kickflip, rider stats, the
  speed and distance multipliers on a bank (distance only when `distMulti` is on: the 2-minute run)
- `scoring.test.ts`: speed multiplier steps and cap, distance multiplier steps
- `tricks.test.ts`: every input is unique, point scaling, input labels
- `scores.test.ts`: ranking, ties, top 10, name cleaning, corrupt or blocked storage, swappable backend
- `gamepad.test.ts`: pad detection, dead-zone, press/release edges, stick hysteresis, rumble
- `audio.test.ts`: safe before the context exists, mixer setup, every sound effect, music scheduling
- `riders.test.ts`: stats, multipliers, every model builds, the secret rider unlock
- `secretCode.test.ts`: code sequences, junk input, wrong order, timeout between inputs
- `net/*.test.ts`: invite/reply codes, the WebRTC link on fake peer connections, message validation, the code-swap
  steps, the session from handshake to rematch, and a pose copied off the real player matching on the rival model
- `powerups.test.ts`: placement on several seeds (deterministic, leaves the course alone, track common / sky rare, any
  three in a row different, the same however the segments are asked for), touching,
  timers, every effect on the real player, and that a real jump reaches every sky pickup

## Random hill

Every run, restarts included, rolls a new seed (`world.reseed()` in `startRun`); the tutorial uses seed 0, the
fixed hill. The seed is mixed into every random stream that builds the hill (`mixSeed` in `course.ts`): segment
contents, bends, power-up spots and city scenery, so one seed always rebuilds the exact same run.

- **Feature deck.** Which feature comes next is dealt from a shuffled deck of 25 cards in the same shares the old
  weighted roll had (`DECK`), reshuffled when it runs out, so every 2-minute run sees about one full deck. The same
  feature never comes twice in a row, except bends. The safety rules are unchanged and don't use cards: a clear
  landing stretch after big jumps, megas, window rails, rail chains and pipes, and a landing slope after high rails.
- **Run-in.** One calm start segment (70 m) before the first feature.
- **Districts** are scenery only. Their order is a shuffle bag of all five (`districtAt`), each lasting 6 segments
  (420 m); a district never follows itself, not even across a reshuffle.

## 1v1 link

Two browsers connect directly over WebRTC (`net/link.ts`); there is no server. The host's invite code is its WebRTC
offer, the guest's reply code its answer, both deflated and base64url-encoded with the build id inside
(`net/codes.ts`). The build id is the package version plus the commit (`vite.config.ts`), so two different deploys
refuse to link instead of racing on hills that don't match. The connection layer is adapted from Drifta.

- **Same hill.** When both are ready the host rolls a seed and sends it with a 3 s countdown; the guest subtracts half
  the measured round trip, so both drop together. The seed builds the whole run (course, power-ups, city), so the
  hill is identical on both sides without sending any of it.
- **The rival.** 20 times a second each game sends its rider pose (`net/pose.ts`: 24 numbers covering position, body
  and board rotation, flips, grab pose, arms, crouch). The other side draws it 0.1 s behind real time, blending
  between the two frames around that moment (angles the short way round), with the sender's own rider model.
  Scores go 4 times a second over the reliable channel. Nothing collides and pickups are per player.
- **Flow.** Lobby (pick riders, ready locks your pick) → race → results side by side → both ask for a rematch and the
  host deals a new seed, or either player takes both back to the lobby. Esc in a race opens the menu over the
  running game. If the rival drops mid-race you keep riding and win.

## Power-ups

`powerups.ts` places them with its own seeded random stream, so the course itself never changes. Track pickups
(about one in every two segments) sit just above the snow, on the run-in to a ramp, or on top of a ground rail.
Sky pickups sit only above kickers, big ramps, mega ramps and side quarterpipes, a little above where an easy jump
peaks, so you have to commit to reach them; the test in `powerups.test.ts` rides real jumps to prove each one can be
reached. Which power a pickup gives is dealt from shuffled bags (`BAGS`) in the order you meet them down the hill, track and
sky as one line, so any three in a row are different; the 2-minute run and endless each have their own line (endless has
no time chips). Sky versions last about 50% longer (shield: 2 bails for 30 s instead of 1 for 20 s, time: +10 s). Grabbing a power that is already running
refreshes its timer. Time chips only exist in the 2-minute mode. The tutorial has none.

Picking one up shows a pop-up at the top centre with its icon, name and a draining bar; after about a second it
shrinks into its chip (boosts bottom left, shield bottom right) or, for a time chip, flies into the clock.

The effects live in `player.ts` (`power()`, plus the hooks in `addCombo`, `crash`, `ride`, `air` and `predict`), the
clock, HUD rack and screen effects in `game.ts`.
