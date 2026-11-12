import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Car space: +X is the front of the car, +Y is up, Z is the car's width. Ground is y = 0.
// Same as the SceneKit version, so the numbers port across unchanged.

export type Vec = [number, number, number];
export type Axis = 'x' | 'y' | 'z' | 'negX';
type Mat = THREE.Material;

/** Three's cylinders/cones point along +Y like SceneKit's. Rotate so +Y points along `axis`. */
export function orient(o: THREE.Object3D, axis: Axis) {
  if (axis === 'x') o.rotation.z = -Math.PI / 2;
  else if (axis === 'negX') o.rotation.z = Math.PI / 2;
  else if (axis === 'z') o.rotation.x = Math.PI / 2;
}

function mesh(g: THREE.BufferGeometry, m: Mat, at: Vec): THREE.Mesh {
  const n = new THREE.Mesh(g, m);
  n.position.set(...at);
  n.castShadow = true;
  n.receiveShadow = true;
  return n;
}

export function box(m: Mat, sx: number, sy: number, sz: number, r = 0, at: Vec = [0, 0, 0]): THREE.Mesh {
  const rr = Math.min(r, Math.min(sx, sy, sz) / 2 - 1e-4);
  const g = rr > 0.002 ? new RoundedBoxGeometry(sx, sy, sz, 3, rr) : new THREE.BoxGeometry(sx, sy, sz);
  return mesh(g, m, at);
}

export function sphere(m: Mat, r: number, at: Vec, scale: Vec = [1, 1, 1]): THREE.Mesh {
  const n = mesh(new THREE.SphereGeometry(r, 40, 24), m, at);
  n.scale.set(...scale);
  return n;
}

export function cyl(m: Mat, r: number, h: number, axis: Axis = 'y', at: Vec = [0, 0, 0], seg = 40): THREE.Mesh {
  const n = mesh(new THREE.CylinderGeometry(r, r, h, seg), m, at);
  orient(n, axis);
  return n;
}

export function cone(m: Mat, top: number, bottom: number, h: number, axis: Axis = 'y', at: Vec = [0, 0, 0]): THREE.Mesh {
  const n = mesh(new THREE.CylinderGeometry(top, bottom, h, 36), m, at);
  orient(n, axis);
  return n;
}

/** SceneKit tori lie flat in XZ (axis +Y); Three's stand in XY. Bake the difference into the geometry. */
export function torus(m: Mat, ring: number, pipe: number, axis: Axis = 'y', at: Vec = [0, 0, 0]): THREE.Mesh {
  const g = new THREE.TorusGeometry(ring, pipe, 20, 56);
  g.rotateX(Math.PI / 2);
  const n = mesh(g, m, at);
  orient(n, axis);
  return n;
}

/** SceneKit capsule height includes the caps; Three's length doesn't. */
export function capsule(m: Mat, r: number, h: number, axis: Axis = 'y', at: Vec = [0, 0, 0]): THREE.Mesh {
  const n = mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, h - 2 * r), 8, 24), m, at);
  orient(n, axis);
  return n;
}

/** Hollow cylinder along +Y (SCNTube). */
export function tube(m: Mat, inner: number, outer: number, h: number, at: Vec = [0, 0, 0]): THREE.Mesh {
  const pts = [
    new THREE.Vector2(inner, -h / 2), new THREE.Vector2(outer, -h / 2),
    new THREE.Vector2(outer, h / 2), new THREE.Vector2(inner, h / 2), new THREE.Vector2(inner, -h / 2),
  ];
  return mesh(new THREE.LatheGeometry(pts, 56), m, at);
}

export function group(children: THREE.Object3D[], name?: string): THREE.Group {
  const g = new THREE.Group();
  if (name) g.name = name;
  children.forEach((c) => g.add(c));
  return g;
}

/** A cylinder running from a to b. */
export function rod(m: Mat, a: Vec, b: Vec, r: number): THREE.Mesh {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const d = vb.clone().sub(va);
  const n = mesh(new THREE.CylinderGeometry(r, r, d.length(), 20), m, [0, 0, 0]);
  n.position.copy(va.add(vb).multiplyScalar(0.5));
  n.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return n;
}

// MARK: Side outlines

