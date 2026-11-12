import * as THREE from 'three';
import { canvas } from './geom';

// MARK: Tiny animation runner — the web stand-in for SceneKit actions.

interface Anim { t0: number; dur: number; step: (u: number) => void; done?: () => void }
const anims: Anim[] = [];
/** The frame loop's clock, so animations and frames share one timebase. */
let clock = performance.now();

/** Run `step(u)` with u going 0→1 over `dur` ms, after `delay` ms. */
export function animate(delay: number, dur: number, step: (u: number) => void, done?: () => void) {
  anims.push({ t0: clock + delay, dur, step, done });
}

export const easeOut = (u: number) => 1 - (1 - u) * (1 - u);
export const easeIn = (u: number) => u * u;
export const smooth = (u: number) => { const t = Math.min(1, Math.max(0, u)); return t * t * (3 - 2 * t); };

/** True while anything is animating (the frame loop runs at full speed then). */
export function tickAnims(now: number): boolean {
  clock = now;
  for (let i = anims.length - 1; i >= 0; i--) {
    const a = anims[i];
    if (now < a.t0) continue;
    const u = Math.min(1, (now - a.t0) / a.dur);
    a.step(u);
    if (u >= 1) { anims.splice(i, 1); a.done?.(); }
  }
  return anims.length > 0 || bursts.length > 0;
}

// MARK: Particles (sparkles, exhaust puffs) as one point cloud per burst.

const softDot = (() => {
  const t = new THREE.CanvasTexture(canvas(64, 64, (c) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  }));
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();

interface Burst { pts: THREE.Points; vel: Float32Array; t0: number; life: number; gravity: number; grow: number; size: number }
const bursts: Burst[] = [];

export function burst(parent: THREE.Object3D, opts: {
  at: THREE.Vector3; count: number; color: THREE.Color; speed: number; spread: number; dir?: THREE.Vector3;
  radius?: number; size: number; life: number; gravity: number; grow?: number; additive?: boolean; opacity?: number;
}) {
  const n = opts.count;
  const pos = new Float32Array(n * 3), vel = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const v = new THREE.Vector3(), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    v.randomDirection();
    const r = (opts.radius ?? 0) * Math.cbrt(Math.random());
    pos.set([opts.at.x + v.x * r, opts.at.y + v.y * r, opts.at.z + v.z * r], i * 3);
    if (opts.dir) v.lerp(opts.dir.clone().normalize(), 1 - opts.spread).normalize();
    const s = opts.speed * (0.5 + Math.random());
    vel.set([v.x * s, v.y * s, v.z * s], i * 3);
    c.copy(opts.color).offsetHSL((Math.random() - 0.5) * 0.08, 0, (Math.random() - 0.5) * 0.2);
    col.set([c.r, c.g, c.b], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.PointsMaterial({ map: softDot, size: opts.size, vertexColors: true, transparent: true, depthWrite: false,
    opacity: opts.opacity ?? 1, blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  parent.add(pts);
  bursts.push({ pts, vel, t0: clock, life: opts.life, gravity: opts.gravity, grow: opts.grow ?? 1, size: opts.size });
}

export function tickBursts(now: number, dt: number) {
  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i];
    const u = (now - b.t0) / b.life;
    const m = b.pts.material as THREE.PointsMaterial;
    if (u >= 1) { b.pts.removeFromParent(); b.pts.geometry.dispose(); m.dispose(); bursts.splice(i, 1); continue; }
    const pos = b.pts.geometry.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < pos.count; k++) {
      b.vel[k * 3 + 1] += b.gravity * dt;
      pos.setXYZ(k, pos.getX(k) + b.vel[k * 3] * dt, pos.getY(k) + b.vel[k * 3 + 1] * dt, pos.getZ(k) + b.vel[k * 3 + 2] * dt);
    }
    pos.needsUpdate = true;
    m.size = b.size * (1 + (b.grow - 1) * u);
    m.opacity = (1 - u) * (1 - u) * (m.userData.base ?? (m.userData.base = m.opacity));
  }
}
