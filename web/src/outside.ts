import * as THREE from 'three';
import { box, canvas, cone, cyl, mergeStatic, seeded, tex } from './geom';
import { DOOR_X, FLOOR_Y, WALL_Z } from './garage';
import { animate, easeIn, easeOut } from './fx';

// The great outdoors behind the garage: a road loop round a duck pond, over a hill, past little
// houses, trees and some sheep. Only shown while the car is out (or the door is open).

const G = FLOOR_Y;
const pbr = (color: THREE.ColorRepresentation, roughness = 0.7, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });

/** Ground height above the garage floor at (x, z): one hill the road goes over, big hills far off. */
export function groundHeight(x: number, z: number): number {
  if (z > WALL_Z - 2) return 0;
  const bump = (cx: number, cz: number, h: number, r: number) => h * Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (r * r));
  return bump(-11, -34, 1.7, 5.5) + bump(-30, -80, 14, 16) + bump(10, -95, 18, 20) + bump(42, -70, 11, 14) + bump(-48, -40, 9, 13);
}

// The road: out of the door, down a short lane, then a loop round the pond.
const LANE_END = -21;
const LOOP_C = new THREE.Vector2(DOOR_X, -33.5);
const loopPoint = (t: number) => {
  // t in 0..1 round the loop, starting at the lane end and going anticlockwise seen from above.
  const a = t * Math.PI * 2;
  const rx = 15 * (1 + 0.1 * Math.sin(3 * a)), rz = 12.5;
  return new THREE.Vector2(LOOP_C.x - rx * Math.sin(a), LOOP_C.y + rz * Math.cos(a));
};
/** A cheap round blob (a few hundred triangles instead of the usual sphere's ~700). */
const ico: Record<number, THREE.BufferGeometry> = { 1: new THREE.IcosahedronGeometry(1, 1), 2: new THREE.IcosahedronGeometry(1, 2) };
function sphere(m: THREE.Material, r: number, at: [number, number, number], scale: [number, number, number] = [1, 1, 1], detail = 2) {
  const n = new THREE.Mesh(ico[detail], m);
  n.position.set(...at);
  n.scale.set(scale[0] * r, scale[1] * r, scale[2] * r);
  return n;
}

/** The car's whole trip from the turntable and back, as a smooth curve in world space (ground level). */
export function tripCurve(): THREE.CatmullRomCurve3 {
  const pts: THREE.Vector3[] = [];
  const v = (x: number, z: number) => new THREE.Vector3(x, 0, z);
  pts.push(v(0, 0), v(DOOR_X * 0.5, WALL_Z * 0.5), v(DOOR_X, WALL_Z + 1.5), v(DOOR_X, WALL_Z - 3), v(DOOR_X, LANE_END + 1.5));
  for (let i = 1; i < 24; i++) { const p = loopPoint(i / 24); pts.push(v(p.x, p.y)); }
  pts.push(v(DOOR_X, LANE_END + 1.5), v(DOOR_X, WALL_Z - 3), v(DOOR_X, WALL_Z + 1.5), v(DOOR_X * 0.5, WALL_Z * 0.5), v(0, 0));
  return new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
}

