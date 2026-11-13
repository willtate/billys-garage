import * as THREE from 'three';
import { bodies, emergency } from './bodies';
import { BuiltCar, buildCar, Design, slots } from './car';
import { addons } from './addons';
import { stickers } from './stickers';
import { DOOR_X, FLOOR_Y, makeDoor, makeReflectionRig, makeTurntable, makeWorkshop, WALL_Z } from './garage';
import { groundHeight, homeCurve, makeOutside, outCurve } from './outside';
import { CarMaterials, paints } from './materials';
import { wheels } from './wheels';
import { autoUpdate } from './update';
import { animate, burst, easeIn, easeOut, smooth, tickAnims, tickBursts } from './fx';
import { loop, play, unlock } from './sound';
import { carWash } from './wash';
import { Mud } from './mud';
import { makeRamp, RAMP_H, RAMP_LEN } from './ramp';
import { ROAD_RADIUS } from './garage';

// MARK: Renderer and scene

const view = document.getElementById('view') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas: view, antialias: true, powerPreference: 'high-performance',
  preserveDrawingBuffer: location.search.includes('at=') });
// 1.5x is sharp enough on a Retina iPad and draws about half the pixels of 2x.
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1f1f1f);
const materials = new CarMaterials();

scene.add(makeWorkshop());
const door = makeDoor();
scene.add(door.root);
const outside = makeOutside(() => play('baa'));
scene.add(outside.root);
// Fog only reaches the far hills outside; everything in the garage is nearer than it starts.
scene.fog = new THREE.Fog(0xcfeaff, 45, 130);
const autoSpin = new THREE.Group();
const userSpin = new THREE.Group();
const carHolder = new THREE.Group();
scene.add(autoSpin);
autoSpin.add(userSpin);
userSpin.add(makeTurntable(), carHolder);
userSpin.rotation.y = -0.7;

// Lights: a key light from the roof with soft shadows, two cool rim lights and a warm fill.
const key = new THREE.DirectionalLight(0xfff8eb, 2.4);
key.position.set(3.5, 10, 4);
scene.add(key);
scene.add(new THREE.HemisphereLight(0xfff2e0, 0x3a3530, 0.8));

// Camera on a rig aimed slightly below the car so the car sits above the parts tray.
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 300);
const cameraRig = new THREE.Group();
cameraRig.position.set(0, 0.55, 0);
cameraRig.rotation.x = -0.2;
cameraRig.add(camera);
scene.add(cameraRig);
let cameraDistance = 10;
const MIN_D = 8, MAX_D = 16;
camera.position.z = cameraDistance;

// MARK: Reflections — photograph the garage from where the car sits (car hidden) and use it
// as the environment, so paint, chrome and glass reflect the real workshop.

function captureReflections() {
  const rig = makeReflectionRig();
  scene.add(rig);
  carHolder.visible = false;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(scene, 0.01, 0.1, 100, { size: 256, position: new THREE.Vector3(0, 1, 0) }).texture;
  pmrem.dispose();
  carHolder.visible = true;
  scene.remove(rig);
  scene.environment = env;
  scene.environmentIntensity = 0.9;
}

// MARK: The car

const saved = (() => {
  try { return JSON.parse(localStorage.getItem('vroom.design') ?? 'null') as Design | null; } catch { return null; }
})();
const q = new URLSearchParams(location.search);
let design: Design = { body: 'muscle', wheels: 'alloy', paint: 'blue', sticker: 'stripes', engine: 'none', front: 'none', roof: 'none', back: 'none', ...(saved ?? {}) };
for (const k of ['body', 'wheels', 'paint', 'sticker', ...slots] as const) { const v = q.get(k); if (v) design[k] = v; }
let car: BuiltCar | null = null;
let driving = false, washing = false;
let mud: Mud | null = null; // made once the car exists

function swapCar(): BuiltCar {
  if (car) carHolder.remove(car.root);
  const wheel = wheels.find((w) => w.id === design.wheels) ?? wheels[0];
  const body = bodies.find((b) => b.id === design.body) ?? bodies[0];
  car = buildCar(design, body, wheel, materials);
  carHolder.add(car.root);
  frameCar(car);
  return car;
}

/** Pull the camera back for big cars, in for small ones. */
function frameCar(c: BuiltCar) {
  const box = new THREE.Box3().setFromObject(c.body);
  const size = box.getSize(new THREE.Vector3());
  cameraDistance = THREE.MathUtils.clamp(Math.max(size.x * 2.25, (box.max.y - 0) * 4.2), MIN_D, MAX_D);
}

