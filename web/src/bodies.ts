import * as THREE from 'three';
import { box, canvas, capsule, cyl, extrude, group, Outline, rod, sideOutline, sphere, torus, tracePath, tumblehome, Vec } from './geom';
import { Loft, LoftSpec } from './loft';
import { CarMaterials } from './materials';

type O = THREE.Object3D;

export interface BodyBuild {
  node: THREE.Group;
  /** Side outline of the panel stickers go on. */
  panel: Outline;
  /** Racing stripe runs along the top centre line. */
  stripes: [number, number][][];
  /** The rounded skin, when the body has one (side stickers wrap onto it). */
  loft?: Loft;
  /** Emergency vehicles: flashing lights, run every frame. */
  tick?: (now: number) => void;
}

/** A spot on the body where an add-on bolts on, and how much room there is across the car. */
export interface Anchor { x: number; y: number; w: number }
const A = (x: number, y: number, w: number): Anchor => ({ x, y, w });
export type Slot = 'engine' | 'front' | 'roof' | 'back';

export interface BodyStyle {
  id: string;
  /** Wheel radius the body was designed around (wells are centred at this height). */
  wheelRadius: number;
  wheelbase: number;
  /** Distance between the left and right wheel centres. */
  track: number;
  wheelWidth: number;
  seat: Vec;
  driverScale: number;
  hood: Anchor; nose: Anchor; roof: Anchor; deck: Anchor; tail: Anchor;
  build: (m: CarMaterials, wheelR: number) => BodyBuild;
}

export function anchor(b: BodyStyle, slot: Slot): Anchor {
  return slot === 'engine' ? b.hood : slot === 'front' ? b.nose : slot === 'roof' ? b.roof : b.deck;
}

// MARK: - Shared pieces

