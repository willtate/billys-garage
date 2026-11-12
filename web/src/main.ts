import * as THREE from 'three';
import { muscle } from './bodies';
import { BuiltCar, buildCar, Design } from './car';
import { makeReflectionRig, makeTurntable, makeWorkshop } from './garage';
import { CarMaterials, paints } from './materials';
import { wheels } from './wheels';
import { autoUpdate } from './update';

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
let design: Design = { body: 'muscle', wheels: 'alloy', paint: 'blue', sticker: 'stripes', ...(saved ?? {}) };
for (const k of ['wheels', 'paint', 'sticker'] as const) { const v = q.get(k); if (v) design[k] = v; }
let car: BuiltCar | null = null;
let popT0 = 0, hopT0 = -1e9;

function rebuild(pop: boolean) {
  if (car) carHolder.remove(car.root);
  const wheel = wheels.find((w) => w.id === design.wheels) ?? wheels[0];
  car = buildCar(design, muscle, wheel, materials);
  carHolder.add(car.root);
  if (pop) popT0 = performance.now();
}

function apply(next: Design) {
  const prev = design;
  design = next;
  localStorage.setItem('vroom.design', JSON.stringify(design));
  if (prev.paint !== next.paint) {
    materials.setPaint(paints.find((p) => p.id === next.paint) ?? paints[7], true);
    hopT0 = performance.now();
  }
  if (prev.wheels !== next.wheels || prev.sticker !== next.sticker) rebuild(true);
}

materials.setPaint(paints.find((p) => p.id === design.paint) ?? paints[7], false);
rebuild(false);
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

view.addEventListener('pointerdown', (e) => {
  view.setPointerCapture(e.pointerId);
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
    if (Math.abs(vx) > 30 && e.timeStamp - lastT < 80) fling = { from: userSpin.rotation.y, by: vx * 0.011 * 0.3, t0: performance.now() };
    endTouch();
  } else if (pointers.size === 1) {
    const [p] = [...pointers.values()];
    lastX = p.x; lastT = e.timeStamp; vx = 0;
  }
};
view.addEventListener('pointerup', up);
view.addEventListener('pointercancel', up);
view.addEventListener('wheel', (e) => {
  e.preventDefault();
  cameraDistance = THREE.MathUtils.clamp(cameraDistance * Math.exp(e.deltaY * 0.001), MIN_D, MAX_D);
}, { passive: false });

// MARK: Parts tray

const tabs = document.getElementById('tabs')!;
const cards = document.getElementById('cards')!;
type Tab = 'paint' | 'wheels';
let tab: Tab = q.get('tab') === 'wheels' ? 'wheels' : 'paint';
const tabInfo: Record<Tab, { color: string; icon: string }> = {
  paint: { color: '#f2404d', icon: '🎨' },
  wheels: { color: '#298cff', icon: '🛞' },
};
const thumbs = new Map<string, string>();

function renderTabs() {
  tabs.innerHTML = '';
  for (const t of Object.keys(tabInfo) as Tab[]) {
    const b = document.createElement('div');
    b.className = 'tab' + (t === tab ? ' on' : '');
    b.style.background = tabInfo[t].color;
    b.textContent = tabInfo[t].icon;
    b.onpointerdown = () => { tab = t; renderTabs(); renderCards(); };
    tabs.append(b);
  }
}

function renderCards() {
  cards.innerHTML = '';
  if (tab === 'paint') {
    for (const p of paints) {
      const c = document.createElement('div');
      c.className = 'card' + (design.paint === p.id ? ' on' : '');
      const s = document.createElement('div');
      s.className = 'swatch';
      s.style.background = p.metallic ? `radial-gradient(circle at 35% 30%, #fff, ${p.color} 45%, #333)` : p.color;
      c.append(s);
      c.onclick = () => { apply({ ...design, paint: p.id }); renderCards(); };
      cards.append(c);
    }
  } else {
    for (const w of wheels) {
      const c = document.createElement('div');
      c.className = 'card' + (design.wheels === w.id ? ' on' : '');
      const img = document.createElement('img');
      img.src = thumbs.get(w.id) ?? '';
      img.alt = w.label;
      c.append(img);
      c.onclick = () => { apply({ ...design, wheels: w.id }); renderCards(); };
      cards.append(c);
    }
  }
}

