import * as THREE from 'three';
import { box, canvas, capsule, cyl, extrude, group, Outline, sideOutline, sphere, torus, tracePath, tumblehome, Vec } from './geom';
import { Loft, LoftSpec } from './loft';
import { CarMaterials } from './materials';

type O = THREE.Object3D;

export interface BodyBuild {
  node: THREE.Group;
  /** Side outline of the panel stickers go on. */
  panel: Outline;
  /** Racing stripe runs along the top centre line. */
  stripes: [number, number][][];
  loft: Loft;
}

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
  build: (m: CarMaterials, wheelR: number) => BodyBuild;
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

  /** A tail lamp: dark housing, glowing core and a deep red cover. Faces -X. */
  tailLamp(m: CarMaterials, x: number, y: number, z: number, h: number, w: number): O[] {
    const r = Math.min(h, w);
    return [
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