const P = {
  /** Glass cabin with a painted roof and window frames on both sides, so the driver shows through. */
  greenhouse(m: CarMaterials, rear0: [number, number], rear1: [number, number], front1: [number, number], front0: [number, number],
    width: number, pillars: number[] = [], post = 0.06, sink = 0.14, tumble = 0.3): O[] {
    const nodes: THREE.Mesh[] = [];
    const core = new Outline().move(rear0[0] + 0.03, rear0[1] - 0.08).l(...rear1).l(...front1).l(front0[0] - 0.03, front0[1] - 0.08).close();
    nodes.push(extrude(core.shape, width - 0.05, 0.05, m.glass));

    const roof = new Outline().move(rear1[0] - 0.03, rear1[1] - 0.045).l(rear1[0] + 0.01, rear1[1] + 0.035)
      .l(front1[0] - 0.01, front1[1] + 0.035).l(front1[0] + 0.04, front1[1] - 0.045).close();
    nodes.push(extrude(roof.shape, width + 0.01, 0.04, m.paint));

    // Side frames: the cabin outline with the window openings punched out.
    const frame = new Outline().move(rear0[0], rear0[1] - sink).l(...rear0).l(rear1[0], rear1[1] + 0.02)
      .l(front1[0], front1[1] + 0.02).l(...front0).l(front0[0], front0[1] - sink).close();
    const ylo = Math.max(rear0[1], front0[1]) + 0.035;
    const yhi = Math.min(rear1[1], front1[1]) - post;
    const edgeX = (a: [number, number], b: [number, number], y: number, inward: number) => {
      const dy = b[1] - a[1], dx = b[0] - a[0];
      const x = a[0] + (dx * (y - a[1])) / dy;
      return x + (inward * post * Math.hypot(dx, dy)) / Math.abs(dy);
    };
    const cuts = [-Infinity, ...[...pillars].sort((a, b) => a - b), Infinity];
    for (let i = 0; i < cuts.length - 1; i++) {
      const s = cuts[i] + (i === 0 ? 0 : post / 2);
      const e = cuts[i + 1] - (i === cuts.length - 2 ? 0 : post / 2);
      const a = [Math.max(edgeX(rear0, rear1, ylo, 1), s), ylo];
      const b = [Math.max(edgeX(rear0, rear1, yhi, 1), s), yhi];
      const c = [Math.min(edgeX(front0, front1, yhi, -1), e), yhi];
      const d = [Math.min(edgeX(front0, front1, ylo, -1), e), ylo];
      if (c[0] - b[0] <= 0.08 || d[0] - a[0] <= 0.08) continue;
      const hole = new THREE.Path();
      hole.moveTo(a[0], a[1]); hole.lineTo(d[0], d[1]); hole.lineTo(c[0], c[1]); hole.lineTo(b[0], b[1]); hole.lineTo(a[0], a[1]);
      frame.shape.holes.push(hole);
    }
    for (const s of [1, -1]) {
      const f = extrude(frame.shape, 0.04, 0.012, m.paint);
      f.position.z = (s * width) / 2;
      nodes.push(f);
    }
    // Lean the cabin sides in toward the roof.
    const base = Math.min(rear0[1], front0[1]);
    nodes.forEach((n) => tumblehome(n, base, tumble));
    return nodes;
  },

  mirrors(m: CarMaterials, x: number, y: number, z: number): O[] {
    return [1, -1].flatMap((s) => [
      box(m.trim, 0.08, 0.04, 0.14, 0.015, [x, y, s * (z - 0.05)]),
      box(m.paint, 0.1, 0.13, 0.17, 0.045, [x - 0.02, y + 0.03, s * (z + 0.06)]),
      box(m.chrome, 0.02, 0.1, 0.13, 0.009, [x - 0.075, y + 0.03, s * (z + 0.06)]),
    ]);
  },

  plate(m: CarMaterials, x: number, y: number, facing: number): O[] {
    return [box(m.white, 0.02, 0.15, 0.34, 0.009, [x, y, 0]), box(m.trim, 0.012, 0.17, 0.36, 0.005, [x - facing * 0.008, y, 0])];
  },

  exhaust(m: CarMaterials, x: number, y: number, zs: number[], r = 0.05): O[] {
    return zs.flatMap((z) => [cyl(m.chrome, r, 0.3, 'x', [x, y, z]), cyl(m.grille, r * 0.7, 0.31, 'x', [x, y, z])]);
  },

  /** Black grille panel with chrome slats. */
  grille(m: CarMaterials, x: number, y: number, h: number, w: number, slats: number): O[] {
    const out: O[] = [box(m.grille, 0.04, h, w, 0.02, [x, y, 0])];
    for (let i = 0; i < slats; i++) {
      const t = (i + 0.5) / slats - 0.5;
      out.push(box(m.chrome, 0.03, 0.022, w * 0.94, 0, [x + 0.012, y + t * h, 0]));
    }
    out.push(box(m.chrome, 0.035, 0.03, w + 0.04, 0.012, [x + 0.005, y + h / 2, 0]));
    out.push(box(m.chrome, 0.035, 0.03, w + 0.04, 0.012, [x + 0.005, y - h / 2, 0]));
    return out;
  },

  shell(m: CarMaterials, path: Outline, spec: LoftSpec): Loft {
    return new Loft(path, spec, m.paint, m.grille);
  },

  /** Door shut-lines and other panel gaps, painted onto the curved sides. */
  panelLines(loft: Loft, seams: number[], yLo: number, yHi: number, filler?: [number, number]): O {
    const b = loft.outline.bounds();
    const scale = 200;
    const draw = (mirror: boolean) => {
      const el = canvas(Math.round(b.width * scale), Math.round(b.height * scale), (c, W, H) => {
        if (mirror) { c.translate(W, 0); c.scale(-1, 1); }
        c.translate(0, H); c.scale(scale, -scale); c.translate(-b.minX, -b.minY);
        tracePath(c, loft.outline); c.clip();
        c.lineCap = 'round';
        for (const x of seams) {
          c.strokeStyle = 'rgba(0,0,0,0.75)'; c.lineWidth = 0.013;
          c.beginPath(); c.moveTo(x, yLo); c.lineTo(x, yHi); c.stroke();
          c.strokeStyle = 'rgba(255,255,255,0.22)'; c.lineWidth = 0.006;
          c.beginPath(); c.moveTo(x + 0.012, yLo); c.lineTo(x + 0.012, yHi); c.stroke();
        }
        if (filler) {
          c.strokeStyle = 'rgba(0,0,0,0.7)'; c.lineWidth = 0.012;
          c.beginPath(); c.arc(filler[0], filler[1], 0.065, 0, Math.PI * 2); c.stroke();
        }
      });
      const t = new THREE.CanvasTexture(el);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      return t;
    };
    const n = loft.decal(draw(false), draw(true), b, 0.003, 4, (map) =>
      new THREE.MeshStandardMaterial({ map, transparent: true, depthWrite: false, roughness: 0.3, polygonOffset: true, polygonOffsetFactor: -2 }));
    n.name = 'panelLines';
    return n;
  },

  /** Chrome pull handles sitting flush on the curved door skin. */
  handles(m: CarMaterials, loft: Loft, pts: [number, number][]): O[] {
    return pts.flatMap(([x, y]) => [1, -1].map((s) => capsule(m.chrome, 0.02, 0.16, 'x', [x, y, s * (loft.sideZ(x, y) + 0.006)])));
  },

  /** Small lamp lenses set flush into the curved flank. */
  flankMarkers(m: CarMaterials, loft: Loft, front: number, rear: number, y: number): O[] {
    return [1, -1].flatMap((s) => [
      box(m.amber, 0.12, 0.045, 0.02, 0.009, [front, y, s * loft.sideZ(front, y)]),
      box(m.taillight, 0.12, 0.045, 0.02, 0.009, [rear, y, s * loft.sideZ(rear, y)]),
    ]);
  },

  /** A round headlamp set back into the body: dark bucket, chrome bezel, reflector, bulb and clear cover. */
  headlamp(m: CarMaterials, x: number, y: number, z: number, r: number): O[] {
    return [
      cyl(m.grille, r * 1.08, 0.05, 'x', [x - 0.05, y, z]),
      torus(m.chrome, r * 1.04, r * 0.13, 'x', [x + 0.006, y, z]),
      sphere(m.reflector, r * 0.97, [x - r * 0.3, y, z], [0.3, 1, 1]),
      sphere(m.headlight, r * 0.34, [x - r * 0.05, y, z], [0.7, 1, 1]),
      sphere(m.lens, r * 0.98, [x - r * 0.12, y, z], [0.22, 1, 1]),
    ];
  },

  /** A modern lamp cluster: black housing, chrome reflector, twin projectors under a clear cover. Faces +X. */
  rectLamp(m: CarMaterials, x: number, y: number, z: number, h: number, w: number, tilt = 0, drl = true): O {
    const r = Math.min(h, w);
    const parts: O[] = [box(m.grille, 0.06, h + 0.02, w + 0.02, r * 0.3, [-0.04, 0, 0]),
      box(m.reflector, 0.02, h * 0.82, w * 0.92, r * 0.25, [0, 0, 0])];
    for (const t of [-0.24, 0.2]) {
      parts.push(torus(m.chrome, h * 0.3, h * 0.05, 'x', [0.015, 0, t * w]));
      parts.push(sphere(m.headlight, h * 0.26, [0.02, 0, t * w], [0.5, 1, 1]));
    }
    if (drl) parts.push(box(m.headlight, 0.012, 0.02, w * 0.8, 0.008, [0.02, -h * 0.36, 0]));
    parts.push(box(m.lens, 0.02, h + 0.01, w + 0.01, r * 0.3, [0.035, 0, 0]));
    const n = group(parts);
    n.position.set(x, y, z);
    n.rotation.z = tilt;
    return n;
  },

  /** A wing with a rounded, teardrop profile (front toward +X), spanning Z. */
  airfoil(mat: THREE.Material, chord: number, thickness: number, span: number, at: Vec): O {
    const p = new Outline().move(chord / 2, 0).q(-chord / 2, thickness * 0.15, chord * 0.2, thickness * 1.2).q(chord / 2, 0, 0, -thickness * 0.4).close();
    const n = extrude(p.shape, span, 0.015, mat);
    n.position.set(...at);
    return n;
  },

  /** A tail lamp: dark housing, glowing core and a deep red cover. Faces -X. */
  tailLamp(m: CarMaterials, x: number, y: number, z: number, h: number, w: number, rings = false): O[] {
    const r = Math.min(h, w);
    const ring = rings ? [torus(m.chrome, r * 0.38, 0.008, 'x', [x - 0.03, y, z])] : [];
    return [...ring,
      box(m.grille, 0.05, h + 0.02, w + 0.02, r * 0.25, [x + 0.02, y, z]),
      box(m.taillight, 0.02, h * 0.55, w * 0.85, r * 0.2, [x - 0.005, y, z]),
      box(m.tailLens, 0.03, h, w, r * 0.25, [x - 0.015, y, z]),
    ];
  },
};

