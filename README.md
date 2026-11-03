# Cyberslide

A neon 3D arcade snowboard game that runs in the browser. Vite + TypeScript + three.js.

**Play: https://realz4nix.github.io/Cyberslide/**

## Develop

```sh
npm install
npm run dev          # local server with hot reload
npm test             # unit tests (Vitest)
npm run typecheck    # tsc, strict
npm run format       # Prettier
npm run build        # production build into dist/
```

Every push to `main` runs typecheck, tests, format check and build, then deploys `dist/` to GitHub Pages
(`.github/workflows/deploy.yml`). Pull requests run the same checks without deploying.

## Controls

Arrows steer, hold and release Space to jump (press Space just before touchdown for a perfect landing).
In the air: tap arrows, then the flip (A/L) or grab (D/K) button for a trick. R restart, P pause, M mute.
All keys can be rebound in the settings; controllers work too.

## Power-ups

Spinning holograms on the track and in the sky. Track ones are common, sky ones float above kickers, big ramps and
quarterpipes and are stronger.

- **Overclock** (red bolt): short hard speed boost with a glitch effect
- **Score x2** (gold chip): double points for a few seconds
- **Combo shield** (cyan shield): your next bail within 20 s doesn't wipe the combo
- **Low-grav** (purple planet): floatier, higher jumps
- **Time chip** (green stopwatch, 2-minute mode only): adds seconds to the clock

## Layout

See [docs/structure.md](docs/structure.md) for what each module does and how they fit together.
