import * as THREE from 'three';
import { box, canvas, cone, cyl, mergeStatic, seeded, tex, torus } from './geom';

export const FLOOR_Y = -0.25;
export const ROAD_RADIUS = 5.8;
export const WALL_Z = -12;
export const DOOR_X = 4.6, DOOR_W = 4.8, DOOR_H = 4.6;

const pbr = (color: THREE.ColorRepresentation, roughness = 0.6, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });

const textured = (el: HTMLCanvasElement, repeat: [number, number], roughness: number) =>
  pbr(0xffffff, roughness, 0, { map: tex(el, repeat) });

// MARK: Generated textures (same drawings as the SceneKit version)

const concrete = canvas(256, 256, (c, w, h) => {
  c.fillStyle = '#808080'; c.fillRect(0, 0, w, h);
  const r = seeded(7);
  for (let i = 0; i < 2600; i++) {
    const v = Math.round((0.38 + r() * 0.25) * 255);
    c.fillStyle = `rgba(${v},${v},${v},0.5)`;
    const d = 1 + r() * 2.5;
    c.beginPath(); c.ellipse(r() * w, r() * h, d / 2, d / 2, 0, 0, Math.PI * 2); c.fill();
  }
});
const blockWall = canvas(128, 64, (c, w) => {
  c.fillStyle = '#cccccc'; c.fillRect(0, 0, w, 64);
  c.fillStyle = '#9e9e9e';
  c.fillRect(0, 0, w, 3); c.fillRect(0, 32, w, 3); c.fillRect(0, 0, 3, 32); c.fillRect(64, 32, 3, 32);
});
const pegboard = canvas(32, 32, (c) => {
  c.fillStyle = '#c7a375'; c.fillRect(0, 0, 32, 32);
  c.fillStyle = '#402e1a'; c.beginPath(); c.arc(16, 16, 4, 0, Math.PI * 2); c.fill();
});
const rollup = canvas(64, 64, (c) => {
  c.fillStyle = '#dbdbdb'; c.fillRect(0, 0, 64, 64);
  c.fillStyle = '#999999'; c.fillRect(0, 0, 64, 6);
  c.fillStyle = '#f7f7f7'; c.fillRect(0, 6, 64, 3);
});
const hazard = canvas(64, 32, (c) => {
  c.fillStyle = '#ffcc00'; c.fillRect(0, 0, 64, 32);
  c.fillStyle = '#0d0d0d';
  for (const x0 of [0, 32]) { c.beginPath(); c.moveTo(x0, 32); c.lineTo(x0 + 16, 0); c.lineTo(x0 + 32, 0); c.lineTo(x0 + 16, 32); c.fill(); }
});
const checker = canvas(32, 32, (c) => {
  c.fillStyle = '#fff'; c.fillRect(0, 0, 32, 32);
  c.fillStyle = '#0d0d0d'; c.fillRect(0, 0, 16, 16); c.fillRect(16, 16, 16, 16);
});
const diamondPlate = canvas(64, 64, (c) => {
  c.fillStyle = '#6b6b6b'; c.fillRect(0, 0, 64, 64);
  for (const [x, y, a] of [[16, 16, 0.6], [48, 48, 0.6], [48, 16, -0.6], [16, 48, -0.6]]) {
    c.save(); c.translate(x, y); c.rotate(a);
    c.fillStyle = '#bfbfbf'; c.beginPath(); c.ellipse(0, 0, 11, 3, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#404040'; c.beginPath(); c.ellipse(0, 1.5, 10, 1.5, 0, 0, Math.PI * 2); c.fill();
    c.restore();
  }
});

function plane(m: THREE.Material, w: number, h: number, at: [number, number, number], rotY = 0) {
  const n = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  n.position.set(...at);
  n.rotation.y = rotY;
  n.receiveShadow = true;
  return n;
}

// MARK: Workshop

export function makeWorkshop(): THREE.Group {
  const root = new THREE.Group();
  const G = FLOOR_Y;

  // The floor stops at the back wall so the grass outside can take over.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(34, 52),
    pbr(0xffffff, 0.55, 0, { map: tex(concrete, [34 / 8, 52 / 8]), color: 0xd9d9d9 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, G, 14);
  floor.receiveShadow = true;
  root.add(floor);

  // Back wall with a doorway cut out of it; an outside face too, for when the car is out there.
  const outline = new THREE.Shape();
  outline.moveTo(-17, 0); outline.lineTo(DOOR_X - DOOR_W / 2, 0); outline.lineTo(DOOR_X - DOOR_W / 2, DOOR_H);
  outline.lineTo(DOOR_X + DOOR_W / 2, DOOR_H); outline.lineTo(DOOR_X + DOOR_W / 2, 0);
  outline.lineTo(17, 0); outline.lineTo(17, 10); outline.lineTo(-17, 10); outline.closePath();
  const back = new THREE.Mesh(new THREE.ShapeGeometry(outline), textured(blockWall, [0.35, 0.5], 0.85));
  back.position.set(0, G, WALL_Z);
  const outside = new THREE.Mesh(new THREE.ShapeGeometry(outline), pbr(0xf2d2b0, 0.85, 0, { map: tex(blockWall, [0.35, 0.5]) }));
  outside.position.set(0, G, WALL_Z - 0.4);
  outside.scale.x = -1;
  outside.rotation.y = Math.PI;
  root.add(back, outside);
  const sideWall = textured(blockWall, [12.6, 5], 0.85);
  sideWall.side = THREE.DoubleSide;
  for (const s of [1, -1]) root.add(plane(sideWall, 36.4, 10, [s * 17, G + 5, 5.8], -s * Math.PI / 2));
  const ceiling = plane(pbr(0x3d3d3d, 0.9, 0, { side: THREE.DoubleSide }), 34, 36.4, [0, G + 10, 5.8]);
  ceiling.rotation.x = Math.PI / 2;
  root.add(ceiling);
  const skirt = pbr(0x474747, 0.7);
  for (const [x0, x1] of [[-17, DOOR_X - DOOR_W / 2], [DOOR_X + DOOR_W / 2, 17]]) {
    const w = x1 - x0, cx = (x0 + x1) / 2;
    root.add(plane(skirt, w, 1.2, [cx, G + 0.6, WALL_Z + 0.02]));
    root.add(plane(textured(hazard, [w * 1.5, 1], 0.5), w, 0.2, [cx, G + 1.3, WALL_Z + 0.03]));
  }
  // A sign over the door on the outside.
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.5), new THREE.MeshStandardMaterial({ map: tex(canvas(512, 110, (c, w, h) => {
    c.fillStyle = '#ffcc00'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#111'; c.fillRect(0, 0, w, 10); c.fillRect(0, h - 10, w, 10);
    c.font = '900 64px -apple-system, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText("BILLY'S GARAGE", w / 2, h / 2 + 3);
  })), roughness: 0.5 }));
  sign.position.set(DOOR_X, G + 6.3, WALL_Z - 0.43);
  sign.rotation.y = Math.PI;
  root.add(sign);

  // Pegboard with tools, workbench below.
  root.add(plane(textured(pegboard, [22, 10], 0.8), 5.6, 2.5, [-2.6, G + 2.75, -11.95]));
  root.add(tools(-2.6, G + 2.75, -11.9));
  root.add(workbench(-2.6, G, -11.35));

  // Door frame, poking through the wall so the opening has sides. The door itself is separate
  // (see makeDoor) because it rolls up.
  const frame = pbr(0x2e2e2e, 0.4, 0.6);
  root.add(box(frame, DOOR_W + 0.5, 0.25, 0.6, 0, [DOOR_X, G + DOOR_H + 0.12, WALL_Z - 0.2]));
  for (const s of [1, -1]) root.add(box(frame, 0.25, DOOR_H + 0.2, 0.6, 0, [DOOR_X + s * (DOOR_W / 2 + 0.12), G + DOOR_H / 2, WALL_Z - 0.2]));

  root.add(plane(textured(checker, [14, 2], 0.6), 6, 0.8, [-2.6, G + 4.6, -11.95]));
  root.add(toolChest(-8.2, G, -10.9));
  root.add(tyreStack(4, 8.6, G, -10.4), tyreStack(3, 9.9, G, -9.4));
  root.add(drum(0x1a4dcc, -10.9, G, -9.6), drum(0xcc1a14, -10.2, G, -10.9));
  for (const [x, z] of [[-7.6, -3.6], [7.8, -4.6], [-8.4, 2.2], [8.6, 1.4]]) root.add(trafficCone(x, G, z));
  root.add(track());
  mergeStatic(root);
  return root;
}

