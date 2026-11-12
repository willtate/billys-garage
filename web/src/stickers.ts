import * as THREE from 'three';
import { BodyBuild } from './bodies';
import { canvas, Outline, tracePath } from './geom';
import { CarMaterials } from './materials';

/** Side decals. Art is drawn to fit the body's side outline, so it never hangs over a wheel well. */

export const stickers = ['none', 'stripes', 'flames', 'lightning', 'checker', 'number'];
const numbers: Record<string, string> = { muscle: '1', sports: '7', formula: '5', pickup: '4', offroad: '9', monster: '8', bus: '3' };
/** How far each body's rounded edges eat into its flat side. */
const insets: Record<string, number> = { muscle: 0.11, sports: 0.12, formula: 0.1, pickup: 0.12, offroad: 0.1, monster: 0.12, bus: 0.12 };
/** Flat-sided bodies (no rounded skin): how far the side is from the centre line. */
const panelZ: Record<string, number> = { formula: 0.62 };

function flames(c: CanvasRenderingContext2D, front: number, L: number, yLo: number, yHi: number) {
  const tongues = 5, H = yHi - yLo;
  c.beginPath();
  c.moveTo(front + 0.2, yHi);
  for (let i = 0; i < tongues; i++) {
    const t = i / (tongues - 1);
    const yTip = yHi - H * (0.08 + 0.84 * t);
    const reach = L * (0.42 + 0.22 * Math.sin(i * 2.1 + 0.5));
    c.quadraticCurveTo(front - reach * 0.55, yTip + H * 0.2, front - reach, yTip + H * 0.05);
    if (i < tongues - 1) {
      c.quadraticCurveTo(front - reach * 0.6, yTip - H * 0.02, front - L * 0.1, yHi - H * (0.08 + 0.84 * (t + 0.5 / (tongues - 1))));
    } else {
      c.quadraticCurveTo(front - reach * 0.5, yLo, front + 0.2, yLo);
    }
  }
  c.closePath();
  const g = c.createLinearGradient(front, 0, front - L * 0.66, 0);
  g.addColorStop(0, '#fff24d'); g.addColorStop(0.45, '#ff8c00'); g.addColorStop(1, '#d90d00');
  c.fillStyle = g;
  c.fill();
  c.strokeStyle = '#800000'; c.lineWidth = 0.02;
  c.stroke();
}

/** One side's artwork. `tinted` art is drawn white and coloured by the stripe material. */
function art(id: string, panel: Outline, bodyID: string, mirror: boolean): HTMLCanvasElement {
  const b = panel.bounds();
  const scale = 220, L = b.width, H = b.height;
  const midY = b.minY + H * 0.48;
  return canvas(Math.round(L * scale), Math.round(H * scale), (c, W, Hpx) => {
    c.save();
    if (mirror) { c.translate(W, 0); c.scale(-1, 1); }
    c.translate(0, Hpx); c.scale(scale, -scale); c.translate(-b.minX, -b.minY);
    tracePath(c, panel); c.clip();
    if (id === 'flames') flames(c, b.maxX - 0.12, L, b.minY + H * 0.3, b.minY + H * 0.74);
    if (id === 'lightning') {
      const x0 = b.maxX - 0.15, x1 = b.minX + 0.2, t = H * 0.14;
      const pts = [[x0, midY + t], [x0 - L * 0.32, midY + t * 1.6], [x0 - L * 0.36, midY + t * 0.2], [x0 - L * 0.62, midY + t * 1.1],
        [x0 - L * 0.66, midY - t * 0.2], [x1, midY - t * 0.6], [x0 - L * 0.62, midY - t * 1.4], [x0 - L * 0.58, midY - t * 0.1],
        [x0 - L * 0.32, midY - t * 1.1], [x0 - L * 0.28, midY + t * 0.3]];
      c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath();
      c.fillStyle = '#ffd90d'; c.fill();
      c.strokeStyle = '#0d0d0d'; c.lineWidth = 0.025; c.lineJoin = 'round'; c.stroke();
    }
    if (id === 'stripes') {
      c.fillStyle = '#fff';
      c.fillRect(b.minX, b.minY + H * 0.3, L, H * 0.09);
      c.fillRect(b.minX, b.minY + H * 0.44, L, H * 0.04);
    }
    if (id === 'checker') {
      const sq = H * 0.11, y0 = b.minY + H * 0.3;
      for (let x = b.minX, i = 0; x < b.maxX; x += sq, i++) {
        for (const row of [0, 1]) {
          c.fillStyle = (i + row) % 2 === 0 ? '#0d0d0d' : '#fff';
          c.fillRect(x, y0 + row * sq, sq + 0.002, sq);
        }
      }
    }
    // Wipe a band along the outline where the rounded edge curves away.
    c.globalCompositeOperation = 'destination-out';
    tracePath(c, panel);
    c.lineWidth = (insets[bodyID] ?? 0.11) * 2 + 0.03; c.lineJoin = 'round'; c.stroke();
    c.restore();

    if (id === 'number') {
      // Drawn in image space so the digits never come out backwards.
      const cx = W / 2, cy = (b.maxY - midY) * scale, r = Math.min(H * 0.33, 0.32) * scale;
      c.fillStyle = '#fff'; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#0d0d0d'; c.lineWidth = r * 0.1; c.beginPath(); c.arc(cx, cy, r * 0.95, 0, Math.PI * 2); c.stroke();
      c.fillStyle = '#0d0d0d'; c.font = `900 ${r * 1.4}px -apple-system, system-ui, sans-serif`;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(numbers[bodyID] ?? '1', cx, cy + r * 0.08);
    }
  });
}

function texture(el: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(el);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function makeSticker(id: string, bodyID: string, shell: BodyBuild, m: CarMaterials): THREE.Object3D | null {
  if (id === 'none') return null;
  const mat = (map: THREE.Texture) => {
    const mm = new THREE.MeshStandardMaterial({ map, transparent: true, depthWrite: false, roughness: 0.3,
      polygonOffset: true, polygonOffsetFactor: -4 });
    if (id === 'stripes') mm.color = m.stripe.color; // shared, so a paint change recolours it
    return mm;
  };
  const right = texture(art(id, shell.panel, bodyID, false)), left = texture(art(id, shell.panel, bodyID, true));
  const b = shell.panel.bounds();
  if (shell.loft) {
    const n = shell.loft.decal(right, left, b, 0.006, 5, mat);
    n.name = 'sticker';
    return n;
  }
  // Flat sides: a plain picture on each side.
  const root = new THREE.Group();
  root.name = 'sticker';
  for (const [side, map] of [[1, right], [-1, left]] as const) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(b.width, b.height), mat(map));
    plane.position.set((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, side * ((panelZ[bodyID] ?? 0.6) + 0.004));
    if (side < 0) plane.rotation.y = Math.PI;
    plane.renderOrder = 5;
    root.add(plane);
  }
  return root;
}