function apply(next: Design) {
  if (washing) return; // parts stay put until the car is out of the wash
  const prev = design;
  design = next;
  localStorage.setItem('vroom.design', JSON.stringify(design));
  const slot = slots.find((k) => prev[k] !== next[k]);
  // A new body or wheels changes the car's shape, so the old mud would float in mid-air.
  if (prev.body !== next.body || prev.wheels !== next.wheels) mud?.clear();
  if (prev.body !== next.body) {
    const c = swapCar();
    dropIn(c.body, 2.6);
    c.wheelMounts.forEach((m, i) => popIn(m, 250 + i * 60));
    play('clunk');
  } else if (prev.wheels !== next.wheels) {
    const c = swapCar();
    c.wheelMounts.forEach((m, i) => popIn(m, i * 80));
    hop(300);
    play('boing');
  } else if (slot) {
    const c = swapCar();
    const n = c.addons[slot];
    if (n) popIn(n, 0);
    hop(150);
    cheer(c.driver);
    play(next[slot] === 'none' ? 'click' : 'clunk');
  } else if (prev.sticker !== next.sticker) {
    const c = swapCar();
    wiggle();
    cheer(c.driver);
    sparkles(new THREE.Color(0xffffff));
    play('sparkle');
  } else if (prev.paint !== next.paint) {
    const p = paints.find((x) => x.id === next.paint) ?? paints[7];
    materials.setPaint(p, true);
    wiggle();
    if (car) cheer(car.driver);
    sparkles(new THREE.Color(p.color));
    play('sparkle');
  }
}

// MARK: Little celebrations

function popIn(o: THREE.Object3D, delay: number) {
  o.scale.setScalar(0.01);
  animate(delay, 180, (u) => o.scale.setScalar(0.01 + 1.17 * easeOut(u)));
  animate(delay + 180, 140, (u) => o.scale.setScalar(1.18 - 0.18 * smooth(u)));
}

function popOut(o: THREE.Object3D) {
  animate(0, 250, (u) => o.scale.setScalar(Math.max(0.01, 1 - easeIn(u))), () => o.removeFromParent());
}

function dropIn(o: THREE.Object3D, height: number) {
  const base = o.position.y;
  o.position.y = base + height;
  animate(0, 320, (u) => { o.position.y = base + height * (1 - easeIn(u)); }, squash);
}

function hop(delay = 0) {
  animate(delay, 160, (u) => { carHolder.position.y = 0.45 * easeOut(u); });
  animate(delay + 160, 160, (u) => { carHolder.position.y = 0.45 * (1 - easeIn(u)); }, squash);
}

function squash() {
  animate(0, 100, (k) => carHolder.scale.set(1 + 0.08 * k, 1 - 0.12 * k, 1 + 0.08 * k));
  animate(100, 220, (k) => {
    const w = Math.cos(k * Math.PI * 2.5) * (1 - k);
    carHolder.scale.set(1 + 0.08 * w, 1 - 0.12 * w, 1 + 0.08 * w);
  }, () => carHolder.scale.setScalar(1));
}

function wiggle() {
  const a = 0.12, keys = [[0, a, 80], [a, -a, 120], [-a, a * 0.6, 100], [a * 0.6, 0, 100]];
  let t = 0;
  for (const [from, to, d] of keys) { animate(t, d, (u) => { carHolder.rotation.z = from + (to - from) * smooth(u); }); t += d; }
}

/** The driver's happy little jump. */
function cheer(driver: THREE.Object3D) {
  const y0 = driver.position.y;
  for (let i = 0; i < 2; i++) {
    animate(i * 260, 120, (u) => { driver.position.y = y0 + 0.18 * easeOut(u); });
    animate(i * 260 + 120, 140, (u) => { driver.position.y = y0 + 0.18 * (1 - easeIn(u)); });
  }
}

function sparkles(color: THREE.Color) {
  burst(carHolder, { at: new THREE.Vector3(0, 1.1, 0), count: 48, color, speed: 4, spread: 1, radius: 1.2,
    size: 0.2, life: 1100, gravity: -6, additive: true });
}

function honk() {
  play(emergency.has(design.body) ? 'siren' : 'honk');
  squash();
  const h = materials.headlight, base = h.emissiveIntensity;
  const flash = [[0, 150, base * 2.5], [150, 100, base], [250, 200, base * 2.5], [450, 1, base]];
  for (const [t, d, v] of flash) animate(t, d, () => { h.emissiveIntensity = v; });
}

function exhaust() {
  if (!car) return;
  const at = car.tailpipe.clone().applyMatrix4(carHolder.matrixWorld);
  const dir = new THREE.Vector3(-1, 0.3, 0).transformDirection(carHolder.matrixWorld);
  for (let i = 0; i < 4; i++) {
    animate(i * 100, 1, () => burst(scene, { at, count: 6, color: new THREE.Color(0xe6e6e6), speed: 1.5, spread: 0.25, dir,
      size: 0.35, life: 800, gravity: 0.8, grow: 4, opacity: 0.7 }));
  }
}

const LAP = 5200;
function wash() {
  if (driving || washing || !car) return;
  washing = true;
  document.body.classList.add('washing');
  carWash(carHolder, car.root, car.body, car.driver, materials, () => {
    mud?.clear();
    washing = false;
    document.body.classList.remove('washing');
    hop();
  }, mud && mud.level ? mud : undefined);
}

function muddy() {
  if (driving || washing || !car) return;
  mud ??= new Mud(carHolder, materials);
  mud.splat(car.body);
  if (car) cheer(car.driver);
}

