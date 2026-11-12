import * as THREE from 'three';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import { animate, burst, easeOut, smooth } from './fx';
import { box, canvas, cyl, group } from './geom';
import { CarMaterials } from './materials';
import { play } from './sound';

// The car wash: a gantry rolls over the car three times — foam, spinning brushes, rinse —
// then the car comes out sparkling. Everything is parented to the car holder so it follows
// the turntable, and is removed when the wash finishes.

const FOAM = 560;

/** Bounding box of `obj`'s meshes in `ref`'s space (tight, unlike a world-space box). */
function localBox(obj: THREE.Object3D, ref: THREE.Object3D): THREE.Box3 {
  ref.updateMatrixWorld(true);
  const inv = ref.matrixWorld.clone().invert();
  const out = new THREE.Box3(), b = new THREE.Box3(), m = new THREE.Matrix4();
  obj.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || !o.visible || o.material instanceof THREE.MeshBasicMaterial) return; // skip the floor shadow
    o.geometry.computeBoundingBox();
    b.copy(o.geometry.boundingBox!).applyMatrix4(m.multiplyMatrices(inv, o.matrixWorld));
    out.union(b);
  });
  return out;
}

/** Points scattered over the car's paint and glass, in holder space, ordered front to back. */
function foamSpots(body: THREE.Object3D, holder: THREE.Object3D, m: CarMaterials): { p: THREE.Vector3; n: THREE.Vector3 }[] {
  const inv = holder.matrixWorld.clone().invert();
  const meshes: { mesh: THREE.Mesh; area: number }[] = [];
  body.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (!mats.some((x) => x === m.paint || x === m.glass)) return;
    o.geometry.computeBoundingBox();
    const s = o.geometry.boundingBox!.getSize(new THREE.Vector3());
    meshes.push({ mesh: o, area: s.x * s.y + s.x * s.z + s.y * s.z });
  });
  const total = meshes.reduce((a, b) => a + b.area, 0);
  const out: { p: THREE.Vector3; n: THREE.Vector3 }[] = [];
  for (const { mesh, area } of meshes) {
    const sampler = new MeshSurfaceSampler(mesh).build();
    const count = Math.round((FOAM * area) / total);
    const mw = new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld);
    const nm = new THREE.Matrix3().getNormalMatrix(mw);
    for (let i = 0; i < count; i++) {
      const p = new THREE.Vector3(), n = new THREE.Vector3();
      sampler.sample(p, n);
      p.applyMatrix4(mw);
      n.applyMatrix3(nm).normalize();
      if (n.y < -0.4) { i--; continue; } // nobody sees foam on the underside
      out.push({ p, n });
    }
  }
  return out.sort((a, b) => b.p.x - a.p.x);
}

const bristles = (a: string, b: string) => {
  const t = new THREE.CanvasTexture(canvas(64, 64, (c) => {
    for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? a : b; c.fillRect(i * 8, 0, 8, 64); }
    c.fillStyle = 'rgba(255,255,255,0.25)';
    for (let i = 0; i < 40; i++) c.fillRect(Math.random() * 64, Math.random() * 64, 1, 6);
  }));
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 2);
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 });
};

