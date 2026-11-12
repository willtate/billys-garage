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
| 4 | **Ours** (new judge, unseen Labo shots) | (said of Labo) Black-silhouette parts trays, text a toddler can't read, small driver |
| 5 (new bar: Hot Wheels Unlimited) | **Ours** (realism 5 vs 6, parts 8 vs 2, garage 9 vs 1, toddler 8 vs 3) | (said of ours) Cars still look like plastic toys: slab sides, big cartoon drivers |
| 5b (fresh judge, letters swapped) | **Ours** (realism 6 vs 7, parts 8 vs 2, garage 9 vs 1, toddler 9 vs 3) | (said of ours) Still toy-like next to die-cast detail: flat panels, cartoon drivers |

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

- **Round 4 build:**
  - Door seams with chrome handles on the truck, jeep, and pickup.
  - Hood and body racing stripes that flip to dark on light paints.
  - A new wire-spoke wheel.
- **Round 4 verdict: ours won blind again**, with a fresh judge and three Labo screenshots no judge had seen.

- **Hand test in the simulator (live taps):** body, wheel, and paint picks, tab switching, tray scrolling, GO, honk, drag-to-spin, and pinch-to-zoom all work.
  - Fixed: during GO, the car vanished behind the parts tray on the near half of the lap. The camera now rises to a bird's-eye view for the lap, then glides back.
  - Fixed: pinch is ignored while the car is driving.
  - Changed: a fresh start is now a blue racer (was red).

- **Round 5 build (Billy's ask: more realistic cars, more swappable parts, a garage):**
  - New bar: *Hot Wheels Unlimited* (App Store id 1523486249), screenshots in `gauntlet/bar_hw/`.
  - Bodies are now drawn side outlines with wheel wells, extruded with rounded edges, under a tinted glass cabin with a roof and window frames: muscle car, sports car, formula racer, pickup, off-roader, monster truck and school bus.
  - Real-looking wheels: treaded tyres with rounded sidewalls and 8 rims (alloy, chrome, mesh, gold racing, beadlock off-road, whitewall, wire, glow).
  - Eight picture-only tabs: body, wheels, paint, stickers, engine (blower, scoop, velocity stacks, vents), front (bull bar, splitter, fog lights, snow plough), roof (police lights, LED light bar, roof rack, beacon), back (ducktail, GT wing, rockets, exhaust stacks).
  - Stickers (flames, lightning, stripes, checker, race number) are drawn to fit each body's side and dodge the wheel wells.
  - The outdoor park became a workshop: block walls, pegboard of tools, workbench, red tool chest, roll-up door, tyre stacks, oil drums, cones, a painted test track and a shiny concrete floor.
  - After the first verdict: dark wheel-well liners, side creases, smaller in-proportion driver heads, darker reflective glass.
  - Default car is now a blue muscle car with white racing stripes. Cartoon parts (donut wheels, crown, googly eyes) were dropped for realism.

## Known gaps worth another loop
- Realism is still our weakest score (6 vs 7): flat panels and cartoon drivers next to die-cast detail. Next step would be curved body sides, recessed headlights with lenses, and a less cartoony driver.
- Not yet judged: sound. Audio can't be heard from the simulator here; it needs a listen on a real iPad.
- No app icon yet (blank placeholder on the home screen).

## Round 6 — realism push (2026-11-12)
- New `Loft`: bodies skinned from the side outline with superellipse sections (crowned hoods, bowed sides, rolled plan corners, wheel-arch haunches). Muscle, sports, pickup, off-road, monster and bus use it; formula keeps extrusions.
- Stickers and door shut-lines wrap onto the curved skin (decal shells with side-projected UVs).
- Cabins lean inward toward the roof (`tumblehome`), slimmer pillars, flush rounded roof, darker glass.
- Headlamps: bucket, bright reflector, bulb, clear cover. Rect lamp clusters with twin projectors. Tail lamps: red lens over glowing core.
- Driver: full-face helmet in paint colour with tinted visor (no cartoon face).
- Soft contact shadow under every car. Front lip tucked under the nose.
- 6b: matte tyres, lower-profile alloys, brake discs, red calipers fixed to the hub.
- Tried SSAO: no visible effect without HDR, removed.

Blind verdicts vs Hot Wheels Unlimited (realism / parts / garage / toddler):
- 6 (ours = A): ours 5/8/9/8 vs bar 7/3/2/4. Winner: ours. Most fake: tyres (fixed in 6b).
- 6b (ours = B): ours 4/8/7/8 vs bar 7/3/2/4. Winner: ours. Most fake: uniform candy-gloss paint with no reflections of the garage; car looks like it floats.
- Realism score did not move (judges vary 4–6). Several judge suggestions were already present (shadow, lens/reflector, discs), so the details may not read at full-screen scale.

Next realism ideas: paint that reflects the actual garage (cube map of the workshop), a much stronger contact/occlusion shadow, sidewall lettering, smaller blower.

## Round 7: reflections and grounding (2026-11-12)
- At startup the app captures a cube map of the workshop from the car's position and uses it as the lighting environment, and for glass and lens reflections. Side faces get a shop-light band and a darker floor, so a horizon line shows on the flanks. The ceiling face is drawn with fluorescent panels. Paint is glossier (roughness 0.14).
- Gotcha: every cube face must be the same pixel size. UIGraphicsImageRenderer defaults to screen scale (2x), and mixing 256 px and 512 px faces made SceneKit silently drop the whole environment. Use a format with scale = 1.
- Darker, tighter contact shadow. Blower is 20% smaller (scaled through an inner node, so the pop-in animation doesn't reset it).
- Blind verdict, ours = A: realism 4, parts 8, garage 8, toddler 8, vs bar 7/4/2/4. Winner: ours.
- Over three judges realism stayed at 4–5 while parts, garage and toddler fit stayed far ahead. The judges keep asking for features we already have (reflections, discs, shadows, lenses). What remains is the art style: soft, rounded forms in saturated colours read as "toy", next to the bar's photographic die-cast renders. Closing that gap needs real modelled car assets (USDZ / glTF made in a 3D tool), not more procedural tweaks.