/** A strip along `points`, `width` wide, laid on the ground (several vertices across so it hugs the hill). */
function ribbon(points: THREE.Vector3[], width: number, closed: boolean): THREE.BufferGeometry {
  const ACROSS = 5;
  const pts = closed ? [...points, points[0]] : points;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  let run = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const prev = i > 0 ? pts[i - 1] : closed ? points[points.length - 1] : pts[i];
    const next = i < n - 1 ? pts[i + 1] : closed ? points[1] : pts[i];
    const dir = new THREE.Vector3().subVectors(next, prev).setY(0).normalize();
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    if (i > 0) run += pts[i].distanceTo(pts[i - 1]);
    for (let k = 0; k < ACROSS; k++) {
      const f = k / (ACROSS - 1);
      const p = pts[i].clone().addScaledVector(side, (f - 0.5) * width);
      pos.push(p.x, G + groundHeight(p.x, p.z) + 0.03, p.z);
      uv.push(f, run / 4);
    }
    if (i < n - 1) {
      for (let k = 0; k < ACROSS - 1; k++) {
        const a = i * ACROSS + k, b = a + ACROSS;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const asphalt = canvas(64, 128, (c, w, h) => {
  c.fillStyle = '#3a3a3e'; c.fillRect(0, 0, w, h);
  const r = seeded(3);
  for (let i = 0; i < 500; i++) { const v = 40 + r() * 40; c.fillStyle = `rgb(${v},${v},${v + 4})`; c.fillRect(r() * w, r() * h, 1.5, 1.5); }
  c.fillStyle = '#ffd21a'; c.fillRect(w / 2 - 2.5, 20, 5, 64);
  c.fillStyle = '#e8e8e8'; c.fillRect(3, 0, 3, h); c.fillRect(w - 6, 0, 3, h);
});
const grassTex = canvas(128, 128, (c, w, h) => {
  c.fillStyle = '#7cc44f'; c.fillRect(0, 0, w, h);
  const r = seeded(11);
  for (let i = 0; i < 900; i++) {
    c.fillStyle = r() < 0.5 ? 'rgba(70,140,40,0.5)' : 'rgba(160,215,90,0.45)';
    c.fillRect(r() * w, r() * h, 2, 3 + r() * 3);
  }
});

function tree(m: { trunk: THREE.Material; leaf: THREE.Material; leaf2: THREE.Material }, x: number, z: number, s: number, round: boolean) {
  const g = new THREE.Group();
  g.position.set(x, G + groundHeight(x, z), z);
  g.scale.setScalar(s);
  g.add(cyl(m.trunk, 0.22, 1.6, 'y', [0, 0.8, 0], 6));
  if (round) {
    g.add(sphere(m.leaf, 1.3, [0, 2.4, 0], undefined, 1), sphere(m.leaf2, 0.9, [0.6, 2.9, 0.3], undefined, 1), sphere(m.leaf, 0.85, [-0.6, 2.1, -0.2], undefined, 1));
  } else {
    g.add(cone(m.leaf, 0, 1.5, 2.2, 'y', [0, 2.2, 0]), cone(m.leaf2, 0, 1.15, 1.8, 'y', [0, 3.3, 0]));
  }
  return g;
}

function house(x: number, z: number, wall: number, roof: number, turn: number) {
  const g = new THREE.Group();
  g.position.set(x, G + groundHeight(x, z), z);
  g.rotation.y = turn;
  const w = pbr(wall, 0.8), r = pbr(roof, 0.6), white = pbr(0xffffff, 0.5), glass = pbr(0x9fd4ff, 0.2, { emissive: 0x3f6a99, emissiveIntensity: 0.6 });
  g.add(box(w, 4, 2.8, 3.4, 0.05, [0, 1.4, 0]));
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0, 3.3, 1.9, 4), r);
  top.position.set(0, 3.75, 0);
  top.rotation.y = Math.PI / 4;
  top.scale.set(1.25, 1, 1.05);
  g.add(top);
  g.add(box(pbr(0x8a4a24, 0.7), 0.9, 1.6, 0.1, 0.03, [0, 0.8, 1.71]));
  for (const s of [-1, 1]) {
    g.add(box(white, 0.9, 0.9, 0.08, 0.02, [s * 1.25, 1.65, 1.71]), box(glass, 0.7, 0.7, 0.1, 0.02, [s * 1.25, 1.65, 1.72]));
  }
  g.add(box(pbr(0xb04a3a, 0.8), 0.5, 1.2, 0.5, 0.02, [1.1, 4.0, -0.4]));
  return g;
}

interface Hopper { node: THREE.Object3D; base: number; next: number }

function sheep(x: number, z: number, turn: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, G + groundHeight(x, z), z);
  g.rotation.y = turn;
  const wool = pbr(0xf7f5ee, 1), face = pbr(0x2a2522, 0.8);
  for (const [px, py, pz, r] of [[0, 0.75, 0, 0.5], [0.35, 0.8, 0.15, 0.36], [-0.35, 0.8, -0.12, 0.38], [0.1, 1.05, -0.1, 0.34], [-0.2, 1.0, 0.18, 0.32]]) {
    g.add(sphere(wool, r, [px, py, pz]));
  }
  g.add(sphere(face, 0.22, [0.62, 0.95, 0], [1.25, 1, 0.9]));
  for (const s of [-1, 1]) {
    g.add(sphere(face, 0.08, [0.6, 1.12, s * 0.2], [1, 0.6, 1.6]));
    g.add(sphere(pbr(0xffffff, 0.3), 0.05, [0.82, 1.02, s * 0.09]));
  }
  for (const [lx, lz] of [[0.28, 0.18], [0.28, -0.18], [-0.28, 0.18], [-0.28, -0.18]]) g.add(cyl(face, 0.06, 0.5, 'y', [lx, 0.25, lz], 8));
  mergeStatic(g);
  return g;
}