function vroom() {
  if (driving || washing || !car) return;
  driving = true;
  play('vroom');
  if (emergency.has(design.body)) play('siren');
  const c = car;
  // Spin every wheel; right-side mounts are flipped, so they spin the other way.
  for (const s of c.spinners) animate(0, LAP + 300, (u) => { s.rotation.z = s.userData.dir * 90 * smooth(u); });
  // Rev, drive off the turntable onto the road, do a lap, come home and spin round.
  animate(0, 150, (u) => { carHolder.rotation.z = 0.06 * smooth(u); });
  animate(150, 150, (u) => { carHolder.rotation.z = 0.06 * (1 - smooth(u)); }, exhaust);
  const R = ROAD_RADIUS, total = R * 2 + 2 * Math.PI * R;

  // A jump ramp pops up on the far side of the track (the near side is behind the parts tray),
  // so the jump is seen side-on.
  const cam = camera.getWorldPosition(new THREE.Vector3());
  const toward = userSpin.worldToLocal(new THREE.Vector3(-cam.x, 0, -cam.z).setLength(R));
  let thR = Math.atan2(-toward.z, toward.x);
  if (thR < 0) thR += 2 * Math.PI;
  thR = THREE.MathUtils.clamp(thR, 0.9, 2 * Math.PI - 1.4);
  const ramp = makeRamp();
  ramp.position.set(R * Math.cos(thR), -0.25, -R * Math.sin(thR));
  ramp.rotation.y = thR + Math.PI / 2;
  userSpin.add(ramp);
  popIn(ramp, 0);

  // Rockets and big wheels make for bigger jumps.
  let jump = 1;
  if (design.back === 'rockets') jump *= 1.5;
  if (design.wheels === 'offroad' || design.body === 'monster') jump *= 1.2;
  jump = Math.min(jump, design.body === 'monster' ? 1.25 : 1.5); // keep tall trucks in the picture
  const sRamp = R + R * thR, sLip = sRamp + RAMP_LEN, flight = 3.8 * jump, sLand = sLip + flight, peak = 1.35 * jump;
  let phase = 0; // 0 before ramp, 1 in the air, 2 landed

  // Distance along the lap over time: pull away gently, cruise, go slow-motion over the jump so
  // it can be seen, and ease in at the end. Precomputed by stepping the speed along the route.
  const speed = (d: number) => (0.2 + 0.8 * smooth(d / 4) * smooth((total - d) / 4))
    * (1 - 0.68 * smooth((d - (sLip - 0.6)) / 0.6) * (1 - smooth((d - sLand + 0.2) / 0.5)));
  const route: number[] = [0];
  for (let d = 0; d < total; ) { d = Math.min(total, d + speed(d) * 0.01); route.push(d); }
  const along = (u: number) => {
    const f = u * (route.length - 1), i = Math.min(route.length - 2, Math.floor(f));
    return route[i] + (route[i + 1] - route[i]) * (f - i);
  };

  carHolder.rotation.order = 'YXZ'; // yaw first, so x/z rotations roll and pitch the car itself
  animate(300, LAP, (u) => {
    const s = along(u);
    let x: number, z: number, yaw: number;
    if (s < R) { x = s; z = 0; yaw = (Math.PI / 2) * smooth((s - 0.55 * R) / (0.45 * R)); }
    else if (s < R + 2 * Math.PI * R) { const th = (s - R) / R; x = R * Math.cos(th); z = -R * Math.sin(th); yaw = th + Math.PI / 2; }
    else { const d = s - R - 2 * Math.PI * R; x = R - d; z = 0; yaw = 2.5 * Math.PI + (Math.PI / 2) * smooth(d / (0.45 * R)); }
    const r = Math.hypot(x, z);
    let y = -0.25 * smooth((r - 3.4) / 0.5), pitch = 0, roll = 0;
    if (s >= sRamp && s < sLip) {
      // Up the ramp, nose raised.
      y += RAMP_H * ((s - sRamp) / RAMP_LEN);
      pitch = Math.atan(RAMP_H / RAMP_LEN);
    } else if (s >= sLip && s < sLand) {
      // In the air: an arc from the lip down to the road, with a barrel roll.
      const t = (s - sLip) / flight;
      y += RAMP_H * (1 - t) + 4 * peak * t * (1 - t);
      pitch = Math.atan(RAMP_H / RAMP_LEN) * (1 - 2 * t) * 0.8;
      roll = 2 * Math.PI * smooth((t - 0.1) / 0.75);
      if (phase === 0) { phase = 1; play('whee'); }
    } else if (s >= sLand && phase === 1) {
      phase = 2;
      play('clunk');
      squash();
      burst(userSpin, { at: new THREE.Vector3(x, -0.15, z), count: 24, color: new THREE.Color(0xb3a596), speed: 2, spread: 0.6,
        dir: new THREE.Vector3(0, 1, 0), size: 0.3, life: 700, gravity: -4, grow: 2.5, opacity: 0.7 });
    }
    carHolder.position.set(x, y, z);
    carHolder.rotation.set(roll, yaw, pitch);
  }, () => {
    popOut(ramp);
    const y0 = carHolder.rotation.y;
    animate(0, 450, (u) => { carHolder.rotation.y = y0 + Math.PI * easeOut(u); }, () => {
      carHolder.rotation.set(0, 0, 0);
      carHolder.rotation.order = 'XYZ';
      carHolder.position.set(0, 0, 0);
      driving = false;
      hop();
    });
  });
  // Lift the camera so the whole lap stays above the parts tray, then glide back.
  const rest = cameraDistance;
  animate(300, LAP + 300, (u) => {
    const k = smooth(u / 0.15) * (1 - smooth((u - 0.85) / 0.15));
    cameraRig.rotation.x = -0.2 - 0.42 * k;
    cameraRig.position.set(0, 0.55, 3 * k);
    camera.position.z = rest + (19 - rest) * k;
  }, () => { cameraRig.rotation.x = -0.2; cameraRig.position.set(0, 0.55, 0); camera.position.z = rest; });
}