/** A 2D path in car XY that can both be extruded and sampled as a polygon. */
export class Outline {
  readonly shape = new THREE.Shape();
  private start = new THREE.Vector2();
  move(x: number, y: number) { this.shape.moveTo(x, y); this.start.set(x, y); return this; }
  l(x: number, y: number) { this.shape.lineTo(x, y); return this; }
  /** Quadratic curve to (x, y) with control point (cx, cy) — same argument order as the Swift helper. */
  q(x: number, y: number, cx: number, cy: number) { this.shape.quadraticCurveTo(cx, cy, x, y); return this; }
  arc(cx: number, cy: number, r: number, a0: number, a1: number) { this.shape.absarc(cx, cy, r, a0, a1, false); return this; }
  close() { this.shape.lineTo(this.start.x, this.start.y); return this; }

  points(div = 24): THREE.Vector2[] { return this.shape.getPoints(div); }

  bounds() {
    const p = this.points();
    const xs = p.map((v) => v.x), ys = p.map((v) => v.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
  }
}

/** Trace an outline onto a 2D canvas (already transformed to car XY). */
export function tracePath(c: CanvasRenderingContext2D, o: Outline) {
  const p = o.points(32);
  c.beginPath();
  c.moveTo(p[0].x, p[0].y);
  for (let i = 1; i < p.length; i++) c.lineTo(p[i].x, p[i].y);
  c.closePath();
}

/**
 * Extrude a side silhouette across the car's width (Z), centred on z = 0, with rounded edges
 * that stay inside the outline (like SceneKit's chamfer) rather than growing it.
 */
export function extrude(shape: THREE.Shape, depth: number, chamfer: number, m: Mat): THREE.Mesh {
  const c = Math.min(chamfer, depth / 2 - 1e-3);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(1e-3, depth - 2 * c),
    bevelEnabled: c > 0,
    bevelThickness: c,
    bevelSize: c,
    bevelOffset: -c,
    bevelSegments: c > 0 ? 5 : 0,
    curveSegments: 24,
  });
  g.translate(0, 0, -(depth - 2 * c) / 2);
  g.computeVertexNormals();
  return mesh(g, m, [0, 0, 0]);
}

/**
 * The car's side outline: bottom edge from front to rear with wheel wells cut out, then `top`
 * draws from the rear-bottom corner over the car and back to the front-bottom corner.
 */
export function sideOutline(front: number, rear: number, bottom: number, wells: number[], wellY: number, wellR: number,
  top: (p: Outline) => void): Outline {
  const p = new Outline();
  p.move(front - 0.05, bottom);
  for (const x of [...wells].sort((a, b) => b - a)) {
    const dy = bottom - wellY;
    if (Math.abs(dy) >= wellR) continue;
    const a0 = Math.asin(dy / wellR);
    p.l(x + wellR * Math.cos(a0), bottom);
    p.arc(x, wellY, wellR, a0, Math.PI - a0);
  }
  p.l(rear, bottom);
  top(p);
  p.close();
  return p;
}

/**
 * Lean a mesh's sides inward as it rises (a cabin narrowing toward the roof).
 * Works in the mesh's parent space using its position offset, like the Swift version.
 */
export function tumblehome(n: THREE.Mesh, y0: number, k: number) {
  const g = n.geometry;
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const nor = g.getAttribute('normal') as THREE.BufferAttribute | undefined;
  const py = n.position.y, pz = n.position.z;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) + py, z = pos.getZ(i) + pz;
    const s = Math.max(0.5, 1 - k * Math.max(0, y - y0));
    const ds = y > y0 ? -k : 0;
    pos.setZ(i, z * s - pz);
    if (nor) {
      const v = new THREE.Vector3(nor.getX(i), nor.getY(i) - (z * ds / s) * nor.getZ(i), nor.getZ(i) / s).normalize();
      nor.setXYZ(i, v.x, v.y, v.z);
    }
  }
  pos.needsUpdate = true;
  if (nor) nor.needsUpdate = true;
  g.computeBoundingBox();
  g.computeBoundingSphere();
}

// MARK: Canvas textures

export function canvas(w: number, h: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void): HTMLCanvasElement {
  const el = document.createElement('canvas');
  el.width = w; el.height = h;
  draw(el.getContext('2d')!, w, h);
  return el;
}

export function tex(el: HTMLCanvasElement, repeat: [number, number] = [1, 1], srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(el);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Tiny deterministic random numbers so the workshop looks the same every launch. */
export function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
