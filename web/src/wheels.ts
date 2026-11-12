import * as THREE from 'three';
import { box, cyl, group, sphere, torus, tube } from './geom';
import { CarMaterials } from './materials';

type O = THREE.Object3D;

const disc = new THREE.MeshStandardMaterial({ color: 0x737373, metalness: 0.9, roughness: 0.45 });
const nut = new THREE.MeshStandardMaterial({ color: 0xe61a1a, metalness: 0.6, roughness: 0.3 });
const glow = new THREE.MeshStandardMaterial({ color: 0x33fff2, roughness: 0.2, emissive: 0x1af2ff, emissiveIntensity: 1.6 });
type Mat = THREE.Material;

// Every wheel is built around +Y (the axle) with the hub face toward +Y.

const Kit = {
  /** A tyre with rounded sidewalls and a treaded face. */
  tyre(m: CarMaterials, r: number, w: number, rim: number, knobby = false, whitewall = false): O[] {
    const pipe = (r * 0.985 - rim) / 2;
    const ring = rim + pipe;
    const side = torus(m.rubber, ring, pipe);
    side.scale.set(1, w / 2 / pipe, 1);
    // The tread is an open band: a capped cylinder would hide everything set into the rim.
    const band = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w * 0.8, 36, 1, true), m.tread);
    band.castShadow = band.receiveShadow = true;
    const out: O[] = [side, band];
    if (whitewall) out.push(tube(m.white, ring - pipe * 0.55, ring + pipe * 0.35, 0.012, [0, w * 0.49, 0]));
    if (knobby) {
      const knobs = 18;
      for (let i = 0; i < knobs; i++) {
        const a = (i / knobs) * Math.PI * 2;
        for (const [k, y] of [[0, -0.25], [1, 0.25]] as const) {
          const arm = new THREE.Group();
          arm.rotation.y = -a - (k === 0 ? 0 : Math.PI / knobs);
          arm.add(box(m.rubber, r * 0.16, w * 0.42, r * 0.12, r * 0.03, [r, y * w, 0]));
          out.push(arm);
        }
      }
    }
    return out;
  },

  /** The rim's barrel, a dark back face, brake disc and the outer lip. */
  barrel(m: CarMaterials, rim: number, w: number, lip: Mat, back?: Mat): O[] {
    return [
      tube(m.gunmetal, rim * 0.9, rim, w * 0.84),
      cyl(back ?? m.grille, rim * 0.9, 0.02, 'y', [0, -w * 0.1, 0]),
      cyl(disc, rim * 0.74, w * 0.05, 'y', [0, w * 0.08, 0]),
      cyl(m.gunmetal, rim * 0.32, w * 0.07, 'y', [0, w * 0.1, 0]),
      torus(lip, rim * 0.95, rim * 0.06, 'y', [0, w * 0.4, 0]),
    ];
  },

  /** Radial spokes on the hub face. */
  spokes(mat: Mat, count: number, inner: number, outer: number, y: number, width: number, depth: number, twin = false, phase = 0): O[] {
    const out: O[] = [];
    const len = outer - inner;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + phase;
      for (const off of twin ? [-0.09, 0.09] : [0]) {
        const arm = new THREE.Group();
        arm.rotation.y = -(a + off);
        arm.add(box(mat, len, depth, width, Math.min(width, depth) * 0.4, [inner + len / 2, y, 0]));
        out.push(arm);
      }
    }
    return out;
  },

  /** Centre cap and lug nuts. */
  hub(m: CarMaterials, rim: number, w: number, cap: Mat, lugs = 5): O[] {
    const out: O[] = [cyl(cap, rim * 0.2, w * 0.12, 'y', [0, w * 0.4, 0])];
    for (let i = 0; i < lugs; i++) {
      const a = (i / lugs) * Math.PI * 2;
      out.push(cyl(m.chrome, rim * 0.035, w * 0.1, 'y', [Math.cos(a) * rim * 0.3, w * 0.4, Math.sin(a) * rim * 0.3], 16));
    }
    return out;
  },
};

export interface WheelStyle {
  id: string;
  label: string;
  scale: number;
  widthScale: number;
  build: (m: CarMaterials, r: number, w: number) => THREE.Group;
}