// MARK: Out for a drive — tap the garage door: it rolls up, the turntable turns the car to face
// it, and the car drives out down the lane. Then Billy drives: hold a finger down and the car
// heads for it. The 🏠 button (or driving back to the door) brings it home.

let outing = false;
/** Set while Billy is at the wheel. */
let free: { speed: number; yaw: number } | null = null;
let motor: ReturnType<typeof loop> | null = null;
let odo = 0, sirenAt = 0, bumpAt = 0, splashAt = 0;
/** The finger steering the car, in screen pixels. */
let steer: { id: number; x: number; y: number } | null = null;
// Chase camera: its heading lags the car's a little; camK blends from the garage view (0) to it (1).
let camYaw = 0, camK = 0, rest = 10;
const restPos = new THREE.Vector3(), restLook = new THREE.Vector3(0, 0.55, 0);
const TOP = 9;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Put the car at ground (x, z) facing `yaw`, tilted with the slope (and sunk a little in the pond). */
function placeCar(x: number, z: number, yaw: number) {
  const cx = Math.cos(yaw), cz = -Math.sin(yaw);
  const h = (d: number) => groundHeight(x + cx * d, z + cz * d);
  const off = -0.25 * smooth((Math.hypot(x, z) - 3.4) / 0.5); // off the raised turntable onto the floor
  const wet = outside.inPond(x, z) ? -0.28 : 0;
  carHolder.position.set(x, off + groundHeight(x, z) + wet, z);
  carHolder.rotation.set(0, yaw, Math.atan2(h(0.8) - h(-0.8), 1.6));
}

function rolled(by: number, speed: number) {
  odo += by;
  if (car) for (const sp of car.spinners) sp.rotation.z = sp.userData.dir * odo / 0.5;
  motor?.rate(0.55 + 0.6 * Math.min(1, Math.abs(speed) / TOP));
  if (emergency.has(design.body) && odo - sirenAt > 30) { sirenAt = odo; play('siren'); }
}

/** Drive along `curve`, from speed v0 to v1, calling `each(s, L)` every step. */
function ride(curve: THREE.Curve<THREE.Vector3>, v0: number, v1: number, each: (s: number, L: number) => void, done: () => void) {
  const L = curve.getLength();
  const speed = (d: number) => Math.min(v0 + (TOP - v0) * smooth(d / 7), v1 + (TOP - v1) * smooth((L - d) / 7));
  const route: number[] = [0];
  for (let d = 0; d < L; ) { d = Math.min(L, d + speed(d) * 0.01); route.push(d); }
  const along = (u: number) => {
    const f = u * (route.length - 1), i = Math.min(route.length - 2, Math.floor(f));
    return route[i] + (route[i + 1] - route[i]) * (f - i);
  };
  const p = new THREE.Vector3(), tan = new THREE.Vector3();
  let last = 0;
  animate(0, (route.length - 1) * 10, (u) => {
    const s = along(u);
    curve.getPointAt(s / L, p);
    curve.getTangentAt(s / L, tan);
    placeCar(p.x, p.z, Math.atan2(-tan.z, tan.x));
    rolled(s - last, speed(s));
    last = s;
    each(s, L);
  }, done);
}

function drive() {
  if (driving || washing || !car) return;
  driving = outing = true;
  document.body.classList.add('outing');
  document.body.classList.remove('steered');
  play('door');
  if (emergency.has(design.body)) play('siren');
  outside.root.visible = true;
  animate(0, 1000, (u) => door.open(smooth(u)));

  // Turn the turntable so the car faces the door.
  const want = Math.atan2(-WALL_Z, DOOR_X) - autoSpin.rotation.y; // car's +X towards the door
  const from = userSpin.rotation.y;
  const turn = wrap(want - from);
  animate(0, 800, (u) => { userSpin.rotation.y = from + turn * smooth(u); });

  motor = loop('motor');
  motor.rate(0.6);
  animate(700, 300, () => {}, exhaust);

  // Take the rig out of the way so the camera can be placed in world space.
  rest = cameraDistance;
  camera.getWorldPosition(restPos);
  cameraRig.position.set(0, 0, 0);
  cameraRig.rotation.set(0, 0, 0);
  camera.position.copy(restPos);
  camera.lookAt(restLook);
  camK = 0;
  odo = sirenAt = 0;

  animate(900, 1, () => {
    // Lift the car off the turntable into the world, keeping where it is.
    scene.attach(carHolder);
    carHolder.rotation.order = 'YXZ';
    camYaw = carHolder.rotation.y;
    ride(outCurve(), 1.1, 5, (s) => { camK = smooth((s - 2) / 9); }, () => {
      free = { speed: 5, yaw: carHolder.rotation.y };
      document.body.classList.add('free');
    });
  });
}