/** Little 3D pictures of each wheel for the cards, rendered once with a throwaway renderer. */
function renderThumbs() {
  // Drawn with the main renderer (so they share the garage reflections), copied off the canvas
  // straight after each render while the drawing buffer is still valid.
  const size = 200;
  const s = new THREE.Scene();
  s.environment = scene.environment;
  s.environmentIntensity = 1.1;
  s.background = new THREE.Color(0xf2f2f2);
  const sun = new THREE.DirectionalLight(0xffffff, 2.5);
  sun.position.set(2, 3, 4);
  s.add(sun, new THREE.HemisphereLight(0xffffff, 0x888888, 0.8));
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  cam.position.set(0.7, 0.35, 1.9);
  cam.lookAt(0, 0, 0);
  const out = document.createElement('canvas');
  out.width = out.height = size;
  const ctx = out.getContext('2d')!;
  const ratio = renderer.getPixelRatio();
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);
  for (const w of wheels) {
    const g = w.build(materials, 0.38, 0.4 * w.widthScale / w.scale);
    g.rotation.x = Math.PI / 2;
    s.add(g);
    renderer.render(s, cam);
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(renderer.domElement, 0, 0, size, size);
    thumbs.set(w.id, out.toDataURL());
    s.remove(g);
  }
  renderer.setPixelRatio(ratio);
}

autoUpdate(() => (touching ? performance.now() : lastTouch));
renderThumbs();
renderTabs();
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
  const idle = !touching && !fling && now - popT0 > 400 && now - hopT0 > 600;
  if (now - lastDraw < (idle ? 31 : 15.5)) return;
  lastDraw = now;
  materials.tick(now);
  if (fpsEl && ++frames && now - fpsT > 1000) { fpsEl.textContent = `${Math.round((frames * 1000) / (now - fpsT))} fps · ${renderer.info.render.calls} calls · ${Math.round(renderer.info.render.triangles / 1000)}k tris`; frames = 0; fpsT = now; }
  camera.position.z += (cameraDistance - camera.position.z) * 0.25;

  if (fling) {
    const t = Math.min(1, (now - fling.t0) / 700);
    userSpin.rotation.y = fling.from + fling.by * (1 - (1 - t) * (1 - t));
    if (t >= 1) fling = null;
  }
  // Gently sway around a three-quarter front view so the driver and headlights face the kid.
  if (!touching && now > resumeAt) {
    if (!sway || now - sway.t0 > 4500) {
      const to = sway && sway.to > 0 ? -0.28 : 0.22;
      sway = { from: autoSpin.rotation.y, to, t0: now };
    }
    const t = (now - sway.t0) / 4500;
    autoSpin.rotation.y = sway.from + (sway.to - sway.from) * ease(Math.min(1, t));
  }

  if (car) {
    // Pop in when parts change, and a happy hop when the paint changes.
    const p = Math.min(1, (now - popT0) / 350);
    car.root.scale.setScalar(p < 1 ? 0.85 + 0.15 * Math.sin(p * Math.PI * 0.5) + 0.06 * Math.sin(p * Math.PI) : 1);
    const h = (now - hopT0) / 520;
    car.body.position.y = car.body.userData.baseY + (h < 1 ? Math.abs(Math.sin(h * Math.PI * 2)) * 0.12 : 0);
    const head = car.driver.getObjectByName('head');
    if (head) head.position.y = 0.66 + 0.01 * Math.max(0, Math.sin(now / 190));
  }
  renderer.render(scene, camera);
});

if (import.meta.env.DEV) Object.assign(window, { vg: { THREE, scene, camera, cameraRig, userSpin, autoSpin, materials, renderer, setDistance: (d: number) => { cameraDistance = d; } } });
