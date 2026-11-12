# Vroom Garage: gauntlet loop progress

**Goal:** a 3D iPad car builder (iOS 15+) for a 3-year-old. Pick a body, wheels, paint, and a fun topper, then spin the car around and press GO.

**Bar:** *Labo Brick Car 2* (App Store id 1510879459). Its iPad screenshots are saved in `gauntlet/bar/`. A separate critic with fresh context compares our screenshots against those, blind, and picks one. The loop exits only when ours wins.

## Pieces under judgement

| Piece | Status | Last critic pick | Biggest gap named |
|---|---|---|---|
| Round | Blind pick | Biggest gap named |
|---|---|---|
| 1 | Bar (Labo) | Cars look like crude programmer primitives with no driver; shown from behind |
| 2 | Bar (Labo) | Still placeholder geometry: no arches or livery; tiny driver face; mid-lap shot looked broken |
| 3 | **Ours** | (said of Labo) Abstract look-alike parts, no visible goal or GO payoff, washed-out world |

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
- **Round 3 build:**
  - Fender arches over the wheels.
  - Airfoil-shaped wings.
  - Bobble-head drivers with bigger eyes and smiles, who turn to face the camera.
  - Googly eyes moved to the hood.
  - Topper cards show the whole car wearing the topper.
  - Varied trees (round, pine, berry bush, poplar), petal flowers, chimneys and shop awnings.
  - Smooth curves on every extruded shape.
  - The camera frames each car to its size.
- **Round 3 verdict: ours won blind.** The judge still called the bar "the more skilled illustration," but picked ours on toddler appeal, big clear choices, and the GO payoff. The loop's exit condition is met.

## Known gaps worth another loop
- Illustration craft: the bar's art is still more detailed (panel lines, spoked wire wheels, door handles).
- Not yet judged: motion and sound. The judge only sees still screenshots.
- Not yet hand-tested in the simulator: tapping, dragging, pinching, honk on tap.
