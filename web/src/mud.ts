import * as THREE from 'three';
import { animate, burst, easeOut } from './fx';
import { CarMaterials } from './materials';
import { play } from './sound';
import { surfaceSpots, Spot } from './wash';

// Mud: each splat throws a handful of brown blobs that fly in and stick flat to the car, mostly
// low down and on the sides. Up to three splats pile up; the car wash scrubs and rinses it off.

const PER_SPLAT = 70, MAX_LEVEL = 3;
const browns = [0x4a2e16, 0x5c3a1c, 0x6e4724, 0x3d2612, 0x7a5532].map((c) => new THREE.Color(c));

interface Blob { spot: Spot; size: number; spin: number; k: number }

export class Mud {
  level = 0;
  private blobs: Blob[] = [];
  private mesh: THREE.InstancedMesh;
  private readonly roughness0: number;

  private body!: THREE.Object3D;

  constructor(private holder: THREE.Group, private m: CarMaterials) {
    const geo = new THREE.SphereGeometry(1, 12, 8);
    // Flatten into a splat-shaped lens with a lumpy edge.
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), a = Math.atan2(y, x);
      const lump = 1 + 0.22 * Math.sin(a * 5) + 0.1 * Math.sin(a * 9 + 1);
      pos.setXYZ(i, x * lump, y * lump, pos.getZ(i) * 0.22);
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
    this.mesh = new THREE.InstancedMesh(geo, mat, PER_SPLAT * MAX_LEVEL);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    holder.add(this.mesh);
    this.roughness0 = m.paint.roughness;
  }

  /** Throw another load of mud at the car. */
  splat(body: THREE.Object3D) {
    this.body = body;
    if (this.level >= MAX_LEVEL) { this.wobble(); play('splat'); return; }
    this.level++;
    // Favour the lower body and the sides; the roof gets the odd blob.
    const bb = new THREE.Box3().setFromObject(this.body);
    const yLo = bb.min.y, yHi = bb.max.y;
    const spots = surfaceSpots(this.body, this.holder, this.m, PER_SPLAT, (s) => {
      const h = (s.p.y - yLo) / Math.max(0.01, yHi - yLo);
      return Math.random() < 1.15 - h * 1.1;
    });
    const start = this.blobs.length;
    for (const spot of spots) this.blobs.push({ spot, size: 0.07 + Math.random() * 0.12, spin: Math.random() * Math.PI * 2, k: 0 });
    this.mesh.count = this.blobs.length;
    for (let i = start; i < this.blobs.length; i++) this.mesh.setColorAt(i, browns[i % browns.length]);
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;

    play('splat');
    // Each blob flies in from outside along its normal and lands with a little squash.
    for (let i = start; i < this.blobs.length; i++) {
      const b = this.blobs[i], delay = Math.random() * 450;
      animate(delay, 180, (u) => { b.k = -1 + easeOut(u); this.update(); }, () => {
        if (Math.random() < 0.25) {
          burst(this.holder, { at: b.spot.p.clone(), count: 4, color: browns[1], speed: 1.2, spread: 0.6, dir: b.spot.n,
            size: 0.08, life: 400, gravity: -8 });
        }
      });
      animate(delay + 180, 160, (u) => { b.k = 1 + 0.35 * Math.sin(u * Math.PI); this.update(); });
    }
    // Muddy paint loses its shine.
    this.m.paint.roughness = Math.min(0.9, this.roughness0 + 0.18 * this.level);
    this.wobble();
  }

  /** Brushes loosen the mud: blobs jiggle and shrink a little. */
  scrub(u: number) {
    this.shrink = 1 - 0.3 * u;
    this.jiggle = u;
    this.update();
  }
  private shrink = 1;
  private jiggle = 0;

  /** Rinse water passing over x = gx washes the mud in front of it away. */
  rinse(gx: number) {
    for (const b of this.blobs) if (b.spot.p.x > gx - 0.2) b.k = Math.max(0, b.k - 0.12);
    this.update();
    if (this.blobs.every((b) => b.k <= 0)) this.clear();
  }

  clear() {
    this.shrink = 1;
    this.jiggle = 0;
    this.blobs = [];
    this.mesh.count = 0;
    this.level = 0;
    this.m.paint.roughness = this.roughness0;
  }

  dispose() {
    this.clear();
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
  }

  private wobble() {
    animate(0, 300, (u) => { this.holder.rotation.z = 0.05 * Math.sin(u * Math.PI * 3) * (1 - u); });
  }

  private readonly tmp = { m: new THREE.Matrix4(), q: new THREE.Quaternion(), q2: new THREE.Quaternion(), s: new THREE.Vector3(), p: new THREE.Vector3() };
  private update() {
    const { m, q, q2, s, p } = this.tmp, z = new THREE.Vector3(0, 0, 1);
    this.blobs.forEach((b, i) => {
      // k < 0: still in flight (k = -1 far out, 0 touching); k > 0: stuck on, scaled by k.
      const out = b.k < 0 ? -b.k * 1.6 : 0;
      p.copy(b.spot.p).addScaledVector(b.spot.n, out + 0.01);
      q.setFromUnitVectors(z, b.spot.n).multiply(q2.setFromAxisAngle(z, b.spin));
      const k = b.k < 0 ? 0.6 : b.k * this.shrink * (1 + (this.jiggle ? 0.08 * Math.sin(this.jiggle * 40 + i) : 0));
      s.set(b.size * k, b.size * k * (b.k < 0 ? 0.7 : 1), b.size * (b.k < 0 ? 0.8 : Math.min(1, k)));
      m.compose(p, q, s.x > 0.0005 ? s : s.setScalar(0.0001));
      this.mesh.setMatrixAt(i, m);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