// MARK: - Driver

const suit = new THREE.MeshStandardMaterial({ color: 0x1a2440, roughness: 0.7 });
const glove = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.55 });
const dark = new THREE.MeshStandardMaterial({ color: 0x0f0f0f, roughness: 0.35 });
const visor = new THREE.MeshStandardMaterial({ color: 0x141f33, metalness: 0.85, roughness: 0.06 });

export function makeDriver(m: CarMaterials): THREE.Group {
  const root = new THREE.Group();
  root.name = 'driver';
  const torso = capsule(suit, 0.17, 0.5, 'y', [0, 0.25, 0]);
  torso.scale.set(0.9, 1, 1.05);
  root.add(torso, box(m.white, 0.05, 0.3, 0.02, 0.01, [0.15, 0.27, 0.07]), torus(dark, 0.085, 0.035, 'y', [0, 0.5, 0]));

  const wheel = group([torus(dark, 0.13, 0.022), cyl(m.gunmetal, 0.04, 0.03), box(m.gunmetal, 0.22, 0.012, 0.03)]);
  wheel.position.set(0.32, 0.42, 0);
  wheel.rotation.z = -1.2;
  root.add(wheel);
  for (const s of [1, -1]) {
    const arm = capsule(suit, 0.05, 0.32, 'y', [0.16, 0.38, s * 0.12]);
    arm.rotation.z = -1.15;
    root.add(arm, sphere(glove, 0.048, [0.31, 0.47, s * 0.1], [1, 0.9, 1.1]));
  }
  const head = new THREE.Group();
  head.name = 'head';
  head.position.set(0, 0.66, 0);
  head.add(
    sphere(m.paint, 0.2, [0, 0, 0], [1.06, 1, 0.95]),
    sphere(visor, 0.185, [0.035, 0, 0], [1, 0.44, 0.92]),
    sphere(m.paint, 0.15, [0.06, -0.085, 0], [1, 0.7, 1.05]),
    torus(m.white, 0.198, 0.012, 'z'),
    box(dark, 0.05, 0.02, 0.06, 0.008, [0.2, -0.11, 0]),
  );
  root.add(head);
  return root;
}

// MARK: - Bodies

export const muscle: BodyStyle = {
  id: 'muscle', wheelRadius: 0.38, wheelbase: 2.7, track: 1.38, wheelWidth: 0.4,
  seat: [-0.3, 0.68, 0.3], driverScale: 0.82,
  hood: A(1.3, 0.96, 0.9), nose: A(2.2, 0.42, 1.6), roof: A(-0.25, 1.49, 1.3), deck: A(-1.95, 0.97, 1.5), tail: A(-2.2, 0.32, 1.4),
  build(m, R) {
    const halfW = 0.86;
    const wellR = Math.min(R + 0.07, 0.54);
    const path = sideOutline(2.12, -2.12, 0.34, [1.35, -1.35], 0.38, wellR, (p) => {
      p.l(-2.17, 0.4).l(-2.19, 0.78).q(-2.02, 0.97, -2.18, 0.95).l(0.62, 0.98)
        .q(2.0, 0.88, 1.45, 0.98).q(2.19, 0.66, 2.17, 0.84).l(2.19, 0.4).l(2.13, 0.34);
    });
    const loft = P.shell(m, path, { halfW, shoulder: 0.74, topExp: 3, lowExp: 4, cornerF: 0.14, cornerR: 0.2, flare: 0.035, wells: [1.35, -1.35], wellR });
    const parts: O[] = [loft.mesh, P.panelLines(loft, [0.62, -0.55], 0.3, 1.0, [-1.72, 0.8])];
    parts.push(...P.greenhouse(m, [-1.6, 0.97], [-0.55, 1.46], [0.05, 1.46], [0.68, 0.97], 1.42, [-0.2]));
    for (const z of [0.6, 0.41, -0.41, -0.6]) parts.push(...P.headlamp(m, 2.185, 0.6, z, 0.075));
    parts.push(...P.grille(m, 2.18, 0.6, 0.17, 0.6, 3));
    parts.push(capsule(m.chrome, 0.06, 1.78, 'z', [2.2, 0.4, 0]), capsule(m.chrome, 0.06, 1.78, 'z', [-2.2, 0.42, 0]));
    for (const s of [1, -1]) parts.push(...P.tailLamp(m, -2.19, 0.76, s * 0.48, 0.11, 0.5));
    parts.push(...P.plate(m, -2.2, 0.62, -1), ...P.plate(m, 2.225, 0.29, 1));
    parts.push(...P.exhaust(m, -2.2, 0.25, [0.5, -0.5]));
    parts.push(...P.handles(m, loft, [[-0.42, 0.86]]));
    parts.push(...P.mirrors(m, 0.6, 1.02, 0.78));
    parts.push(...P.flankMarkers(m, loft, 1.98, -1.98, 0.62));
    for (const s of [1, -1]) parts.push(box(m.chrome, 1.6, 0.025, 0.02, 0.009, [0, 0.46, s * (loft.sideZ(0, 0.46) + 0.004)]));
    return {
      node: group(parts, 'body'), panel: path, loft,
      stripes: [[[0.66, 0.98], [1.2, 0.975], [1.6, 0.955], [1.98, 0.885]], [[-0.55, 1.495], [0.05, 1.495]], [[-2.0, 0.968], [-1.62, 0.975]]],
    };
  },
};

/** Twin racing stripes running over the top centre line. */
export function stripes(b: BodyBuild, m: CarMaterials): O[] {
  const out: O[] = [];
  for (const run of b.stripes) {
    for (let i = 0; i < run.length - 1; i++) {
      const [ax, ay] = run[i], [bx, by] = run[i + 1];
      const len = Math.hypot(bx - ax, by - ay);
      const ang = Math.atan2(by - ay, bx - ax);
      for (const z of [0.13, -0.13]) {
        const s = box(m.stripe, len + 0.01, 0.01, 0.17, 0, [(ax + bx) / 2, (ay + by) / 2 + 0.004, z]);
        s.rotation.z = ang;
        out.push(s);
      }
    }
  }
  return out;
}