export const wheels: WheelStyle[] = [
  {
    id: 'alloy', label: 'Alloy', scale: 1, widthScale: 1, build: (m, r, w) => {
      const rim = r * 0.7;
      return group([...Kit.tyre(m, r, w, rim), ...Kit.barrel(m, rim, w, m.alloy),
        ...Kit.spokes(m.alloy, 5, rim * 0.2, rim * 0.95, w * 0.34, rim * 0.07, w * 0.14, true), ...Kit.hub(m, rim, w, m.alloy)]);
    },
  },
  {
    id: 'chrome', label: 'Chrome', scale: 1, widthScale: 1.05, build: (m, r, w) => {
      const rim = r * 0.62;
      return group([...Kit.tyre(m, r, w, rim), ...Kit.barrel(m, rim, w, m.chrome, m.chrome),
        ...Kit.spokes(m.chrome, 5, rim * 0.2, rim * 0.72, w * 0.22, rim * 0.2, w * 0.1),
        torus(m.chrome, rim * 0.82, rim * 0.12, 'y', [0, w * 0.3, 0]), ...Kit.hub(m, rim, w, m.chrome)]);
    },
  },
  {
    id: 'mesh', label: 'Mesh', scale: 1, widthScale: 1.05, build: (m, r, w) => {
      const rim = r * 0.66;
      return group([...Kit.tyre(m, r, w, rim), ...Kit.barrel(m, rim, w, m.chrome),
        ...Kit.spokes(m.gunmetal, 10, rim * 0.18, rim * 0.92, w * 0.33, rim * 0.05, w * 0.08),
        ...Kit.spokes(m.gunmetal, 10, rim * 0.45, rim * 0.92, w * 0.33, rim * 0.05, w * 0.08, false, Math.PI / 10),
        ...Kit.hub(m, rim, w, m.gunmetal)]);
    },
  },
  {
    id: 'racing', label: 'Racing', scale: 0.98, widthScale: 1.25, build: (m, r, w) => {
      const rim = r * 0.72;
      return group([...Kit.tyre(m, r, w, rim), ...Kit.barrel(m, rim, w, m.gold),
        ...Kit.spokes(m.gold, 6, rim * 0.15, rim * 0.95, w * 0.32, rim * 0.13, w * 0.1),
        cyl(nut, rim * 0.17, w * 0.16, 'y', [0, w * 0.4, 0]), cyl(m.gold, rim * 0.22, w * 0.1, 'y', [0, w * 0.36, 0])]);
    },
  },
  {
    id: 'offroad', label: 'Off-road', scale: 1.22, widthScale: 1.35, build: (m, r, w) => {
      const rim = r * 0.52;
      const parts = [...Kit.tyre(m, r * 0.92, w, rim, true), ...Kit.barrel(m, rim, w, m.gunmetal, m.trim),
        ...Kit.spokes(m.trim, 8, rim * 0.2, rim * 0.9, w * 0.3, rim * 0.14, w * 0.08),
        tube(m.gunmetal, rim * 0.82, rim * 1.06, w * 0.06, [0, w * 0.42, 0])];
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        parts.push(cyl(m.chrome, rim * 0.035, w * 0.08, 'y', [Math.cos(a) * rim * 0.94, w * 0.45, Math.sin(a) * rim * 0.94], 12));
      }
      parts.push(...Kit.hub(m, rim, w, m.chrome, 6));
      return group(parts);
    },
  },
  {
    id: 'whitewall', label: 'Whitewall', scale: 1.02, widthScale: 0.95, build: (m, r, w) => {
      const rim = r * 0.58;
      return group([...Kit.tyre(m, r, w, rim, false, true), ...Kit.barrel(m, rim, w, m.chrome, m.paint),
        cyl(m.paint, rim * 0.92, w * 0.04, 'y', [0, w * 0.3, 0]), sphere(m.chrome, rim * 0.62, [0, w * 0.3, 0], [1, 0.3, 1])]);
    },
  },
  {
    id: 'wire', label: 'Wire', scale: 1.02, widthScale: 0.9, build: (m, r, w) => {
      const rim = r * 0.64;
      const parts = [...Kit.tyre(m, r, w, rim, false, true), ...Kit.barrel(m, rim, w, m.chrome, m.trim),
        cyl(m.chrome, rim * 0.2, w * 0.6, 'y', [0, w * 0.1, 0]), cyl(m.gold, rim * 0.12, w * 0.7, 'y', [0, w * 0.1, 0])];
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const lace = i % 2 === 0 ? 0.25 : -0.1;
        const spoke = cyl(m.chrome, rim * 0.018, rim * 0.78, 'x', [rim * 0.56, w * lace, 0], 8);
        spoke.rotation.y = 0.25;
        const arm = new THREE.Group();
        arm.rotation.y = -a;
        arm.add(spoke);
        parts.push(arm);
      }
      return group(parts);
    },
  },
  {
    id: 'glow', label: 'Glow', scale: 1, widthScale: 1.1, build: (m, r, w) => {
      const rim = r * 0.66;
      return group([...Kit.tyre(m, r, w, rim), ...Kit.barrel(m, rim, w, glow, m.trim),
        ...Kit.spokes(m.trim, 7, rim * 0.18, rim * 0.92, w * 0.33, rim * 0.1, w * 0.1), ...Kit.hub(m, rim, w, glow)]);
    },
  },
];