/** Billy's turn: each frame, head for the finger (if there is one), bumping off trees and fences. */
const aim = new THREE.Vector3(), nextPos = new THREE.Vector2();
function freeStep(dt: number, now: number) {
  const f = free!, P = carHolder.position;
  let want = 0, turn = 0;
  if (steer) {
    ray.setFromCamera(new THREE.Vector2((steer.x / innerWidth) * 2 - 1, -(steer.y / innerHeight) * 2 + 1), camera);
    const o = ray.ray.origin, d = ray.ray.direction;
    // Where the finger points on the ground; if it's up in the sky, far off that way.
    const k = d.y < -0.03 ? (o.y - P.y) / -d.y : 200;
    aim.copy(o).addScaledVector(d, k);
    const dx = aim.x - P.x, dz = aim.z - P.z, dist = Math.hypot(dx, dz);
    const diff = wrap(Math.atan2(-dz, dx) - f.yaw);
    turn = Math.max(-1, Math.min(1, diff * 2));
    // Slow for tight turns and when the finger is right by the car.
    want = TOP * Math.min(1, Math.max(0, (dist - 1.5) / 5)) * (Math.abs(diff) > 1.8 ? 0.55 : 1);
  }
  const wet = outside.inPond(P.x, P.z);
  if (wet) want = Math.min(want, 3.5);
  f.speed += Math.max(-7 * dt, Math.min(5 * dt, want - f.speed));
  f.yaw += turn * 2.3 * dt * Math.min(1, 0.35 + Math.abs(f.speed) / 4);

  const step = f.speed * dt;
  nextPos.set(P.x + Math.cos(f.yaw) * step, P.z - Math.sin(f.yaw) * step);
  if (outside.collide(nextPos, 1.1)) {
    if (Math.abs(f.speed) > 2.5 && now - bumpAt > 600) { bumpAt = now; play('boing'); f.speed = -0.3 * f.speed; squash(); }
    else f.speed *= 0.5;
  }
  const moved = Math.hypot(nextPos.x - P.x, nextPos.y - P.z) * Math.sign(f.speed);
  placeCar(nextPos.x, nextPos.y, f.yaw);
  rolled(moved, f.speed);

  if (wet && Math.abs(f.speed) > 1 && now - splashAt > 260) {
    splashAt = now;
    if (Math.random() < 0.5) play('splat');
    burst(scene, { at: carHolder.position.clone().setY(FLOOR_Y + 0.1), count: 16, color: new THREE.Color(0x8fd3ff), speed: 3, spread: 0.5,
      dir: new THREE.Vector3(0, 1, 0), radius: 1, size: 0.25, life: 700, gravity: 9 });
  }
  // Drove back to the garage door: home time.
  if (Math.abs(P.x - DOOR_X) < 2.4 && P.z > WALL_Z - 3) goHome();
}

function goHome() {
  if (!free) return;
  const f = free;
  free = null;
  steer = null;
  document.body.classList.remove('free');
  let doorShut = false;
  ride(homeCurve(carHolder.position.x, carHolder.position.z, f.yaw), Math.max(1.1, f.speed), 1.1, (s, L) => {
    camK = 1 - smooth((s - (L - 17)) / 10);
    if (!doorShut && s > L - 9) {
      doorShut = true;
      play('door');
      animate(0, 1000, (u2) => door.open(1 - smooth(u2)), () => { outside.root.visible = false; });
    }
  }, parkHome);
}

function parkHome() {
  motor?.stop();
  motor = null;
  // Back on the turntable: hand the car back to it, then spin round to the usual pose.
  const yaw = carHolder.rotation.y;
  carHolder.rotation.set(0, 0, 0);
  carHolder.rotation.order = 'XYZ';
  carHolder.position.set(0, 0, 0);
  userSpin.add(carHolder);
  userSpin.rotation.y = yaw - autoSpin.rotation.y;
  // Put the camera back in its rig.
  cameraRig.position.set(0, 0.55, 0);
  cameraRig.rotation.set(-0.2, 0, 0);
  camera.position.set(0, 0, rest);
  camera.quaternion.identity();
  const y0 = userSpin.rotation.y, to = -0.7 + Math.round((y0 + 0.7) / (2 * Math.PI)) * 2 * Math.PI;
  animate(0, 900, (u) => { userSpin.rotation.y = y0 + (to - y0) * smooth(u); }, () => {
    driving = outing = false;
    camK = 0;
    document.body.classList.remove('outing');
    hop();
    if (car) cheer(car.driver);
  });
}

/** Every frame while out: Billy's driving, then the chase camera. */
const chasePos = new THREE.Vector3(), chaseLook = new THREE.Vector3(), lookAt = new THREE.Vector3();
function outingFrame(dt: number, now: number) {
  if (free) freeStep(dt, now);
  if (camK <= 0) return;
  camYaw += wrap(carHolder.rotation.y - camYaw) * Math.min(1, dt * 2.5);
  const P = carHolder.position, fx = Math.cos(camYaw), fz = -Math.sin(camYaw);
  chasePos.set(P.x - fx * 9, P.y + 4.4, P.z - fz * 9);
  chaseLook.set(P.x + fx * 4, P.y + 0.3, P.z + fz * 4);
  camera.position.lerpVectors(restPos, chasePos, camK);
  lookAt.lerpVectors(restLook, chaseLook, camK);
  camera.lookAt(lookAt);
}

materials.setPaint(paints.find((p) => p.id === design.paint) ?? paints[7], false);
swapCar();
camera.position.z = cameraDistance;
captureReflections();
// Get the outdoor shaders ready now, so the door doesn't hitch the first time it opens.
outside.root.visible = true;
renderer.compile(scene, camera);
outside.root.visible = false;

