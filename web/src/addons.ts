import * as THREE from 'three';
import { airfoil, BodyStyle, Slot } from './bodies';
import { box, cone, cyl, extrude, group, mergeStatic, Outline, rod, sphere, torus } from './geom';
import { CarMaterials } from './materials';

// Bolt-on parts. Each is built at its anchor's origin on the body: engine parts sit on the hood,
// front parts face +X from the nose, roof parts sit on the roof, back parts sit on the rear deck.

type O = THREE.Object3D;

export interface Addon {
  id: string;
  /** Builds the part (nil = nothing fitted). Moving bits go in a child named 'anim' with a userData.tick. */
  build?: (m: CarMaterials, b: BodyStyle) => THREE.Group;
}

const lit = (color: number, emissive: number, intensity = 1.6) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.15, emissive, emissiveIntensity: intensity });

/** Wrap static parts (merged into few draws) plus optional animated bits. */
function part(parts: O[], anim: O[] = []): THREE.Group {
  const g = group(parts, 'addon');
  mergeStatic(g);
  g.add(...anim);
  return g;
}

function roundLamp(m: CarMaterials, x: number, y: number, z: number, r: number, lens?: THREE.Material): O[] {
  return [torus(m.chrome, r, r * 0.22, 'x', [x, y, z]), sphere(lens ?? m.headlight, r * 0.95, [x - r * 0.25, y, z], [0.4, 1, 1])];
}

const yellowLens = lit(0xffe64d, 0xffcc33, 1.8);
const policeRed = lit(0xff1a1a, 0xff0000, 1.8);
const policeBlue = lit(0x2659ff, 0x1a4dff, 1.8);
const beaconLens = new THREE.MeshStandardMaterial({ color: 0xff991a, roughness: 0.1, emissive: 0xe67300, emissiveIntensity: 1.5, transparent: true, opacity: 0.8 });
const flame = lit(0xff8c00, 0xff8c0d, 2);

export const engineParts: Addon[] = [
  { id: 'none' },
  {
    id: 'blower', build: (m) => {
      const p: O[] = [box(m.gunmetal, 0.62, 0.08, 0.5, 0.02, [0, 0.04, 0]), box(m.chrome, 0.58, 0.3, 0.4, 0.08, [0, 0.23, 0])];
      for (let i = 0; i < 7; i++) p.push(box(m.chrome, 0.025, 0.32, 0.44, 0.01, [-0.24 + i * 0.08, 0.23, 0]));
      p.push(cyl(m.gunmetal, 0.11, 0.06, 'x', [0.32, 0.2, 0.08]), cyl(m.gunmetal, 0.07, 0.06, 'x', [0.32, 0.08, -0.12]));
      p.push(box(m.trim, 0.02, 0.26, 0.06, 0, [0.34, 0.14, -0.02]));
      // Air scoop with butterfly flaps.
      p.push(box(m.trim, 0.4, 0.2, 0.34, 0.04, [0, 0.48, 0]), box(m.grille, 0.04, 0.16, 0.3, 0, [0.2, 0.48, 0]));
      for (let i = 0; i < 3; i++) p.push(box(m.chrome, 0.03, 0.02, 0.28, 0, [0.21, 0.42 + i * 0.06, 0]));
      const inner = group(p);
      inner.scale.setScalar(0.8); // in an inner node so the pop-in animation keeps it
      return part([inner]);
    },
  },
  {
    id: 'scoop', build: (m) => {
      const path = new Outline().move(-0.5, -0.02).l(0.38, -0.02).l(0.38, 0.17).q(-0.5, 0.03, 0.0, 0.17).close();
      return part([extrude(path.shape, 0.5, 0.04, m.paint), box(m.grille, 0.03, 0.12, 0.4, 0.014, [0.39, 0.08, 0])]);
    },
  },
  {
    id: 'stacks', build: (m) => {
      const p: O[] = [box(m.gunmetal, 0.62, 0.1, 0.44, 0.03, [0, 0.05, 0])];
      for (const x of [-0.22, -0.075, 0.075, 0.22]) for (const z of [0.11, -0.11]) {
        p.push(cone(m.chrome, 0.065, 0.04, 0.24, 'y', [x, 0.22, z]), cyl(m.grille, 0.045, 0.01, 'y', [x, 0.341, z], 16));
      }
      return part(p);
    },
  },
  {
    id: 'vents', build: (m) => {
      const p: O[] = [];
      for (const z of [0.24, -0.24]) {
        p.push(box(m.trim, 0.5, 0.03, 0.26, 0.014, [0, 0.01, z]));
        for (let i = 0; i < 5; i++) {
          const l = box(m.grille, 0.035, 0.04, 0.22, 0, [-0.18 + i * 0.09, 0.035, z]);
          l.rotation.z = 0.5;
          p.push(l);
        }
      }
      return part(p);
    },
  },
];