/**
 * The roll-up door: tap it to take the car out. `open(k)` rolls it up (k = 0 shut, 1 open) into
 * the gap between the wall's inside and outside faces. A green light over it blinks as a hint.
 */
export function makeDoor() {
  const G = FLOOR_Y;
  const root = new THREE.Group();
  const panel = new THREE.Group();
  panel.add(plane(textured(rollup, [1, 6], 0.5), DOOR_W, DOOR_H, [0, 0, 0]));
  const back = plane(textured(rollup, [1, 6], 0.5), DOOR_W, DOOR_H, [0, 0, -0.01], Math.PI);
  panel.add(back);
  const winGlass = pbr(0x8cbff2, 0.1, 0, { emissive: 0x5980b3, emissiveIntensity: 1 });
  for (let i = 0; i < 4; i++) panel.add(box(winGlass, 0.8, 0.35, 0.04, 0.05, [-1.5 + i, 1.0, 0]));
  panel.position.set(DOOR_X, G + DOOR_H / 2, WALL_Z - 0.2);
  const lamp = new THREE.MeshStandardMaterial({ color: 0x2bd94a, emissive: 0x2bd94a, emissiveIntensity: 1 });
  const light = box(lamp, 0.9, 0.35, 0.12, 0.08, [DOOR_X, G + DOOR_H + 0.55, WALL_Z + 0.06]);
  root.add(panel, light);
  return {
    root,
    panel,
    open(k: number) {
      panel.position.y = G + DOOR_H / 2 + DOOR_H * 0.97 * k;
      panel.visible = k < 0.99;
    },
    tick(now: number) { lamp.emissiveIntensity = 0.5 + 1.2 * Math.max(0, Math.sin(now / 300)); },
  };
}