// MARK: Touch: one finger spins the turntable, two fingers zoom.

const pointers = new Map<number, { x: number; y: number }>();
let lastX = 0, lastT = 0, vx = 0, pinchStart = 0, pinchD = 0;
let touching = false, resumeAt = 0;
let fling: { from: number; by: number; t0: number } | null = null;
let sway: { from: number; to: number; t0: number } | null = null;

let lastTouch = 0;
function beginTouch() { touching = true; fling = null; sway = null; lastTouch = performance.now(); }
function endTouch() { touching = false; lastTouch = performance.now(); resumeAt = performance.now() + 4000; }
const dist = () => { const [a, b] = [...pointers.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };

let downAt = { x: 0, y: 0, t: 0 };
window.addEventListener('pointerdown', unlock, { capture: true });
view.addEventListener('pointerdown', (e) => {
  try { view.setPointerCapture(e.pointerId); } catch { /* not a live pointer (a test) */ }
  if (outing) {
    // Out driving: the finger steers (once Billy has the wheel); a quick tap on the car still honks.
    downAt = { x: e.clientX, y: e.clientY, t: e.timeStamp };
    if (!steer) steer = { id: e.pointerId, x: e.clientX, y: e.clientY };
    document.body.classList.add('steered');
    return;
  }
  downAt = { x: e.clientX, y: e.clientY, t: e.timeStamp };
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  beginTouch();
  if (pointers.size === 1) { lastX = e.clientX; lastT = e.timeStamp; vx = 0; }
  if (pointers.size === 2) { pinchStart = cameraDistance; pinchD = dist(); }
});
view.addEventListener('pointermove', (e) => {
  if (steer && steer.id === e.pointerId) { steer.x = e.clientX; steer.y = e.clientY; }
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1) {
    const dx = e.clientX - lastX, dt = Math.max(1, e.timeStamp - lastT);
    userSpin.rotation.y += dx * 0.011;
    vx = 0.7 * vx + 0.3 * (dx / dt) * 1000;
    lastX = e.clientX; lastT = e.timeStamp;
  } else if (pointers.size === 2) {
    cameraDistance = THREE.MathUtils.clamp(pinchStart * (pinchD / Math.max(10, dist())), MIN_D, MAX_D);
  }
});
const up = (e: PointerEvent) => {
  if (steer && steer.id === e.pointerId) {
    steer = null;
    if (Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 12 && e.timeStamp - downAt.t < 350) tapped(e);
  }
  if (!pointers.delete(e.pointerId)) return;
  if (pointers.size === 0) {
    if (Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 12 && e.timeStamp - downAt.t < 350) tapped(e);
    if (Math.abs(vx) > 30 && e.timeStamp - lastT < 80) fling = { from: userSpin.rotation.y, by: vx * 0.011 * 0.3, t0: performance.now() };
    endTouch();
  } else if (pointers.size === 1) {
    const [p] = [...pointers.values()];
    lastX = p.x; lastT = e.timeStamp; vx = 0;
  }
};
view.addEventListener('pointerup', up);