export const sports: BodyStyle = {
  id: 'sports', wheelRadius: 0.37, wheelbase: 2.65, track: 1.48, wheelWidth: 0.44,
  seat: [-0.3, 0.48, 0.28], driverScale: 0.78,
  hood: A(1.2, 0.9, 0.8), nose: A(2.25, 0.32, 1.6), roof: A(-0.3, 1.3, 1.2), deck: A(-1.85, 0.91, 1.6), tail: A(-2.22, 0.3, 1.4),
  build(m, R) {
    const halfW = 0.92;
    const wellR = Math.min(R + 0.07, 0.48);
    const path = sideOutline(2.18, -2.15, 0.3, [1.325, -1.325], 0.37, wellR, (p) => {
      p.l(-2.2, 0.36).l(-2.22, 0.78).q(-2.05, 0.9, -2.21, 0.88).l(0.6, 0.92)
        .q(1.8, 0.86, 1.25, 0.94).q(2.25, 0.42, 2.15, 0.76).l(2.24, 0.36).l(2.19, 0.3);
    });
    const loft = P.shell(m, path, { halfW, shoulder: 0.6, topExp: 2.6, lowExp: 3.5, cornerF: 0.32, cornerR: 0.25, flare: 0.045, wells: [1.325, -1.325], wellR });
    const parts: O[] = [loft.mesh, P.panelLines(loft, [0.75, -0.62], 0.28, 0.95)];
    parts.push(...P.greenhouse(m, [-1.35, 0.91], [-0.55, 1.26], [-0.05, 1.27], [0.85, 0.9], 1.36, [], 0.06, 0.14, 0.45));
    for (const s of [1, -1]) {
      parts.push(P.rectLamp(m, 2.0, loft.topY(2.0, 0.52) - 0.005, s * 0.52, 0.14, 0.46, 0.95));
      parts.push(box(m.grille, 0.04, 0.13, 0.34, 0.04, [2.21, 0.4, s * 0.55]));
      parts.push(box(m.amber, 0.03, 0.04, 0.2, 0.014, [2.215, 0.5, s * 0.6]));
    }
    parts.push(box(m.grille, 0.05, 0.13, 0.74, 0.024, [2.22, 0.33, 0]), box(m.chrome, 0.06, 0.015, 0.7, 0, [2.235, 0.33, 0]));
    parts.push(...P.tailLamp(m, -2.215, 0.76, 0, 0.07, 1.36));
    parts.push(box(m.grille, 0.14, 0.12, 1.4, 0.03, [-2.17, 0.25, 0]));
    parts.push(...P.exhaust(m, -2.24, 0.34, [0.12, -0.12, 0.27, -0.27], 0.045));
    parts.push(...P.plate(m, -2.22, 0.52, -1), ...P.handles(m, loft, [[-0.45, 0.78]]), ...P.mirrors(m, 0.72, 0.97, 0.74));
    return {
      node: group(parts, 'body'), panel: path, loft,
      stripes: [[[0.9, 0.925], [1.4, 0.915], [1.8, 0.865], [2.09, 0.705]], [[-0.55, 1.3], [-0.05, 1.31]], [[-2.05, 0.905], [-1.38, 0.91]]],
    };
  },
};

export const formula: BodyStyle = {
  id: 'formula', wheelRadius: 0.4, wheelbase: 2.9, track: 1.72, wheelWidth: 0.46,
  seat: [0, 0.3, 0], driverScale: 0.85,
  hood: A(-1.25, 0.86, 0.5), nose: A(2.72, 0.22, 1.0), roof: A(-0.62, 1.1, 0.4), deck: A(-1.95, 1.12, 1.3), tail: A(-2.0, 0.32, 0.6),
  build(m) {
    const tub = sideOutline(2.6, -1.95, 0.12, [], 0, 0, (p) => {
      p.l(-2.0, 0.5).q(-1.65, 0.78, -1.98, 0.74).l(-0.75, 1.02).q(-0.5, 1.08, -0.65, 1.1)
        .l(-0.46, 0.74).l(0.5, 0.7).l(0.75, 0.72).q(2.55, 0.36, 1.6, 0.62).q(2.68, 0.2, 2.7, 0.3).l(2.6, 0.12);
    });
    const pod = new Outline().move(0.55, 0.18).l(0.55, 0.52).q(0.3, 0.62, 0.5, 0.62).l(-1.0, 0.62).q(-1.45, 0.4, -1.3, 0.6).l(-1.45, 0.18).close();
    const parts: O[] = [extrude(tub.shape, 0.66, 0.12, m.paint), extrude(pod.shape, 1.24, 0.1, m.paint)];
    for (const s of [1, -1]) {
      parts.push(box(m.grille, 0.03, 0.28, 0.2, 0.014, [0.565, 0.4, s * 0.45]));
      for (const x of [1.45, -1.45]) {
        parts.push(rod(m.trim, [x + 0.18, 0.32, s * 0.3], [x, 0.36, s * 0.7], 0.025));
        parts.push(rod(m.trim, [x - 0.18, 0.48, s * 0.3], [x, 0.46, s * 0.7], 0.025));
      }
    }
    parts.push(P.airfoil(m.paint, 0.5, 0.07, 2.0, [2.45, 0.16, 0]), P.airfoil(m.trim, 0.3, 0.05, 1.9, [2.25, 0.26, 0]));
    parts.push(P.airfoil(m.paint, 0.55, 0.1, 1.3, [-1.95, 1.05, 0]), P.airfoil(m.trim, 0.35, 0.06, 1.3, [-2.05, 0.9, 0]));
    for (const s of [1, -1]) {
      parts.push(box(m.trim, 0.55, 0.22, 0.03, 0.01, [2.45, 0.22, s * 1.0]), box(m.trim, 0.62, 0.42, 0.03, 0.01, [-1.98, 0.95, s * 0.66]));
    }
    parts.push(box(m.trim, 0.1, 0.42, 0.06, 0.02, [-1.9, 0.75, 0]), box(m.taillight, 0.03, 0.08, 0.12, 0.01, [-2.02, 0.42, 0]));
    const halo = torus(m.trim, 0.32, 0.03, 'y', [0.05, 0.98, 0]);
    halo.scale.set(1.2, 1, 0.9);
    parts.push(halo, rod(m.trim, [0.43, 0.98, 0], [0.62, 0.72, 0], 0.03));
    return { node: group(parts, 'body'), panel: pod, stripes: [] };
  },
};