/**
 * Bright shop lights that only exist while the reflections are captured: long ceiling panels
 * and a ring of soft boxes on the horizon, so the paint picks up crisp highlight streaks.
 */
export function makeReflectionRig(): THREE.Group {
  const root = new THREE.Group();
  const lamp = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  lamp.color.multiplyScalar(2.5);
  for (const x of [-3, 0, 3]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 14), lamp);
    p.rotation.x = Math.PI / 2;
    p.position.set(x, 8, 0);
    root.add(p);
  }
  // Horizon band: a bright ring at roughly the car's shoulder height seen from the middle.
  const band = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 0.9, 64, 1, true), lamp);
  band.position.y = 2.4;
  root.add(band);
  const dim = new THREE.MeshBasicMaterial({ color: 0x6b6b6b, side: THREE.DoubleSide });
  const faint = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 0.4, 64, 1, true), dim);
  faint.position.y = 4.4;
  root.add(faint);
  return root;
}

export function makeTurntable(): THREE.Group {
  const g = new THREE.Group();
  const deck = pbr(0xffffff, 0.35, 0.8, { map: tex(diamondPlate, [9, 9]) });
  const edge = pbr(0x333333, 0.3, 0.9);
  const led = pbr(0x99e6ff, 0.2, 0, { emissive: 0x59ccff, emissiveIntensity: 1.1 });
  const table = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 0.25, 96), [edge, deck, edge]);
  table.position.y = -0.125;
  table.receiveShadow = true;
  g.add(table, torus(led, 3.6, 0.04, 'y', [0, -0.02, 0]), torus(edge, 3.62, 0.06, 'y', [0, -0.15, 0]));
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    g.add(cyl(led, 0.05, 0.01, 'y', [Math.cos(a) * 3.3, 0.002, Math.sin(a) * 3.3], 16));
  }
  mergeStatic(g);
  return g;
}

function track(): THREE.Group {
  const root = new THREE.Group();
  const R = ROAD_RADIUS;
  const ring = new THREE.Mesh(new THREE.RingGeometry(R - 0.9, R + 0.9, 128), pbr(0x212121, 0.6));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = FLOOR_Y + 0.005;
  ring.receiveShadow = true;
  root.add(ring);
  const white = pbr(0xebebeb, 0.5), red = pbr(0xd91414, 0.5);
  for (let i = 0; i < 36; i += 2) {
    const a = (i / 36) * Math.PI * 2;
    const d = box(white, 0.06, 0.012, 0.5, 0, [Math.cos(a) * R, FLOOR_Y + 0.012, -Math.sin(a) * R]);
    d.rotation.y = a;
    root.add(d);
  }
  for (const r of [R - 0.95, R + 0.95]) {
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      const c = box(i % 2 ? white : red, 0.12, 0.03, (2 * Math.PI * r) / 64, 0, [Math.cos(a) * r, FLOOR_Y + 0.015, -Math.sin(a) * r]);
      c.rotation.y = a;
      root.add(c);
    }
  }
  return root;
}