export function carWash(holder: THREE.Group, root: THREE.Object3D, body: THREE.Object3D, driver: THREE.Object3D, m: CarMaterials, done: () => void) {
  const bb = localBox(root, holder);
  const front = bb.max.x + 0.9, rear = bb.min.x - 0.9;
  const halfZ = Math.max(Math.abs(bb.min.z), bb.max.z) + 0.35;
  const top = bb.max.y + 0.35;

  // The gantry: two posts and a beam, with spray nozzles along the beam.
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1f8fff, roughness: 0.35, metalness: 0.2 });
  const yellow = new THREE.MeshStandardMaterial({ color: 0xffcc1a, roughness: 0.4 });
  const gantry = group([
    box(frameMat, 0.22, top + 0.3, 0.22, 0.06, [0, (top + 0.3) / 2, halfZ + 0.35]),
    box(frameMat, 0.22, top + 0.3, 0.22, 0.06, [0, (top + 0.3) / 2, -halfZ - 0.35]),
    box(frameMat, 0.3, 0.26, halfZ * 2 + 0.92, 0.08, [0, top + 0.42, 0]),
    box(yellow, 0.32, 0.06, halfZ * 2 + 0.94, 0.02, [0, top + 0.27, 0]),
  ]);
  for (let i = -2; i <= 2; i++) gantry.add(cyl(yellow, 0.04, 0.12, 'y', [0, top + 0.22, (i / 2) * halfZ * 0.8], 10));

  // Spinning brushes: one each side and one across the top.
  const brushL = cyl(bristles('#2f7bff', '#7fb2ff'), 0.32, top, 'y', [0, top / 2, halfZ - 0.05], 20);
  const brushR = cyl(bristles('#ff3b45', '#ff8a8f'), 0.32, top, 'y', [0, top / 2, -halfZ + 0.05], 20);
  const brushTop = cyl(bristles('#ffcc1a', '#fff08a'), 0.3, halfZ * 2 - 0.2, 'z', [0, top - 0.05, 0], 20);
  const brushes = [brushL, brushR, brushTop];
  brushes.forEach((b) => { b.scale.setScalar(0.01); gantry.add(b); });
  gantry.position.x = front;
  gantry.scale.setScalar(0.01);
  holder.add(gantry);

  // Foam: one instanced mesh of little bubbles stuck to the car.
  const spots = foamSpots(body, holder, m);
  const foamMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, transparent: true, opacity: 0.95 });
  const foam = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), foamMat, spots.length);
  const sizes = spots.map(() => 0.06 + Math.random() * 0.08);
  const tint = new THREE.Color();
  spots.forEach((_, i) => foam.setColorAt(i, tint.setHSL(0.58 + Math.random() * 0.15, 0.6, 0.9 + Math.random() * 0.1)));
  const mat4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  const setFoam = (amount: (i: number) => number) => {
    spots.forEach(({ p, n }, i) => {
      const k = amount(i);
      sc.setScalar(Math.max(0.0001, sizes[i] * k));
      mat4.compose(p.clone().addScaledVector(n, sizes[i] * 0.4 * k), q, sc);
      foam.setMatrixAt(i, mat4);
    });
    foam.instanceMatrix.needsUpdate = true;
  };
  setFoam(() => 0);
  holder.add(foam);

  // How far along a pass (front→back) the gantry has got, as a car-space x.
  const at = (u: number, reverse = false) => (reverse ? rear + (front - rear) * u : front - (front - rear) * u);
  const reached = (x: number, gx: number, reverse = false) => smooth(((reverse ? gx - x : x - gx) + 0.3) / 0.6);

  // 1. Gantry rolls in.
  animate(0, 300, (u) => gantry.scale.setScalar(0.01 + 0.99 * easeOut(u)));

  // 2. Foam pass: bubbles grow as the nozzles pass over.
  const FOAM_T = 1800;
  animate(300, 1, () => play('bubbles'));
  let lastSquirt = 0;
  animate(300, FOAM_T, (u) => {
    const gx = at(u);
    gantry.position.x = gx;
    setFoam((i) => reached(spots[i].p.x, gx) * (1 + 0.15 * Math.sin(i)));
    if (u - lastSquirt > 0.05) {
      lastSquirt = u;
      burst(holder, { at: new THREE.Vector3(gx, top + 0.15, 0), count: 10, color: new THREE.Color(0xffffff), speed: 1.5,
        spread: 0.4, dir: new THREE.Vector3(0, -1, 0), radius: halfZ * 0.6, size: 0.22, life: 500, gravity: -6, opacity: 0.9 });
    }
  });

  // 3. Brushes pass back the other way, spinning, and give the car a little scrub-wobble.
  const BRUSH_T = 1800, b0 = 300 + FOAM_T;
  animate(b0, 250, (u) => brushes.forEach((b) => b.scale.setScalar(0.01 + 0.99 * easeOut(u))));
  animate(b0, 1, () => play('brush'));
  animate(b0, BRUSH_T, (u) => {
    const gx = at(u, true);
    gantry.position.x = gx;
    brushL.rotation.y = -u * 40; brushR.rotation.y = u * 40;
    brushTop.rotation.y = u * 40;
    // Squeeze the brushes in a touch where the car is.
    const inCar = gx > bb.min.x && gx < bb.max.x ? 1 : 0;
    brushL.position.z = halfZ - 0.05 - inCar * 0.1;
    brushR.position.z = -halfZ + 0.05 + inCar * 0.1;
    body.rotation.x = Math.sin(u * 60) * 0.015 * inCar;
    setFoam((i) => 1 + 0.25 * Math.sin(u * 30 + i));
  }, () => { body.rotation.x = 0; });
  animate(b0 + BRUSH_T - 250, 250, (u) => brushes.forEach((b) => b.scale.setScalar(1 - 0.99 * u)));

  // 4. Rinse: water rains down as the gantry passes, washing the foam away.
  const RINSE_T = 1600, r0 = b0 + BRUSH_T;
  animate(r0, 1, () => play('spray'));
  let lastDrop = 0;
  animate(r0, RINSE_T, (u) => {
    const gx = at(u);
    gantry.position.x = gx;
    setFoam((i) => 1 - reached(spots[i].p.x, gx));
    if (u - lastDrop > 0.02) {
      lastDrop = u;
      burst(holder, { at: new THREE.Vector3(gx, top + 0.15, 0), count: 22, color: new THREE.Color(0x4fb8ff), speed: 2.5,
        spread: 0.15, dir: new THREE.Vector3(0, -1, 0), radius: halfZ * 0.8, size: 0.16, life: 650, gravity: -12, opacity: 1 });
    }
  });

  // 5. Gantry rolls away; the car gleams.
  const s0 = r0 + RINSE_T;
  animate(s0, 300, (u) => gantry.scale.setScalar(1 - 0.99 * u), () => {
    holder.remove(gantry, foam);
    foam.geometry.dispose();
  });
  animate(s0, 1, () => {
    play('sparkle');
    burst(holder, { at: new THREE.Vector3((bb.min.x + bb.max.x) / 2, (bb.min.y + bb.max.y) / 2, 0), count: 60,
      color: new THREE.Color(0xffffff), speed: 3, spread: 1, radius: Math.max(bb.max.x - bb.min.x, 1) / 2,
      size: 0.22, life: 1200, gravity: -3, additive: true });
  });
  // A glint: the paint briefly reflects much more of the garage.
  const env0 = m.paint.envMapIntensity;
  animate(s0, 900, (u) => { m.paint.envMapIntensity = env0 * (1 + 1.6 * Math.sin(u * Math.PI)); }, () => {
    m.paint.envMapIntensity = env0;
    done();
  });
  // The driver cheers at the end.
  const y0 = driver.position.y;
  for (let i = 0; i < 2; i++) {
    animate(s0 + 100 + i * 260, 120, (u) => { driver.position.y = y0 + 0.18 * easeOut(u); });
    animate(s0 + 220 + i * 260, 140, (u) => { driver.position.y = y0 + 0.18 * (1 - u * u); });
  }
}