export const pickup: BodyStyle = {
  id: 'pickup', wheelRadius: 0.44, wheelbase: 3.0, track: 1.46, wheelWidth: 0.44,
  seat: [-0.05, 0.98, 0.3], driverScale: 0.9,
  hood: A(1.55, 1.2, 1.0), nose: A(2.55, 0.62, 1.8), roof: A(-0.27, 1.9, 1.4), deck: A(-2.2, 1.24, 1.7), tail: A(-2.4, 0.45, 1.6),
  build(m, R) {
    const halfW = 0.93;
    const wellR = Math.min(R + 0.08, 0.7);
    const path = sideOutline(2.42, -2.35, 0.47, [1.5, -1.5], 0.44, wellR, (p) => {
      p.l(-2.38, 0.5).l(-2.38, 1.2).l(-2.33, 1.22).l(0.75, 1.22).q(2.35, 1.12, 1.7, 1.22).q(2.5, 0.92, 2.48, 1.08).l(2.5, 0.52).l(2.43, 0.47);
    });
    const loft = P.shell(m, path, { halfW, shoulder: 1.0, topExp: 5, lowExp: 6, cornerF: 0.15, cornerR: 0.08, flare: 0.02, wells: [1.5, -1.5], wellR });
    const parts: O[] = [loft.mesh, P.panelLines(loft, [0.8, -0.8, -0.84], 0.45, 1.3)];
    parts.push(...P.greenhouse(m, [-0.82, 1.21], [-0.76, 1.86], [0.22, 1.86], [0.82, 1.21], 1.62, [-0.28]));
    parts.push(box(m.plastic, 1.42, 0.02, 1.5, 0.009, [-1.58, loft.topY(-1.58, 0) - 0.004, 0]));
    for (const s of [1, -1]) parts.push(box(m.trim, 1.5, 0.035, 0.07, 0.015, [-1.58, loft.topY(-1.58, 0.8) + 0.012, s * 0.8]));
    parts.push(...P.grille(m, 2.49, 0.86, 0.38, 0.88, 4));
    for (const s of [1, -1]) {
      parts.push(P.rectLamp(m, 2.47, 0.92, s * 0.62, 0.18, 0.28));
      parts.push(...P.tailLamp(m, -2.385, 0.95, s * 0.76, 0.35, 0.14));
      parts.push(box(m.trim, 1.25, 0.05, 0.22, 0.02, [0, 0.42, s * 0.98]));
    }
    parts.push(box(m.chrome, 0.18, 0.2, 1.9, 0.08, [2.52, 0.5, 0]), box(m.chrome, 0.16, 0.18, 1.88, 0.07, [-2.4, 0.5, 0]));
    parts.push(capsule(m.chrome, 0.02, 0.2, 'z', [-2.39, 1.12, 0]));
    parts.push(...P.plate(m, -2.4, 0.72, -1), ...P.handles(m, loft, [[-0.62, 1.1]]), ...P.mirrors(m, 0.78, 1.3, 0.87));
    parts.push(...P.exhaust(m, -2.42, 0.4, [-0.6]), ...P.flankMarkers(m, loft, 2.25, -2.2, 0.95));
    return {
      node: group(parts, 'body'), panel: path, loft,
      stripes: [[[0.8, 1.225], [1.625, 1.2], [2.3, 1.13]], [[-0.76, 1.895], [0.22, 1.895]]],
    };
  },
};

export const offroad: BodyStyle = {
  id: 'offroad', wheelRadius: 0.46, wheelbase: 2.55, track: 1.42, wheelWidth: 0.46,
  seat: [0, 1.03, 0.32], driverScale: 0.92,
  hood: A(1.35, 1.28, 1.1), nose: A(2.15, 0.6, 1.9), roof: A(-0.77, 1.98, 1.45), deck: A(-1.85, 1.98, 1.5), tail: A(-2.12, 0.55, 1.6),
  build(m, R) {
    const halfW = 0.9;
    const wellR = Math.min(R + 0.08, 0.74);
    const path = sideOutline(2.05, -2.05, 0.5, [1.275, -1.275], 0.46, wellR, (p) => {
      p.l(-2.08, 1.26).l(-2.04, 1.29).l(0.7, 1.29).l(1.98, 1.25).q(2.08, 1.15, 2.07, 1.25).l(2.09, 0.55).l(2.05, 0.5);
    });
    const loft = P.shell(m, path, { halfW, shoulder: 1.0, topExp: 7, lowExp: 7, cornerF: 0.1, cornerR: 0.1, wells: [1.275, -1.275], wellR });
    const parts: O[] = [loft.mesh, P.panelLines(loft, [0.78, -0.35, -1.25], 0.55, 1.32)];
    parts.push(...P.greenhouse(m, [-2.0, 1.28], [-1.96, 1.94], [0.42, 1.94], [0.78, 1.28], 1.64, [-0.35, -1.25]));
    // Black fender flares round each wheel.
    for (const x of [1.275, -1.275]) {
      const a0 = Math.asin((0.5 - 0.46) / wellR);
      const arc = new THREE.Shape();
      arc.absarc(x, 0.46, wellR + 0.13, a0, Math.PI - a0, false);
      arc.absarc(x, 0.46, wellR, Math.PI - a0, a0, true);
      arc.closePath();
      for (const s of [1, -1]) {
        const f = extrude(arc, 0.14, 0.04, m.plastic);
        f.position.z = s * halfW;
        parts.push(f);
      }
    }
    for (const s of [1, -1]) {
      parts.push(...P.headlamp(m, 2.08, 1.0, s * 0.62, 0.13));
      parts.push(...P.tailLamp(m, -2.085, 1.05, s * 0.74, 0.16, 0.16, true));
      parts.push(rod(m.trim, [-0.8, 0.5, s * 1.0], [0.75, 0.5, s * 1.0], 0.045));
    }
    for (let i = 0; i < 7; i++) parts.push(box(m.grille, 0.03, 0.34, 0.07, 0.014, [2.09, 0.98, (i - 3) * 0.12]));
    parts.push(box(m.trim, 0.2, 0.18, 1.92, 0.03, [2.13, 0.56, 0]), box(m.trim, 0.18, 0.16, 1.85, 0.03, [-2.1, 0.56, 0]));
    for (const s of [1, -1]) parts.push(torus(m.taillight, 0.05, 0.018, 'z', [2.25, 0.56, s * 0.55]));
    // Spare wheel on the back door.
    parts.push(torus(m.rubber, 0.27, 0.13, 'x', [-2.2, 1.02, 0]), cyl(m.alloy, 0.2, 0.14, 'x', [-2.2, 1.02, 0]));
    // Snorkel up the right-hand pillar.
    parts.push(rod(m.trim, [1.3, 0.95, -0.94], [0.82, 1.3, -0.94], 0.05), rod(m.trim, [0.82, 1.3, -0.94], [0.5, 1.98, -0.87], 0.05));
    parts.push(...P.plate(m, -2.1, 0.72, -1), ...P.handles(m, loft, [[0.15, 1.16], [-0.95, 1.16]]), ...P.mirrors(m, 0.76, 1.36, 0.89));
    return {
      node: group(parts, 'body'), panel: path, loft,
      stripes: [[[0.8, 1.29], [1.98, 1.255]], [[-1.96, 1.975], [0.42, 1.975]]],
    };
  },
};