function tools(x: number, y: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const steel = pbr(0xb3b3b3, 0.3, 1), red = pbr(0xcc1f14, 0.4), yellow = pbr(0xf2b80d, 0.4);
  for (let i = 0; i < 6; i++) g.add(box(steel, 0.06, 0.5 + i * 0.06, 0.03, 0.01, [-2.2 + i * 0.22, 0.4, 0]));
  for (let i = 0; i < 3; i++) {
    g.add(box(i === 1 ? yellow : red, 0.12, 0.35, 0.05, 0.03, [-0.6 + i * 0.4, 0.55, 0]));
    g.add(box(steel, 0.05, 0.45, 0.03, 0.01, [-0.6 + i * 0.4, 0.1, 0]));
  }
  g.add(torus(pbr(0x262626, 0.6), 0.32, 0.06, 'z', [1.2, 0.35, 0.05]));
  for (let i = 0; i < 5; i++) g.add(box(steel, 0.08, 0.3, 0.03, 0.01, [0.8 + i * 0.25, -0.6, 0]));
  return g;
}

function workbench(x: number, y: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const wood = pbr(0x8c6640, 0.7), steel = pbr(0x404040, 0.4, 0.8);
  g.add(box(wood, 5, 0.12, 1.1, 0.02, [0, 1.0, 0]), box(steel, 4.9, 0.08, 1.0, 0, [0, 0.35, 0]));
  for (const sx of [-2.35, 2.35]) for (const sz of [-0.45, 0.45]) g.add(box(steel, 0.08, 1.0, 0.08, 0, [sx, 0.5, sz]));
  g.add(box(pbr(0x1f5fcc, 0.4), 0.6, 0.3, 0.35, 0.04, [-1.6, 1.21, 0]), box(pbr(0xcc1f14, 0.4), 0.45, 0.25, 0.3, 0.04, [1.2, 1.18, 0.1]));
  return g;
}

function toolChest(x: number, y: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const red = pbr(0xc71a14, 0.3, 0.3), steel = pbr(0xbfbfbf, 0.25, 1);
  g.add(box(red, 1.8, 2.0, 0.9, 0.05, [0, 1.1, 0]));
  for (let i = 0; i < 6; i++) {
    g.add(box(red, 1.7, 0.26, 0.04, 0.02, [0, 0.35 + i * 0.3, 0.46]));
    g.add(box(steel, 1.2, 0.04, 0.04, 0.015, [0, 0.4 + i * 0.3, 0.5]));
  }
  for (const sx of [-0.75, 0.75]) g.add(cyl(pbr(0x1a1a1a, 0.8), 0.08, 0.06, 'z', [sx, 0.08, 0.3]));
  return g;
}

function tyreStack(count: number, x: number, y: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const rubber = pbr(0x1a1a1a, 0.9), hub = pbr(0x737373, 0.4, 0.8);
  for (let i = 0; i < count; i++) {
    const t = torus(rubber, 0.42, 0.2, 'y', [0, 0.2 + i * 0.4, 0]);
    t.scale.y = 1.0;
    t.rotation.y = i * 0.4;
    g.add(t, cyl(hub, 0.24, 0.3, 'y', [0, 0.2 + i * 0.4, 0], 24));
  }
  return g;
}

function drum(color: number, x: number, y: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const m = pbr(color, 0.4, 0.4);
  g.add(cyl(m, 0.45, 1.3, 'y', [0, 0.65, 0]));
  for (const h of [0.35, 0.95]) g.add(torus(m, 0.45, 0.025, 'y', [0, h, 0]));
  g.add(cyl(pbr(0x999999, 0.3, 0.9), 0.06, 0.04, 'y', [0.25, 1.31, 0], 16));
  return g;
}

function trafficCone(x: number, y: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const orange = pbr(0xff5a0d, 0.5), white = pbr(0xf2f2f2, 0.5);
  g.add(box(orange, 0.7, 0.06, 0.7, 0.02, [0, 0.03, 0]), cone(orange, 0.04, 0.28, 0.9, 'y', [0, 0.5, 0]));
  g.add(cone(white, 0.14, 0.18, 0.14, 'y', [0, 0.55, 0]));
  return g;
}
