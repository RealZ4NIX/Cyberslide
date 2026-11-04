<div align="center">

<img src="docs/screenshots/menu.jpg" alt="Cyberslide main menu with the rider ring" width="100%">

# CYBERSLIDE

**A neon 3D arcade snowboard game for the browser.**<br>
Drop down an endless hill through a cyberpunk city, chain tricks and grinds, nail the perfect landing.

[![Play now](https://img.shields.io/badge/%E2%96%B6%20PLAY%20NOW-realz4nix.github.io%2FCyberslide-ff3fd0?style=for-the-badge&labelColor=1a0b2e)](https://realz4nix.github.io/Cyberslide/)

[![Deploy](https://github.com/RealZ4NIX/Cyberslide/actions/workflows/deploy.yml/badge.svg)](https://github.com/RealZ4NIX/Cyberslide/actions/workflows/deploy.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-2ff0ff?logo=typescript&logoColor=white&labelColor=1a0b2e)
![three.js](https://img.shields.io/badge/three.js-r128-39ff88?logo=threedotjs&logoColor=white&labelColor=1a0b2e)
![Vite](https://img.shields.io/badge/Vite-build-ffc23f?logo=vite&logoColor=white&labelColor=1a0b2e)
![Controller](https://img.shields.io/badge/controller-supported-b07cff?logo=playstation&logoColor=white&labelColor=1a0b2e)

<img src="docs/screenshots/gameplay.webp" alt="Gameplay: up the side quarterpipe, a special in the air, perfect landing into a sky launch" width="720">

</div>

---

## The run

Retro PS2 looks, neon towers on both sides, a generated drum & bass soundtrack and a hill that never ends. Carve the
bends, launch off kickers and quarterpipes, flip and grab in the air, then tap **Space** right before touchdown for a
**perfect landing**. Easy to learn, hard to master.

<img src="docs/screenshots/sky-special.jpg" alt="High above the side quarterpipe, doing Does W. a Spider Can in front of the sun" width="100%">
<p align="center"><sub><b>NOSEGRAB + DOES W. A SPIDER CAN</b> Off the lip of a side quarterpipe: <kbd>←</kbd> <kbd>↓</kbd> + <kbd>A</kbd> with a full special meter</sub></p>

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/perfect-landing.jpg" alt="Perfect landing out of a quarterpipe"></td>
    <td width="50%"><img src="docs/screenshots/overclock.jpg" alt="Overclock power-up active at 321 km/h"></td>
  </tr>
  <tr>
    <td align="center"><sub><b>PERFECT!</b> Back down from a quarterpipe, combo still alive</sub></td>
    <td align="center"><sub><b>OVERCLOCK</b> Speed boost with a glitch effect</sub></td>
  </tr>
</table>

## Features

- **Two modes:** a 2-minute score attack and an endless run
- **1V1 LINK:** race a friend online on the same random hill, no account or server
- **64 tricks:** flip tricks, grab tricks and specials, each a short arrow sequence plus one button
- **Combos that pay:** a spin or flip mixed with tricks in one jump scores as one big trick
- **Speed pays:** a combo banks with a speed multiplier, up to x1.5 at 300 km/h
- **Distance pays:** in the 2-minute run, every km down the hill adds x0.1 to your combos, on top of the speed multiplier
- **Perfect landings:** time your tap to land clean, get a speed boost and build a perfect streak
- **Rails and quarterpipes:** grind ground rails, launch out of the side pipes, reach for the sky pickups
- **Power-ups** on the track and in the sky
- **Four riders** with their own stats and weaknesses (and maybe one more, if you know the code)
- **Learn-by-doing tutorial** from your first carve to your first special
- **Local scoreboard** with the top 10 runs per mode
- **Phones and tablets:** plays in the browser in landscape with a touch D-pad and four buttons, sized and laid out
  your way in the options. Install it to the home screen to play fullscreen (Android: INSTALL APP in the menu, iPhone:
  Share, then Add to Home Screen)
- **Full controller support:** analog steering, rumble, menu navigation, remapping and auto-switching button prompts
- **Options** for audio, key bindings, field of view, resolution, a CRT filter and more

## Riders

<img src="docs/screenshots/riders.jpg" alt="The four riders: Nova, Volt, Hex and Chrome" width="100%">

| Rider      | Role          | Plays like                                             | Weakness                      |
| ---------- | ------------- | ------------------------------------------------------ | ----------------------------- |
| **NOVA**   | All-rounder   | Balanced in everything. The place to learn the hill.   | No standout strength          |
| **VOLT**   | Speed courier | Fastest down the hill. Wide turns, short combo window. | Hard to steer, risky landings |
| **HEX**    | Trick hacker  | Fast spins, high pops and a long combo window.         | Weak on rails                 |
| **CHROME** | Heavy grinder | Rails pay big and landings forgive.                    | Low pop, slow spins           |

## Controls

| Action                 | Keyboard                                   | Controller                  | Touch                        |
| ---------------------- | ------------------------------------------ | --------------------------- | ---------------------------- |
| Carve                  | <kbd>←</kbd> <kbd>→</kbd>                  | Left stick / D-pad          | D-pad                        |
| Tuck for speed / brake | <kbd>↑</kbd> / <kbd>↓</kbd>                | Left stick / D-pad          | D-pad                        |
| Jump (hold & release)  | <kbd>Space</kbd>                           | Cross / A                   | JUMP                         |
| Perfect landing        | Tap <kbd>Space</kbd> just before touchdown | Cross / A                   | Tap JUMP                     |
| Flip trick             | Arrows, then <kbd>A</kbd> or <kbd>L</kbd>  | Direction, then Square / X  | D-pad, then FLIP             |
| Grab trick             | Arrows, then <kbd>D</kbd> or <kbd>K</kbd>  | Direction, then Circle / B  | D-pad, then GRAB             |
| Body spin & flip       | <kbd>S</kbd> or <kbd>J</kbd> + arrow       | L2 / R2 + direction         | Hold SPIN + D-pad            |
| Pause · Restart · Mute | <kbd>P</kbd> · <kbd>R</kbd> · <kbd>M</kbd> | Options · Create · Touchpad | ❚❚ at the top, then the menu |

Stop tricking for 2 seconds to bank your combo; land wrong and it's gone. The speed you are doing when it banks
multiplies it: x1.0 up to 100 km/h, +0.1 for every 40 km/h above that, x1.5 from 300 km/h (shown over the km/h).
In the 2-minute run, how far down the hill you are multiplies it too: +0.1 for every full km (shown under the
distance), stacked on top of the speed multiplier. Every trick fills the special meter, and
once it's full you can throw specials. Specials in a mega quarterpipe air pay double. All keys and buttons can be
rebound in the options.

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/all-tricks.jpg" alt="Trickbook: every trick with its input"></td>
    <td width="50%"><img src="docs/screenshots/tutorial.jpg" alt="Tutorial: the carve step"></td>
  </tr>
  <tr>
    <td align="center"><sub><b>TRICKBOOK</b> Every input on one screen, with controller buttons when a pad is connected</sub></td>
    <td align="center"><sub><b>TUTORIAL</b> Learn by doing, step by step</sub></td>
  </tr>
</table>

## Power-ups

Spinning holograms on the track and in the sky. Track ones are common; sky ones float above kickers, big ramps and
quarterpipes and are stronger. Grabbing one that is already running refreshes its timer. They are dealt from a
shuffled bag, so any three in a row are three different powers.

| Power-up         | Icon               | Effect                                            |
| ---------------- | ------------------ | ------------------------------------------------- |
| **Overclock**    | 🟥 red bolt        | Short, hard speed boost with a glitch effect      |
| **Score x2**     | 🟨 gold chip       | Double points for a few seconds                   |
| **Combo shield** | 🟦 cyan shield     | Your next bail within 20 s doesn't wipe the combo |
| **Low-grav**     | 🟪 purple planet   | Floatier, higher jumps                            |
| **Time chip**    | 🟩 green stopwatch | Adds seconds to the clock (2-minute mode only)    |

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/high-score.jpg" alt="High score name entry"></td>
    <td width="50%"><img src="docs/screenshots/options.jpg" alt="Options menu"></td>
  </tr>
  <tr>
    <td align="center"><sub><b>HIGH SCORE</b> Put your name on the board</sub></td>
    <td align="center"><sub><b>OPTIONS</b> Audio, key bindings, graphics</sub></td>
  </tr>
</table>

## 1V1 Link

Race a friend on the same random hill for 2 minutes; the higher score wins.

1. Both players open the same version of the game (refresh if the lobby says the versions differ).
2. Pick **1V1 LINK** on the main menu. The first time, type the name your rival will see over your rider.
3. Host: **HOST**, copy the invite and send it to your friend in any chat.
4. Friend: **JOIN**, paste the invite, then copy the reply and send it back.
5. Host: paste the reply. The link connects straight from browser to browser (WebRTC).
6. Pick your rider with ← →, both press **READY** and you drop on the same countdown.

During the race you see your rival's rider doing their tricks live, with their name and score above them and the
gap in the top right. Power-ups are your own, riders pass through each other, and Esc opens a menu over the running
race (there is no pause or restart). Leaving the lobby asks first, since it closes the link. After the run, **REMATCH** gives you both a brand new hill. Runs count for your
local scoreboard. Some school or office networks block direct connections; try another network if it won't link.

## Develop

Built with Vite, TypeScript and three.js. The soundtrack and sound effects are generated live with WebAudio.

```sh
npm install
npm run dev          # local server with hot reload (add ?runlen=20 to the URL for short 2-minute runs)
npm test             # unit tests (Vitest)
npm run typecheck    # tsc, strict
npm run format       # Prettier
npm run build        # production build into dist/
```

Every push to `main` runs typecheck, tests, format check and build, then deploys `dist/` to GitHub Pages
(`.github/workflows/deploy.yml`). Pull requests run the same checks without deploying.

See [docs/structure.md](docs/structure.md) for what each module does and how they fit together.

<div align="center">
<br>
<sub>Made with neon, snow and drum & bass.</sub>
</div>
