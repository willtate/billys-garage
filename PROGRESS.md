# Vroom Garage: gauntlet loop progress

**Goal:** a 3D iPad car builder (iOS 15+) for a 3-year-old. Pick a body, wheels, paint, and a fun topper, then spin the car around and press GO.

**Bar:** *Labo Brick Car 2* (App Store id 1510879459). Its iPad screenshots are saved in `gauntlet/bar/`. A separate critic with fresh context compares our screenshots against those, blind, and picks one. The loop exits only when ours wins.

## Pieces under judgement

| Piece | Status | Last critic pick | Biggest gap named |
|---|---|---|---|
| Car look and charm (bodies, driver) | building | not judged yet | not judged yet |
| Wheels | building | not judged yet | not judged yet |
| Scene and world | building | not judged yet | not judged yet |
| Part picker UI (for a 3-year-old) | building | not judged yet | not judged yet |
| Feedback and juice (sound, motion) | building | not judged yet | not judged yet |

## Log

- **Round 0:** Scaffold: SceneKit turntable, 6 bodies, 6 wheels, 12 paints, 7 toppers, synthesized sounds, 3D-rendered part cards, GO and honk buttons. Builds clean for iOS 15.
- **Round 0.5:** Fixed the biggest known gap against the bar before judging started: every car now has a smiling, blinking driver behind see-through windows. Added trees, hills, flowers, and drifting clouds.
- **Round 1 (critic picked the bar):** "Cars look like untextured programmer primitives with no life." It also flagged: car shown from behind, no visible driver, a dull muddy world, and small look-alike thumbnails. Bugs fixed before judging: turntable z-fighting, grey fog, a too-steep camera, and HDR darkening the sky.
- **Round 2 build:**
  - The car sways around a three-quarter front view.
  - Glass is truly see-through, and the drivers are bigger.
  - Added chrome headlight rims, grilles, mirrors, and racing numbers.
  - Real star hubcaps.
  - A road ring with red and white curbs, plus a toy town.
  - GO now drives a full lap of the road and spins home.
  - Bigger picker thumbnails.