const shockMat = new THREE.MeshStandardMaterial({ color: 0xf29900, metalness: 0.6, roughness: 0.3 });

export const monster: BodyStyle = {
  id: 'monster', wheelRadius: 0.85, wheelbase: 2.4, track: 2.12, wheelWidth: 0.72,
  seat: [-0.2, 1.72, 0.3], driverScale: 0.85,
  hood: A(1.4, 1.96, 1.0), nose: A(2.35, 1.4, 1.8), roof: A(-0.42, 2.58, 1.3), deck: A(-2.0, 1.99, 1.6), tail: A(-2.3, 1.35, 1.6),
  build(m, R) {
    const halfW = 0.86;
    const wellR = Math.min(R + 0.1, 1.07);
    const path = sideOutline(2.25, -2.25, 1.25, [1.2, -1.2], 0.85, wellR, (p) => {
      p.l(-2.28, 1.95).l(-2.22, 1.98).l(0.55, 1.98).q(2.15, 1.9, 1.6, 1.98).q(2.3, 1.7, 2.28, 1.85).l(2.3, 1.3).l(2.25, 1.25);
    });
    const loft = P.shell(m, path, { halfW, shoulder: 1.72, topExp: 3.2, lowExp: 4, cornerF: 0.16, cornerR: 0.16, wells: [1.2, -1.2], wellR });
    const parts: O[] = [loft.mesh, P.panelLines(loft, [0.58, -0.62], 1.25, 2.0)];
    parts.push(...P.greenhouse(m, [-0.95, 1.97], [-0.88, 2.55], [0.05, 2.55], [0.6, 1.97], 1.5));
    // Chassis, axles, shocks.
    for (const s of [1, -1]) parts.push(box(m.trim, 4.2, 0.18, 0.12, 0.03, [0, 1.12, s * 0.45]));
    for (const x of [1.2, -1.2]) {
      parts.push(cyl(m.gunmetal, 0.1, 2.0, 'z', [x, 0.85, 0]), sphere(m.gunmetal, 0.22, [x, 0.85, 0]));
      const d = x > 0 ? 1 : -1;
      for (const s of [1, -1]) {
        const a: Vec = [x - 0.15 * d, 0.85, s * 0.6], b: Vec = [x - 0.5 * d, 1.25, s * 0.55];
        parts.push(rod(shockMat, a, b, 0.075), rod(m.chrome, a, b, 0.04));
      }
    }
    for (const s of [1, -1]) {
      parts.push(...P.headlamp(m, 2.28, 1.72, s * 0.6, 0.1));
      parts.push(...P.tailLamp(m, -2.27, 1.75, s * 0.64, 0.18, 0.2));
    }
    parts.push(...P.grille(m, 2.29, 1.58, 0.3, 0.8, 3));
    parts.push(capsule(m.trim, 0.08, 1.9, 'z', [2.33, 1.32, 0]), capsule(m.trim, 0.08, 1.9, 'z', [-2.3, 1.32, 0]));
    parts.push(...P.handles(m, loft, [[-0.45, 1.84]]), ...P.mirrors(m, 0.58, 2.05, 0.81));
    return {
      node: group(parts, 'body'), panel: path, loft,
      stripes: [[[0.6, 1.985], [1.475, 1.965], [2.1, 1.91]], [[-0.88, 2.585], [0.05, 2.585]], [[-2.2, 1.985], [-1.0, 1.985]]],
    };
  },
};

export const bus: BodyStyle = {
  id: 'bus', wheelRadius: 0.46, wheelbase: 3.4, track: 1.52, wheelWidth: 0.42,
  seat: [2.15, 1.0, 0.45], driverScale: 0.95,
  hood: A(-1.6, 2.15, 0.8), nose: A(2.85, 0.6, 1.9), roof: A(0.6, 2.15, 1.6), deck: A(-2.5, 2.15, 1.7), tail: A(-2.8, 0.5, 1.6),
  build(m, R) {
    const halfW = 0.95;
    const wellR = Math.min(R + 0.08, 0.76);
    const path = sideOutline(2.75, -2.75, 0.5, [1.7, -1.7], 0.46, wellR, (p) => {
      p.l(-2.78, 1.28).l(-2.75, 1.31).l(2.6, 1.31).q(2.8, 1.2, 2.78, 1.3).l(2.8, 0.54).l(2.76, 0.5);
    });
    const loft = P.shell(m, path, { halfW, shoulder: 0.95, topExp: 8, lowExp: 8, cornerF: 0.12, cornerR: 0.12, wells: [1.7, -1.7], wellR });
    const parts: O[] = [loft.mesh];
    parts.push(...P.greenhouse(m, [-2.73, 1.3], [-2.72, 2.12], [2.6, 2.12], [2.78, 1.3], 1.82, [-1.95, -1.15, -0.35, 0.45, 1.25, 2.0], 0.06, 0.14, 0.1));
    for (const s of [1, -1]) {
      for (const y of [1.12, 1.24]) parts.push(box(m.trim, 5.4, 0.035, 0.02, 0.009, [0, y, s * (loft.sideZ(0, y) + 0.004)]));
      parts.push(...P.headlamp(m, 2.79, 0.85, s * 0.68, 0.11));
      parts.push(...P.tailLamp(m, -2.775, 0.95, s * 0.68, 0.2, 0.2, true));
      parts.push(sphere(m.amber, 0.07, [2.62, 2.2, s * 0.6]), sphere(m.taillight, 0.07, [-2.7, 2.2, s * 0.6]));
      parts.push(rod(m.trim, [2.7, 1.35, s * 0.85], [2.9, 1.6, s * 1.05], 0.025));
      parts.push(box(m.trim, 0.06, 0.3, 0.16, 0.03, [2.92, 1.62, s * 1.08]));
    }
    parts.push(...P.grille(m, 2.8, 0.8, 0.3, 0.7, 3));
    parts.push(box(m.trim, 0.15, 0.18, 1.95, 0.04, [2.82, 0.5, 0]), box(m.trim, 0.15, 0.18, 1.95, 0.04, [-2.8, 0.5, 0]));
    parts.push(...P.plate(m, -2.79, 0.75, -1), ...P.exhaust(m, -2.8, 0.42, [0.6]));
    return { node: group(parts, 'body'), panel: path, loft, stripes: [[[-2.72, 2.155], [2.6, 2.155]]] };
  },
};