export const frontParts: Addon[] = [
  { id: 'none' },
  {
    id: 'bullbar', build: (m, b) => {
      const w = b.nose.w / 2, bar = m.plastic;
      const p: O[] = [rod(bar, [0.14, -0.05, -w * 0.95], [0.14, -0.05, w * 0.95], 0.05), rod(bar, [0.2, 0.42, -0.36], [0.2, 0.42, 0.36], 0.045)];
      for (const s of [1, -1]) {
        p.push(rod(bar, [0.14, -0.05, s * 0.36], [0.2, 0.42, s * 0.36], 0.045));
        p.push(rod(bar, [0.2, 0.42, s * 0.36], [0.14, -0.05, s * w * 0.8], 0.04));
        p.push(rod(bar, [0, -0.05, s * 0.36], [0.14, -0.05, s * 0.36], 0.04));
        p.push(...roundLamp(m, 0.26, 0.52, s * 0.22, 0.07));
      }
      return part(p);
    },
  },
  {
    id: 'lip', build: (m, b) => {
      const w = b.nose.w * 0.82;
      const p: O[] = [box(m.trim, 0.34, 0.035, w, 0.015, [-0.07, -0.04, 0])];
      for (const s of [1, -1]) p.push(box(m.trim, 0.26, 0.08, 0.03, 0.01, [-0.09, -0.01, (s * w) / 2]));
      return part(p);
    },
  },
  {
    id: 'foglights', build: (m) => {
      const p: O[] = [rod(m.trim, [0.08, 0.05, -0.62], [0.08, 0.05, 0.62], 0.03)];
      for (const s of [1, -1]) {
        p.push(cyl(m.trim, 0.12, 0.12, 'x', [0.14, 0.12, s * 0.42]), ...roundLamp(m, 0.21, 0.12, s * 0.42, 0.11, yellowLens));
      }
      return part(p);
    },
  },
  {
    id: 'plow', build: (m, b) => {
      const ground = -b.nose.y;
      const blade = new THREE.Shape();
      blade.absarc(0.75, 0.3, 0.42, -Math.PI / 2, Math.PI * 0.62, true);
      blade.absarc(0.75, 0.3, 0.34, Math.PI * 0.62, -Math.PI / 2, false);
      blade.closePath();
      const bladeNode = extrude(blade, b.nose.w + 0.5, 0.02, m.yellow);
      bladeNode.position.y = ground + 0.15;
      const p: O[] = [bladeNode, box(m.trim, 0.1, 0.06, b.nose.w + 0.5, 0.02, [0.75, ground + 0.06, 0])];
      for (const s of [1, -1]) {
        p.push(rod(m.trim, [0, 0, s * 0.35], [0.5, ground + 0.4, s * 0.35], 0.05), box(m.trim, 0.15, 0.2, 0.08, 0.02, [0, 0, s * 0.35]));
      }
      return part(p);
    },
  },
];

export const roofParts: Addon[] = [
  { id: 'none' },
  {
    id: 'police', build: (m, b) => {
      const w = Math.min(b.roof.w * 0.85, 1.25);
      const g = part([
        box(m.trim, 0.3, 0.06, w, 0.02, [0, 0.03, 0]),
        box(policeRed, 0.26, 0.14, w / 2 - 0.04, 0.05, [0, 0.13, w / 4 + 0.01]),
        box(policeBlue, 0.26, 0.14, w / 2 - 0.04, 0.05, [0, 0.13, -w / 4 - 0.01]),
        box(m.white, 0.27, 0.05, 0.08, 0.02, [0, 0.13, 0]),
      ]);
      g.userData.tick = (now: number) => {
        const red = Math.floor(now / 250) % 2 === 0;
        policeRed.emissiveIntensity = red ? 2.2 : 0.05;
        policeBlue.emissiveIntensity = red ? 0.05 : 2.2;
      };
      return g;
    },
  },
  {
    id: 'lightbar', build: (m, b) => {
      const w = Math.min(b.roof.w * 0.95, 1.45), n = 6;
      const p: O[] = [box(m.trim, 0.14, 0.13, w, 0.04, [0.25, 0.12, 0])];
      for (let i = 0; i < n; i++) p.push(box(m.headlight, 0.02, 0.09, w / n - 0.04, 0.009, [0.325, 0.12, ((i + 0.5) / n) * w - w / 2]));
      for (const s of [1, -1]) p.push(box(m.trim, 0.2, 0.08, 0.05, 0.02, [0.15, 0.03, s * w * 0.42]));
      return part(p);
    },
  },
  {
    id: 'rack', build: (m, b) => {
      const w = Math.min(b.roof.w * 0.8, 1.3);
      const p: O[] = [];
      for (const s of [1, -1]) {
        p.push(rod(m.trim, [-0.55, 0.1, (s * w) / 2], [0.55, 0.1, (s * w) / 2], 0.03));
        p.push(box(m.trim, 0.08, 0.1, 0.06, 0, [-0.45, 0.05, (s * w) / 2]), box(m.trim, 0.08, 0.1, 0.06, 0, [0.45, 0.05, (s * w) / 2]));
      }
      for (const x of [-0.4, 0, 0.4]) p.push(rod(m.trim, [x, 0.1, -w / 2], [x, 0.1, w / 2], 0.025));
      const r = 0.1, x0 = -0.5, y0 = 0.12, bw = 0.95, bh = 0.22;
      const cargo = new THREE.Shape();
      cargo.moveTo(x0 + r, y0); cargo.lineTo(x0 + bw - r, y0); cargo.quadraticCurveTo(x0 + bw, y0, x0 + bw, y0 + r);
      cargo.lineTo(x0 + bw, y0 + bh - r); cargo.quadraticCurveTo(x0 + bw, y0 + bh, x0 + bw - r, y0 + bh);
      cargo.lineTo(x0 + r, y0 + bh); cargo.quadraticCurveTo(x0, y0 + bh, x0, y0 + bh - r);
      cargo.lineTo(x0, y0 + r); cargo.quadraticCurveTo(x0, y0, x0 + r, y0);
      p.push(extrude(cargo, w * 0.75, 0.06, m.plastic));
      return part(p);
    },
  },
  {
    id: 'beacon', build: (m) => {
      const spinner = group([box(m.chrome, 0.04, 0.12, 0.18, 0, [0.06, 0.2, 0])], 'anim');
      const g = part([cyl(m.trim, 0.2, 0.06, 'y', [0, 0.03, 0]), sphere(beaconLens, 0.17, [0, 0.12, 0], [1, 1.2, 1])], [spinner]);
      g.userData.tick = (now: number) => { spinner.rotation.y = (now / 600) * Math.PI * 2; };
      return g;
    },
  },
];