/** Tapping the car honks the horn. */
const ray = new THREE.Raycaster();
function tapped(e: PointerEvent) {
  ray.setFromCamera(new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
  if (ray.intersectObject(carHolder, true).length) honk();
  else if (ray.intersectObject(door.root, true).length) drive();
}

document.getElementById('go')!.addEventListener('pointerdown', () => vroom());
document.getElementById('horn')!.addEventListener('pointerdown', () => honk());
document.getElementById('wash')!.addEventListener('pointerdown', () => wash());
document.getElementById('mud')!.addEventListener('pointerdown', () => muddy());
document.getElementById('home')!.addEventListener('pointerdown', () => { play('pop'); goHome(); });
view.addEventListener('pointercancel', up);
view.addEventListener('wheel', (e) => {
  e.preventDefault();
  cameraDistance = THREE.MathUtils.clamp(cameraDistance * Math.exp(e.deltaY * 0.001), MIN_D, MAX_D);
}, { passive: false });

// MARK: Parts tray

const tabs = document.getElementById('tabs')!;
const cards = document.getElementById('cards')!;
type Tab = 'body' | 'wheels' | 'paint' | 'sticker' | 'engine' | 'front' | 'roof' | 'back';
const tabInfo: Record<Tab, { color: string; icon: string }> = {
  body: { color: '#ff7a21', icon: '🚗' },
  wheels: { color: '#298cff', icon: '🛞' },
  paint: { color: '#f2404d', icon: '🎨' },
  sticker: { color: '#ffb80d', icon: '🔥' },
  engine: { color: '#8c94a3', icon: '⚙️' },
  front: { color: '#2eb866', icon: '🛡️' },
  roof: { color: '#945cff', icon: '🚨' },
  back: { color: '#0db3cc', icon: '🏁' },
};
let tab: Tab = (Object.keys(tabInfo) as Tab[]).find((t) => t === q.get('tab')) ?? 'body';
const thumbs = new Map<string, string>();

function renderTabs() {
  tabs.innerHTML = '';
  for (const t of Object.keys(tabInfo) as Tab[]) {
    const b = document.createElement('div');
    b.className = 'tab' + (t === tab ? ' on' : '');
    b.style.background = tabInfo[t].color;
    b.textContent = tabInfo[t].icon;
    b.onpointerdown = () => { tab = t; play('pop'); renderTabs(); renderCards(); cards.scrollLeft = 0; };
    tabs.append(b);
  }
}

interface Card { on: boolean; pick: () => void; img?: () => string; swatch?: string; label?: string; wide?: boolean }

function cardsFor(t: Tab): Card[] {
  const d = design;
  const pick = (patch: Partial<Design>) => () => apply({ ...d, ...patch });
  switch (t) {
    case 'body':
      return bodies.map((b) => ({ on: d.body === b.id, pick: pick({ body: b.id }), wide: true,
        img: () => thumb(`body:${b.id}:${d.paint}:${d.wheels}`, () => carThumb({ ...d, body: b.id }, -0.6)) }));
    case 'wheels':
      return wheels.map((w) => ({ on: d.wheels === w.id, pick: pick({ wheels: w.id }), img: () => thumbs.get(w.id) ?? '' }));
    case 'paint':
      return paints.map((p) => ({ on: d.paint === p.id, pick: pick({ paint: p.id }),
        swatch: p.metallic ? `radial-gradient(circle at 35% 30%, #fff, ${p.color} 45%, #333)` : p.color }));
    case 'sticker':
      return stickers.map((id) => ({ on: d.sticker === id, pick: pick({ sticker: id }), wide: true,
        img: id === 'none' ? undefined : () => thumb(`sticker:${id}:${d.body}:${d.paint}`, () => carThumb({ ...d, sticker: id }, -0.05, 1.05)),
        label: id === 'none' ? '✕' : undefined }));
    default:
      return addons[t].map((a) => ({ on: d[t] === a.id, pick: pick({ [t]: a.id }),
        img: a.build ? () => thumb(`${t}:${a.id}:${d.body}:${d.paint}`, () => addonThumb(t, a.id)) : undefined,
        label: a.build ? undefined : '✕' }));
  }
}

function renderCards() {
  cards.innerHTML = '';
  for (const card of cardsFor(tab)) {
    const c = document.createElement('div');
    c.className = 'card' + (card.wide ? ' wide' : '') + (card.on ? ' on' : '');
    if (card.swatch) {
      const s = document.createElement('div');
      s.className = 'swatch';
      s.style.background = card.swatch;
      c.append(s);
    } else if (card.img) {
      const img = document.createElement('img');
      img.src = card.img();
      c.append(img);
    } else {
      c.textContent = card.label ?? '';
      c.classList.add('none');
    }
    c.onclick = () => { card.pick(); renderCards(); };
    cards.append(c);
  }
}

// MARK: Card pictures — drawn with the main renderer (so they share the garage reflections)
// and copied off the canvas straight after each render while the drawing buffer is valid.

const thumbScene = (() => {
  const s = new THREE.Scene();
  s.environment = scene.environment;
  s.environmentIntensity = 1.1;
  s.background = new THREE.Color(0x5a4a3e);
  const sun = new THREE.DirectionalLight(0xffffff, 2.5);
  sun.position.set(2, 3, 4);
  s.add(sun, new THREE.HemisphereLight(0xffffff, 0x888888, 0.8));
  return s;
})();

function snapshot(obj: THREE.Object3D, cam: THREE.PerspectiveCamera, w: number, h: number): string {
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const ratio = renderer.getPixelRatio();
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);
  thumbScene.add(obj);
  renderer.render(thumbScene, cam);
  out.getContext('2d')!.drawImage(renderer.domElement, 0, 0, w, h);
  thumbScene.remove(obj);
  renderer.setPixelRatio(ratio);
  resize();
  return out.toDataURL();
}

function renderWheelThumbs() {
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  cam.position.set(0.7, 0.35, 1.9);
  cam.lookAt(0, 0, 0);
  for (const w of wheels) {
    const g = w.build(materials, 0.38, 0.4 * w.widthScale / w.scale);
    g.rotation.x = Math.PI / 2;
    thumbs.set(w.id, snapshot(g, cam, 200, 200));
  }
}

function thumb(key: string, make: () => string): string {
  let v = thumbs.get(key);
  if (!v) { v = make(); thumbs.set(key, v); }
  return v;
}

/** Point a camera at an object's bounding box from the front-left, a little above. */
function frame(obj: THREE.Object3D, aspect: number, fov = 26, spread = 1.75) {
  const cam = new THREE.PerspectiveCamera(fov, aspect, 0.05, 60);
  const box = new THREE.Box3().setFromObject(obj);
  const centre = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  const d = Math.max(size.x, size.z * 1.2, size.y * 1.6) * spread;
  cam.position.set(centre.x, centre.y + d * 0.35, centre.z + d);
  cam.lookAt(centre);
  return cam;
}

function carThumb(d: Design, turn: number, spread = 1.75, w = 280, h = 200): string {
  const body = bodies.find((b) => b.id === d.body) ?? bodies[0];
  const wheel = wheels.find((w) => w.id === d.wheels) ?? wheels[0];
  const c = buildCar(d, body, wheel, materials);
  c.root.rotation.y = turn;
  return snapshot(c.root, frame(c.root, w / h, 26, spread), w, h);
}