// MARK: - Emergency vehicles

/** Red and blue lights that flash in turn. `fast` doubles the rate (siren mode). */
function beacons() {
  const red = new THREE.MeshStandardMaterial({ color: 0xff1a1a, roughness: 0.15, emissive: 0xff0000, emissiveIntensity: 2 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x2659ff, roughness: 0.15, emissive: 0x1a4dff, emissiveIntensity: 2 });
  const tick = (now: number) => {
    const on = Math.floor(now / 220) % 2 === 0;
    red.emissiveIntensity = on ? 2.4 : 0.05;
    blue.emissiveIntensity = on ? 0.05 : 2.4;
  };
  return { red, blue, tick };
}

/** A lit bar of lights: red on the left, blue on the right, clear in the middle. */
function lightBar(m: CarMaterials, b: ReturnType<typeof beacons>, x: number, y: number, w: number): O[] {
  return [
    box(m.trim, 0.32, 0.06, w + 0.04, 0.02, [x, y + 0.03, 0]),
    box(b.red, 0.26, 0.13, w / 2 - 0.05, 0.05, [x, y + 0.12, w / 4 + 0.015]),
    box(b.blue, 0.26, 0.13, w / 2 - 0.05, 0.05, [x, y + 0.12, -w / 4 - 0.015]),
    box(m.white, 0.27, 0.06, 0.07, 0.02, [x, y + 0.12, 0]),
  ];
}

/** Five-point star badge for the police doors. */
function star(c: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  c.closePath();
}

export const firetruck: BodyStyle = {
  id: 'firetruck', wheelRadius: 0.48, wheelbase: 3.5, track: 1.66, wheelWidth: 0.44,
  seat: [2.2, 1.18, 0.45], driverScale: 0.95,
  hood: A(-2.5, 2.0, 0.8), nose: A(2.95, 0.72, 1.9), roof: A(1.75, 2.38, 1.3), deck: A(-2.8, 2.0, 1.6), tail: A(-2.92, 0.55, 1.6),
  build(m, R) {
    const halfW = 1.0;
    const wellR = Math.min(R + 0.08, 0.8);
    const wells = [1.95, -1.55];
    const path = sideOutline(2.9, -2.9, 0.55, wells, 0.48, wellR, (p) => {
      p.l(-2.93, 0.6).l(-2.93, 1.95).l(-2.88, 2.0).l(1.06, 2.0).l(1.1, 1.58).l(2.84, 1.58)
        .q(2.93, 1.48, 2.92, 1.58).l(2.93, 0.6).l(2.88, 0.55);
    });
    const loft = P.shell(m, path, { halfW, shoulder: 1.2, topExp: 9, lowExp: 9, cornerF: 0.12, cornerR: 0.1, wells, wellR });
    const lights = beacons();
    const parts: O[] = [loft.mesh, P.panelLines(loft, [1.15, 1.98], 0.6, 1.58)];
    // Cab: tall windows all round, door split behind the front wheel.
    parts.push(...P.greenhouse(m, [1.14, 1.57], [1.2, 2.36], [2.68, 2.36], [2.9, 1.57], 1.96, [1.98], 0.06, 0.14, 0.05));
    for (const s of [1, -1]) {
      const z = (x: number, y: number) => s * (loft.sideZ(x, y) + 0.004);
      // White stripe along the whole truck, and a chrome rub-rail under it.
      parts.push(box(m.white, 5.7, 0.13, 0.02, 0.009, [0, 1.06, z(0, 1.06)]));
      parts.push(box(m.chrome, 5.6, 0.035, 0.02, 0.009, [0, 0.95, z(0, 0.95)]));
      // Roll-up lockers between and behind the wheels.
      for (const [x, w] of [[0.2, 1.7], [-2.42, 0.82]]) {
        parts.push(box(m.alloy, w, 0.68, 0.025, 0.02, [x, 1.6, z(x, 1.6)]));
        for (let k = 0; k < 7; k++) parts.push(box(m.gunmetal, w - 0.04, 0.012, 0.03, 0, [x, 1.32 + k * 0.09, z(x, 1.6) + s * 0.006]));
      }
      // Yellow hose coiled on the side.
      parts.push(torus(m.yellow, 0.2, 0.05, 'z', [-0.95, 1.5, s * (halfW + 0.06)]));
      // Corner warning lights and the cab's light bar.
      parts.push(box(lights.red, 0.08, 0.1, 0.08, 0.03, [2.92, 1.5, s * 0.82]), box(lights.blue, 0.08, 0.1, 0.08, 0.03, [-2.92, 1.88, s * 0.82]));
      parts.push(P.rectLamp(m, 2.93, 0.88, s * 0.7, 0.18, 0.3));
      parts.push(...P.tailLamp(m, -2.93, 0.95, s * 0.75, 0.3, 0.16, true));
      parts.push(...P.mirrors(m, 2.6, 1.75, 0.95));
    }
    parts.push(...lightBar(m, lights, 2.45, 2.39, 1.5));
    // The ladder: two chrome rails with rungs, on posts above the body.
    const ly = 2.36, lz = 0.42;
    for (const s of [1, -1]) parts.push(box(m.alloy, 3.2, 0.12, 0.07, 0.02, [-0.55, ly, s * lz]));
    for (let x = -2.0; x <= 0.95; x += 0.26) parts.push(rod(m.alloy, [x, ly, -lz], [x, ly, lz], 0.03));
    for (const x of [-1.9, 0.8]) for (const s of [1, -1]) parts.push(box(m.trim, 0.08, 0.36, 0.08, 0, [x, 2.16, s * lz]));
    parts.push(cyl(m.gunmetal, 0.18, 0.5, 'z', [-2.25, 2.12, 0]));
    // Front: big grille, bumper, siren speaker.
    parts.push(...P.grille(m, 2.93, 1.15, 0.5, 1.0, 5));
    parts.push(box(m.chrome, 0.2, 0.24, 2.05, 0.08, [3.0, 0.62, 0]));
    parts.push(cyl(m.chrome, 0.08, 0.06, 'x', [3.1, 0.62, 0.45]), cyl(m.grille, 0.06, 0.07, 'x', [3.1, 0.62, 0.45]));
    parts.push(box(m.trim, 0.16, 0.18, 2.0, 0.04, [-2.95, 0.6, 0]));
    parts.push(...P.plate(m, -2.95, 0.82, -1), ...P.handles(m, loft, [[1.6, 1.32]]));
    return {
      node: group(parts, 'body'), panel: path, loft, tick: lights.tick,
      stripes: [[[1.2, 2.395], [2.2, 2.395]]],
    };
  },
};

