import * as THREE from 'three';
import { canvas, seeded, tex } from './geom';

export interface Paint { id: string; color: string; metallic?: boolean }

export const paints: Paint[] = [
  { id: 'red', color: '#d10a0d' },
  { id: 'orange', color: '#ff6b05' },
  { id: 'yellow', color: '#ffcc05' },
  { id: 'lime', color: '#73d91a' },
  { id: 'green', color: '#0d6b2e' },
  { id: 'army', color: '#4d5733' },
  { id: 'teal', color: '#059eb3' },
  { id: 'blue', color: '#0d40d9' },
  { id: 'navy', color: '#0a144d' },
  { id: 'purple', color: '#661fbf' },
  { id: 'white', color: '#f2f2f2' },
  { id: 'black', color: '#0a0a0a' },
  { id: 'silver', color: '#cccccc', metallic: true },
  { id: 'gold', color: '#f2b340', metallic: true },
];

export const isLight = (id: string) => ['white', 'yellow', 'silver', 'gold', 'orange', 'lime'].includes(id);

/** Fine random bumps: metallic flake under the clear coat. */
const flakeNormal = (() => {
  const rnd = seeded(11);
  const el = canvas(256, 256, (c, w, h) => {
    const img = c.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      img.data[i * 4] = 128 + (rnd() - 0.5) * 120;
      img.data[i * 4 + 1] = 128 + (rnd() - 0.5) * 120;
      img.data[i * 4 + 2] = 255;
      img.data[i * 4 + 3] = 255;
    }
    c.putImageData(img, 0, 0);
  });
  return tex(el, [10, 10], false);
})();

/** Tyre tread: dark rubber with chunky chevron grooves, wrapped round the tyre. */
const treadMap = tex(canvas(64, 64, (c) => {
  c.fillStyle = '#1f1f1f'; c.fillRect(0, 0, 64, 64);
  c.fillStyle = '#080808';
  for (const col of [8, 40]) {
    c.beginPath();
    c.moveTo(col, 0); c.lineTo(col + 10, 32); c.lineTo(col, 64); c.lineTo(col + 7, 64); c.lineTo(col + 17, 32); c.lineTo(col + 7, 0);
    c.closePath(); c.fill();
  }
  c.fillRect(0, 30, 64, 4);
}), [6, 1]);

const std = (color: THREE.ColorRepresentation, metalness = 0, roughness = 0.5, extra: THREE.MeshPhysicalMaterialParameters = {}) =>
  new THREE.MeshPhysicalMaterial({ color, metalness, roughness, ...extra });

const glow = (color: string, emissive: string, intensity = 1.5) =>
  std(color, 0, 0.15, { emissive, emissiveIntensity: intensity });

/** Every material one car uses. Paint changes recolour these in place. */
export class CarMaterials {
  paint = std('#0d40d9', 0.2, 0.32, { clearcoat: 1, clearcoatRoughness: 0.04, normalMap: flakeNormal, normalScale: new THREE.Vector2(0.0, 0.0) });
  trim = std(0x121212, 0, 0.6);
  plastic = std(0x1f1f1f, 0, 0.75);
  grille = std(0x080808, 0, 0.5);
  glass = std(0x070b12, 0, 0.03, { transparent: true, opacity: 0.88, envMapIntensity: 1.2, depthWrite: false, clearcoat: 1 });
  chrome = std(0xf5f5f5, 1, 0.06);
  alloy = std(0xc7c7c7, 1, 0.26);
  gunmetal = std(0x383838, 1, 0.35);
  rubber = std(0x141414, 0, 0.92, { specularIntensity: 0.3 });
  tread = std(0xffffff, 0, 0.95, { map: treadMap, specularIntensity: 0.2 });
  white = std(0xf7f7f7, 0, 0.35);
  gold = std(0xffc74d, 1, 0.2);
  yellow = std(0xffcc0d, 0, 0.35, { clearcoat: 1 });
  headlight = glow('#fffae6', '#fff5d1', 4);
  taillight = glow('#e60d0d', '#d90505', 3.5);
  amber = glow('#ff8c00', '#cc5900', 3);
  caliper = std(0xd91410, 0, 0.3, { clearcoat: 1 });
  /** Polished lamp reflector: bright silver with a faint glow so lamps read as lit. */
  reflector = std(0xebebeb, 1, 0.3, { emissive: '#ffffff', emissiveIntensity: 0.25 });
  /** Clear lamp cover glass. */
  lens = std(0xffffff, 0, 0.02, { transparent: true, opacity: 0.12, depthWrite: false, clearcoat: 1 });
  /** Deep red tail-lamp cover over a brighter glowing core. */
  tailLens = std(0xbf050a, 0, 0.05, { transparent: true, opacity: 0.75, emissive: '#5a0000', emissiveIntensity: 1, clearcoat: 1 });
  /** Racing stripes: white on dark paint, near-black on light paint. */
  stripe = std(0xffffff, 0, 0.3, { clearcoat: 1, clearcoatRoughness: 0.04 });
  current: Paint = paints[7];

  private fade?: { from: THREE.Color; to: THREE.Color; t0: number };

  setPaint(p: Paint, animated: boolean) {
    this.current = p;
    const to = new THREE.Color(p.color);
    if (animated) this.fade = { from: this.paint.color.clone(), to, t0: performance.now() };
    else this.paint.color.copy(to);
    this.paint.metalness = p.metallic ? 0.85 : 0.15;
    this.paint.roughness = p.metallic ? 0.3 : 0.32;
    // Visible flake only on metallic paints; solid colours stay smooth under the clear coat.
    this.paint.normalScale.setScalar(p.metallic ? 0.12 : 0.0);
    this.stripe.color.set(isLight(p.id) ? 0x1a1a1a : 0xfafafa);
  }

  /** Call every frame to run the colour fade. */
  tick(now: number) {
    if (!this.fade) return;
    const t = Math.min(1, (now - this.fade.t0) / 450);
    this.paint.color.lerpColors(this.fade.from, this.fade.to, t * t * (3 - 2 * t));
    if (t >= 1) this.fade = undefined;
  }
}