function addonThumb(slot: typeof slots[number], id: string): string {
  const body = bodies.find((b) => b.id === design.body) ?? bodies[0];
  const g = addons[slot].find((a) => a.id === id)!.build!(materials, body);
  g.rotation.y = -0.7;
  return snapshot(g, frame(g, 1, 30, 1.9), 200, 200);
}

autoUpdate(() => (touching ? performance.now() : lastTouch));
renderWheelThumbs();
renderTabs();
// `?icon` draws just the app icon (a red muscle car on yellow), for making the home-screen icon.
if (q.has('icon')) {
  thumbScene.background = new THREE.Color(0xffc21a);
  materials.setPaint(paints[0], false);
  const img = new Image();
  img.src = carThumb({ ...design, body: 'muscle', paint: 'red', wheels: 'alloy', sticker: 'stripes', engine: 'blower', front: 'none', roof: 'none', back: 'none' }, -0.55, 1.95, 1024, 1024);
  document.body.innerHTML = '';
  img.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh';
  document.body.append(img);
}
// `?go=<ms>` starts a lap automatically (for checking the drive without touching the screen).
if (q.has('go')) setTimeout(vroom, Number(q.get('go')) || 500);
if (q.has('wash')) setTimeout(wash, Number(q.get('wash')) || 500);
if (q.has('drive')) setTimeout(drive, Number(q.get('drive')) || 500);
// `?steer=x,y` holds a pretend finger at that spot (fractions of the screen) while out driving.
if (q.has('steer')) {
  const [fx, fy] = q.get('steer')!.split(',').map(Number);
  steer = { id: -1, x: fx * innerWidth, y: fy * innerHeight };
}
renderCards();

// MARK: Frame loop

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const ease = (t: number) => t * t * (3 - 2 * t);

// `?fps` shows a frame-rate readout, for checking how a device copes.
const fpsEl = q.has('fps') ? Object.assign(document.body.appendChild(document.createElement('div')), {
  style: 'position:fixed;top:12px;left:12px;color:#0f0;font:bold 20px monospace;background:#000a;padding:4px 8px;border-radius:6px',
}) : null;
let frames = 0, fpsT = 0;

// Draw at most 60 times a second (ProMotion screens would otherwise ask for 120), and
// only 30 while nothing is being touched and the car is just swaying.
let lastDraw = 0;
const carPos = new THREE.Vector3();
function drawFrame(now: number) {
  const busy = tickAnims(now) || driving || touching || !!fling;
  if (now - lastDraw < (busy ? 15.5 : 31)) return;
  const dt = Math.min(0.05, (now - lastDraw) / 1000);
  tickBursts(now, dt);
  lastDraw = now;
  materials.tick(now);
  if (fpsEl && ++frames && now - fpsT > 1000) { fpsEl.textContent = `${Math.round((frames * 1000) / (now - fpsT))} fps · ${renderer.info.render.calls} calls · ${Math.round(renderer.info.render.triangles / 1000)}k tris`; frames = 0; fpsT = now; }
  if (!driving) camera.position.z += (cameraDistance - camera.position.z) * 0.2;

  if (fling) {
    const t = Math.min(1, (now - fling.t0) / 700);
    userSpin.rotation.y = fling.from + fling.by * (1 - (1 - t) * (1 - t));
    if (t >= 1) fling = null;
  }
  // Gently sway around a three-quarter front view so the driver and headlights face the kid.
  if (!touching && !driving && now > resumeAt) {
    if (!sway || now - sway.t0 > 4500) {
      const to = sway && sway.to > 0 ? -0.28 : 0.22;
      sway = { from: autoSpin.rotation.y, to, t0: now };
    }
    const t = (now - sway.t0) / 4500;
    autoSpin.rotation.y = sway.from + (sway.to - sway.from) * ease(Math.min(1, t));
  }

  if (outing) outingFrame(Math.min(dt, 0.0334), now);
  door.tick(now);
  if (outside.root.visible) outside.tick(now, carHolder.getWorldPosition(carPos));
  if (car) {
    for (const t of car.tickers) t(now);
    const head = car.driver.getObjectByName('head');
    if (head) head.position.y = 0.66 + 0.01 * Math.max(0, Math.sin(now / 190));
  }
  renderer.render(scene, camera);
}

// Dev only: `?at=<ms>` fast-forwards the clock to that moment and freezes there, so screenshots
// can catch any point of an animation (headless browsers stop drawing frames on their own).
if (import.meta.env.DEV && q.has('at')) {
  const until = Number(q.get('at'));
  {
    const t0 = performance.now();
    drawFrame(t0);
    for (let i = 0; i < Number(q.get('mudnow') ?? 0); i++) muddy();
    if (q.has('washnow')) wash();
    if (q.has('gonow')) vroom();
    if (q.has('drivenow')) drive();
    if (q.has('homeat')) animate(Number(q.get('homeat')), 1, goHome);
    for (let t = t0; t <= t0 + until; t += 16.7) { lastDraw = t - 16.7; drawFrame(t); }
    renderer.setAnimationLoop(() => renderer.render(scene, camera)); // keep presenting the frozen frame
  }
} else {
  renderer.setAnimationLoop(drawFrame);
}

if (import.meta.env.DEV) Object.assign(window, { vg: { THREE, scene, camera, cameraRig, userSpin, autoSpin, materials, renderer, setDistance: (d: number) => { cameraDistance = d; } } });