export const police: BodyStyle = {
  id: 'police', wheelRadius: 0.38, wheelbase: 2.8, track: 1.42, wheelWidth: 0.4,
  seat: [-0.05, 0.66, 0.3], driverScale: 0.82,
  hood: A(1.45, 0.99, 0.9), nose: A(2.3, 0.42, 1.6), roof: A(-0.78, 1.53, 1.1), deck: A(-2.0, 0.99, 1.5), tail: A(-2.3, 0.32, 1.4),
  build(m, R) {
    const halfW = 0.88;
    const wellR = Math.min(R + 0.07, 0.54);
    const wells = [1.4, -1.4];
    const path = sideOutline(2.25, -2.25, 0.34, wells, 0.38, wellR, (p) => {
      p.l(-2.3, 0.42).l(-2.32, 0.85).q(-2.12, 0.98, -2.3, 0.96).l(0.8, 1.0)
        .q(2.12, 0.9, 1.6, 1.0).q(2.3, 0.66, 2.28, 0.86).l(2.3, 0.42).l(2.26, 0.34);
    });
    const loft = P.shell(m, path, { halfW, shoulder: 0.72, topExp: 3.2, lowExp: 4, cornerF: 0.18, cornerR: 0.2, flare: 0.02, wells, wellR });
    const lights = beacons();
    const parts: O[] = [loft.mesh, P.panelLines(loft, [0.8, -0.38, -1.42], 0.3, 1.0)];
    // Four doors: white panels with a gold star on the front ones.
    const b = loft.outline.bounds(), scale = 200;
    const livery = (mirror: boolean) => {
      const el = canvas(Math.round(b.width * scale), Math.round(b.height * scale), (c, W, H) => {
        if (mirror) { c.translate(W, 0); c.scale(-1, 1); }
        c.translate(0, H); c.scale(scale, -scale); c.translate(-b.minX, -b.minY);
        tracePath(c, loft.outline); c.clip();
        c.fillStyle = '#f7f7f7';
        c.beginPath();
        { // a rounded box (canvas roundRect needs iOS 16)
          const x = -1.42, y = 0.44, w = 2.22, h = 0.56, r = 0.06;
          c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
          c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
        }
        c.fill();
        if (!mirror) { c.save(); c.translate(0.2, 0.7); c.scale(1, -1); star(c, 0, 0, 0.13); c.restore(); }
        else { c.save(); c.translate(0.2, 0.7); c.scale(-1, -1); star(c, 0, 0, 0.13); c.restore(); }
        c.fillStyle = '#e8b21c'; c.fill();
        c.strokeStyle = '#8a6400'; c.lineWidth = 0.012; c.stroke();
      });
      const t = new THREE.CanvasTexture(el);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      return t;
    };
    parts.push(loft.decal(livery(false), livery(true), b, 0.004, 3, (map) =>
      new THREE.MeshStandardMaterial({ map, transparent: true, depthWrite: false, roughness: 0.3, polygonOffset: true, polygonOffsetFactor: -3 })));
    parts.push(...P.greenhouse(m, [-1.5, 0.98], [-0.95, 1.5], [0.15, 1.5], [0.8, 0.99], 1.46, [-0.4]));
    parts.push(...lightBar(m, lights, -0.25, 1.52, 1.15));
    for (const s of [1, -1]) {
      parts.push(P.rectLamp(m, 2.2, loft.topY(2.2, 0.55) - 0.02, s * 0.55, 0.12, 0.36, 0.7));
      parts.push(...P.tailLamp(m, -2.31, 0.78, s * 0.52, 0.12, 0.42));
      // Push bar and a door-pillar spotlight.
      parts.push(rod(m.plastic, [2.32, 0.3, s * 0.42], [2.42, 0.78, s * 0.42], 0.035));
      parts.push(box(lights.red, 0.04, 0.05, 0.12, 0.015, [2.3, 0.58, s * 0.66]));
    }
    parts.push(rod(m.plastic, [2.42, 0.78, -0.45], [2.42, 0.78, 0.45], 0.035), rod(m.plastic, [2.38, 0.45, -0.5], [2.38, 0.45, 0.5], 0.035));
    parts.push(cyl(m.chrome, 0.06, 0.09, 'x', [0.72, 1.06, 0.8]));
    parts.push(...P.grille(m, 2.27, 0.58, 0.14, 0.62, 3));
    parts.push(capsule(m.chrome, 0.05, 1.7, 'z', [2.28, 0.38, 0]), capsule(m.chrome, 0.05, 1.7, 'z', [-2.3, 0.4, 0]));
    parts.push(...P.plate(m, -2.31, 0.58, -1), ...P.plate(m, 2.3, 0.3, 1));
    parts.push(...P.handles(m, loft, [[0.55, 0.86], [-0.6, 0.86]]), ...P.mirrors(m, 0.75, 1.03, 0.8));
    parts.push(...P.exhaust(m, -2.3, 0.24, [0.5]));
    return {
      node: group(parts, 'body'), panel: path, loft, tick: lights.tick,
      stripes: [[[0.85, 1.0], [1.4, 0.99], [1.85, 0.95], [2.15, 0.85]], [[-2.05, 0.985], [-1.55, 0.99]]],
    };
  },
};

export const bodies: BodyStyle[] = [muscle, sports, formula, pickup, offroad, monster, bus, firetruck, police];
/** Bodies with lights and a siren instead of a horn. */
export const emergency = new Set(['firetruck', 'police']);
export const airfoil = P.airfoil;