export const backParts: Addon[] = [
  { id: 'none' },
  {
    id: 'ducktail', build: (m, b) => {
      const path = new Outline().move(0.25, -0.02).l(-0.2, -0.02).l(-0.24, 0.13).q(0.25, 0.0, -0.05, 0.05).close();
      return part([extrude(path.shape, b.deck.w, 0.03, m.paint)]);
    },
  },
  {
    id: 'wing', build: (m, b) => {
      const span = Math.min(b.deck.w * 1.05, 1.9);
      const p: O[] = [airfoil(m.trim, 0.5, 0.09, span, [-0.05, 0.5, 0])];
      for (const s of [1, -1]) {
        p.push(box(m.paint, 0.56, 0.3, 0.03, 0.01, [-0.06, 0.5, (s * span) / 2]));
        // Swan-neck upright.
        const neck = new Outline().move(0.1, 0).l(0.2, 0).q(0.05, 0.52, 0.22, 0.4).l(-0.05, 0.52).q(0.1, 0, 0.12, 0.38).close();
        const n = extrude(neck.shape, 0.05, 0.01, m.trim);
        n.position.z = s * span * 0.3;
        p.push(n);
      }
      return part(p);
    },
  },
  {
    id: 'rockets', build: (m) => {
      const p: O[] = [], flames: O[] = [];
      for (const side of [1, -1]) {
        const z = side * 0.42;
        p.push(cyl(m.chrome, 0.13, 0.8, 'x', [0.05, 0.18, z]), cone(m.taillight, 0, 0.13, 0.3, 'x', [0.6, 0.18, z]));
        p.push(cyl(m.gunmetal, 0.1, 0.1, 'x', [-0.38, 0.18, z]));
        for (const fin of [0, 2.1, 4.2]) {
          const arm = new THREE.Group();
          arm.position.set(0, 0.18, z);
          arm.rotation.x = fin;
          arm.add(box(m.taillight, 0.25, 0.14, 0.02, 0, [-0.25, 0.14, 0]));
          p.push(arm);
        }
        flames.push(cone(flame, 0, 0.1, 0.4, 'negX', [-0.62, 0.18, z]));
      }
      const anim = group(flames, 'anim');
      const g = part(p, [anim]);
      g.userData.tick = (now: number) => {
        const s = Math.floor(now / 90) % 2 ? 1.25 : 0.85;
        for (const f of flames) f.scale.setScalar(s);
      };
      return g;
    },
  },
  {
    id: 'stacks', build: (m, b) => {
      const z = Math.min(b.deck.w / 2 - 0.12, 0.62);
      const p: O[] = [];
      for (const s of [1, -1]) {
        p.push(cyl(m.chrome, 0.07, 1.0, 'y', [0, 0.5, s * z]), cyl(m.trim, 0.085, 0.4, 'y', [0, 0.4, s * z]));
        const cap = cyl(m.chrome, 0.075, 0.12, 'y', [-0.02, 1.02, s * z]);
        cap.rotation.z = 0.6;
        p.push(cap);
      }
      return part(p);
    },
  },
];

export const addons: Record<Slot, Addon[]> = { engine: engineParts, front: frontParts, roof: roofParts, back: backParts };