function duck(x: number, z: number, turn: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, G + 0.05, z);
  g.rotation.y = turn;
  const yellow = pbr(0xffd21a, 0.5), orange = pbr(0xff8a1a, 0.5), eye = pbr(0x111111, 0.3);
  g.add(sphere(yellow, 0.35, [0, 0.2, 0], [1.3, 0.8, 1]), sphere(yellow, 0.2, [0.3, 0.55, 0]));
  g.add(cone(orange, 0.02, 0.09, 0.2, 'x', [0.52, 0.53, 0]));
  for (const s of [-1, 1]) g.add(sphere(eye, 0.035, [0.42, 0.62, s * 0.1]));
  g.add(cone(yellow, 0.02, 0.14, 0.25, 'negX', [-0.48, 0.32, 0]));
  mergeStatic(g);
  return g;
}

export interface Outside {
  root: THREE.Group;
  /** Call every frame while shown: ducks bob, sheep hop as the car goes by. */
  tick(now: number, car: THREE.Vector3): void;
}

export function makeOutside(onBaa: () => void): Outside {
  const root = new THREE.Group();
  root.name = 'outside';

  // Sky: a big gradient dome, plus a sun and a few clouds. Not fogged.
  const skyGeo = new THREE.SphereGeometry(140, 32, 16);
  const col: number[] = [];
  const top = new THREE.Color(0x3d9df2), horizon = new THREE.Color(0xcfeaff), below = new THREE.Color(0x8fcf63);
  const sp = skyGeo.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    const h = sp.getY(i) / 140;
    const c = h > 0 ? horizon.clone().lerp(top, Math.pow(h, 0.6)) : horizon.clone().lerp(below, Math.min(1, -h * 8));
    col.push(c.r, c.g, c.b);
  }
  skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.position.set(DOOR_X, 0, -40);
  sky.renderOrder = -10;
  root.add(sky);
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff2a6, fog: false });
  const sun = new THREE.Mesh(new THREE.CircleGeometry(7, 32), sunMat);
  sun.position.set(-50, 70, -110);
  sun.lookAt(DOOR_X, 0, -30);
  root.add(sun);
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
  const r = seeded(21);
  for (const [cx, cy, cz] of [[-30, 34, -95], [25, 40, -110], [60, 30, -70], [-70, 36, -50], [0, 46, -120]]) {
    for (let i = 0; i < 5; i++) {
      root.add(sphere(cloudMat, 4 + r() * 3, [cx + (i - 2) * 5 + r() * 2, cy + r() * 2.5, cz + r() * 3], [1.3, 0.7, 1], 1));
    }
  }

  // Ground: grass that rolls into hills, from the back wall out to the horizon.
  const ground = new THREE.PlaneGeometry(220, 160, 110, 80);
  ground.rotateX(-Math.PI / 2);
  ground.translate(0, 0, WALL_Z - 80 + 0.05);
  const gp = ground.attributes.position;
  for (let i = 0; i < gp.count; i++) gp.setY(i, G + groundHeight(gp.getX(i), gp.getZ(i)));
  ground.computeVertexNormals();
  const grassMat = pbr(0xffffff, 0.95, { map: tex(grassTex, [70, 50]) });
  root.add(new THREE.Mesh(ground, grassMat));

  // Road.
  const road = pbr(0xffffff, 0.8, { map: tex(asphalt), side: THREE.DoubleSide });
  const lane: THREE.Vector3[] = [];
  for (let z = WALL_Z - 0.3; z >= LANE_END - 1; z -= 0.5) lane.push(new THREE.Vector3(DOOR_X, 0, z));
  root.add(new THREE.Mesh(ribbon(lane, 3.6, false), road));
  const loop: THREE.Vector3[] = [];
  for (let i = 0; i < 160; i++) { const p = loopPoint(i / 160); loop.push(new THREE.Vector3(p.x, 0, p.y)); }
  const loopMesh = new THREE.Mesh(ribbon(loop, 3.4, true), road);
  loopMesh.position.y = 0.006; // over the lane where they meet
  root.add(loopMesh);

  // Duck pond in the middle of the loop.
  const pond = new THREE.Mesh(new THREE.CircleGeometry(5, 40), pbr(0x3fa9e8, 0.15, { emissive: 0x0d3a66, emissiveIntensity: 0.4 }));
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(LOOP_C.x + 1, G + 0.03, LOOP_C.y);
  pond.scale.set(1.25, 0.9, 1);
  const rim = new THREE.Mesh(new THREE.RingGeometry(5, 5.5, 40), pbr(0xc9b48a, 0.9));
  rim.rotation.x = -Math.PI / 2;
  rim.position.copy(pond.position).setY(G + 0.025);
  rim.scale.copy(pond.scale);
  root.add(pond, rim);

  // Trees and houses, kept off the road and the pond.
  const clear = (x: number, z: number, gap: number) => {
    if (z > WALL_Z - 3 && Math.abs(x) < 22) return false;
    if (Math.abs(x - DOOR_X) < 2 + gap && z > LANE_END - 2) return false;
    if (Math.hypot((x - LOOP_C.x - 1) / 1.25, (z - LOOP_C.y) / 0.9) < 5.6 + gap) return false;
    for (const p of loop) if (Math.hypot(p.x - x, p.z - z) < 1.8 + gap) return false;
    return true;
  };
  const treeMats = { trunk: pbr(0x7a4a26, 0.9), leaf: pbr(0x3f9e3a, 0.85), leaf2: pbr(0x5cbf44, 0.85) };
  const houses: [number, number, number, number, number][] = [
    [26, -26, 0xffe1a8, 0xd9412b, -0.6], [-22, -15, 0xbfe3ff, 0x3a5fcc, 0.4], [30, -42, 0xffc2d6, 0x8a3fb3, -1.2], [-26, -46, 0xd8f5c4, 0xd9412b, 0.9],
  ];
  for (const [x, z, w, rf, t] of houses) root.add(house(x, z, w, rf, t));
  let placed = 0;
  for (let tries = 0; tries < 900 && placed < 70; tries++) {
    const x = -60 + r() * 120, z = WALL_Z - 3 - r() * 70;
    if (!clear(x, z, 4) || houses.some(([hx, hz]) => Math.hypot(hx - x, hz - z) < 5.5)) continue;
    root.add(tree(treeMats, x, z, 0.8 + r() * 0.7, r() < 0.5));
    placed++;
  }
  // A row of trees each side of the garage so it doesn't sit on its own.
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) root.add(tree(treeMats, s * (19.5 + (i % 2) * 2.5), WALL_Z - 1.5 + i * 5, 1.2, i % 2 === 0));

  // Picket fence along the lane.
  const fence = pbr(0xffffff, 0.6);
  for (const s of [-1, 1]) {
    const fx = DOOR_X + s * 2.6;
    for (let z = WALL_Z - 1.5; z > LANE_END + 3; z -= 0.55) root.add(box(fence, 0.08, 0.7, 0.14, 0.01, [fx, G + 0.35, z]));
    root.add(box(fence, 0.05, 0.1, Math.abs(LANE_END + 3 - (WALL_Z - 1.5)), 0, [fx, G + 0.5, (LANE_END + 3 + WALL_Z - 1.5) / 2]));
  }

  const hoppers: Hopper[] = [];
  const animals = new Set<THREE.Object3D>();
  for (const [x, z, t] of [[-4.5, -31, 0.6], [-3.5, -37.5, 2.4], [-5, -34, -0.3], [13.5, -30, 1.2], [13, -38, 3.0], [27, -52, 1.6]]) {
    const s = sheep(x, z, t);
    root.add(s); animals.add(s);
    hoppers.push({ node: s, base: s.position.y, next: 0 });
  }
  const ducks: THREE.Object3D[] = [];
  for (const [x, z, t] of [[2.5, -32.5, 0.3], [7.5, -35, 2.5], [5.6, -31, 4]]) {
    const d = duck(x, z, t);
    root.add(d); animals.add(d); ducks.push(d);
  }

  mergeStatic(root, (o) => animals.has(o) || o === sky);
  root.visible = false;

  return {
    root,
    tick(now, car) {
      ducks.forEach((d, i) => {
        d.position.y = G + 0.05 + 0.04 * Math.sin(now / 380 + i * 2);
        d.rotation.z = 0.06 * Math.sin(now / 500 + i);
        d.rotation.y += 0.002 * (i - 1);
      });
      for (const h of hoppers) {
        if (now < h.next || h.node.position.distanceTo(car) > 7) continue;
        h.next = now + 1800;
        onBaa();
        for (let k = 0; k < 2; k++) {
          animate(k * 340, 170, (u) => { h.node.position.y = h.base + 0.6 * easeOut(u); });
          animate(k * 340 + 170, 170, (u) => { h.node.position.y = h.base + 0.6 * (1 - easeIn(u)); });
        }
      }
    },
  };
}
