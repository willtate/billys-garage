import * as THREE from 'three';
import { bodies } from './bodies';
import { BuiltCar, buildCar, Design, slots } from './car';
import { addons } from './addons';
import { stickers } from './stickers';
import { makeReflectionRig, makeTurntable, makeWorkshop } from './garage';
import { CarMaterials, paints } from './materials';
import { wheels } from './wheels';
import { autoUpdate } from './update';
import { animate, burst, easeIn, easeOut, smooth, tickAnims, tickBursts } from './fx';
import { play, unlock } from './sound';
import { ROAD_RADIUS } from './garage';

// MARK: Renderer and scene

const view = document.getElementById('view') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas: view, antialias: true, powerPreference: 'high-performance' });
// 1.5x is sharp enough on a Retina iPad and draws about half the pixels of 2x.
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1f1f1f);
const materials = new CarMaterials();

scene.add(makeWorkshop());
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
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 120);
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
let driving = false;

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
  const prev = design;
  design = next;
  localStorage.setItem('vroom.design', JSON.stringify(design));
  const slot = slots.find((k) => prev[k] !== next[k]);
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
  play('honk');
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

const LAP = 4200;
function vroom() {
  if (driving || !car) return;
  driving = true;
  play('vroom');
  const c = car;
  // Spin every wheel; right-side mounts are flipped, so they spin the other way.
  for (const s of c.spinners) animate(0, LAP + 300, (u) => { s.rotation.z = s.userData.dir * 90 * smooth(u); });
  // Rev, drive off the turntable onto the road, do a lap, come home and spin round.
  animate(0, 150, (u) => { carHolder.rotation.z = 0.06 * smooth(u); });
  animate(150, 150, (u) => { carHolder.rotation.z = 0.06 * (1 - smooth(u)); }, exhaust);
  const R = ROAD_RADIUS, total = R * 2 + 2 * Math.PI * R;
  animate(300, LAP, (u) => {
    const s = smooth(u) * total;
    let x: number, z: number, yaw: number;
    if (s < R) { x = s; z = 0; yaw = (Math.PI / 2) * smooth((s - 0.55 * R) / (0.45 * R)); }
    else if (s < R + 2 * Math.PI * R) { const th = (s - R) / R; x = R * Math.cos(th); z = -R * Math.sin(th); yaw = th + Math.PI / 2; }
    else { const d = s - R - 2 * Math.PI * R; x = R - d; z = 0; yaw = 2.5 * Math.PI + (Math.PI / 2) * smooth(d / (0.45 * R)); }
    const r = Math.hypot(x, z);
    carHolder.position.set(x, -0.25 * smooth((r - 3.4) / 0.5), z);
    carHolder.rotation.y = yaw;
  }, () => {
    const y0 = carHolder.rotation.y;
    animate(0, 450, (u) => { carHolder.rotation.y = y0 + Math.PI * easeOut(u); }, () => {
      carHolder.rotation.set(0, 0, 0);
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

materials.setPaint(paints.find((p) => p.id === design.paint) ?? paints[7], false);
swapCar();
camera.position.z = cameraDistance;
captureReflections();

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
  view.setPointerCapture(e.pointerId);
  downAt = { x: e.clientX, y: e.clientY, t: e.timeStamp };
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  beginTouch();
  if (pointers.size === 1) { lastX = e.clientX; lastT = e.timeStamp; vx = 0; }
  if (pointers.size === 2) { pinchStart = cameraDistance; pinchD = dist(); }
});
view.addEventListener('pointermove', (e) => {
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
}

document.getElementById('go')!.addEventListener('pointerdown', () => vroom());
document.getElementById('horn')!.addEventListener('pointerdown', () => honk());
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

function carThumb(d: Design, turn: number, spread = 1.75): string {
  const body = bodies.find((b) => b.id === d.body) ?? bodies[0];
  const wheel = wheels.find((w) => w.id === d.wheels) ?? wheels[0];
  const c = buildCar(d, body, wheel, materials);
  c.root.rotation.y = turn;
  return snapshot(c.root, frame(c.root, 1.4, 26, spread), 280, 200);
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
// `?go=<ms>` starts a lap automatically (for checking the drive without touching the screen).
if (q.has('go')) setTimeout(vroom, Number(q.get('go')) || 500);
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
renderer.setAnimationLoop((now) => {
  const busy = tickAnims(now) || driving || touching || !!fling;
  if (now - lastDraw < (busy ? 15.5 : 31)) return;
  tickBursts(now, Math.min(0.05, (now - lastDraw) / 1000));
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

  if (car) {
    for (const t of car.tickers) t(now);
    const head = car.driver.getObjectByName('head');
    if (head) head.position.y = 0.66 + 0.01 * Math.max(0, Math.sin(now / 190));
  }
  renderer.render(scene, camera);
});

if (import.meta.env.DEV) Object.assign(window, { vg: { THREE, scene, camera, cameraRig, userSpin, autoSpin, materials, renderer, setDistance: (d: number) => { cameraDistance = d; } } });
