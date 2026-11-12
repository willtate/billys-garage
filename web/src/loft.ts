import * as THREE from 'three';
import { Outline } from './geom';

/**
 * A car body skinned from its side outline: every slice across the car is a rounded
 * (superellipse) section, so the sides bow out, the hood is crowned and the corners roll
 * over smoothly. Port of Loft.swift.
 */
export interface LoftSpec {
  halfW: number;
  /** Height where the sides are widest. */
  shoulder: number;
  /** Roundness above / below the shoulder: ~2.5 is soft and curvy, 8 is nearly boxy. */
  topExp?: number;
  lowExp?: number;
  /** Rounding of the corners seen from above. */
  cornerF?: number;
  cornerR?: number;
  /** How far the lower body swells out around each wheel (fraction of the width). */
  flare?: number;
  wells?: number[];
  wellR?: number;
}

type V3 = THREE.Vector3;
interface Section { yb: number; yt: number; ys: number; W: number }

export class Loft {
  readonly spec: Required<LoftSpec>;
  readonly mesh: THREE.Mesh;
  readonly minX: number;
  readonly maxX: number;
  private poly: THREE.Vector2[];
  private grid: V3[][] = [];
  private norms: V3[][] = [];
  private readonly N = 64;

  constructor(readonly outline: Outline, spec: LoftSpec, paint: THREE.Material, under: THREE.Material) {
    this.spec = { topExp: 3, lowExp: 4, cornerF: 0.2, cornerR: 0.2, flare: 0, wells: [], wellR: 0.5, ...spec };
    this.poly = outline.points(24);
    this.minX = Math.min(...this.poly.map((p) => p.x));
    this.maxX = Math.max(...this.poly.map((p) => p.x));
    this.buildGrid();
    this.mesh = new THREE.Mesh(this.buildGeometry(), [paint, under]);
    this.mesh.name = 'shell';
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
  }

  // MARK: Shape queries

  /** Lowest and highest point of the outline at this x. */
  span(x: number): { lo: number; hi: number } | null {
    let lo = Infinity, hi = -Infinity;
    const P = this.poly;
    for (let k = 0; k < P.length - 1; k++) {
      const a = P[k], b = P[k + 1];
      if ((a.x - x) * (b.x - x) > 0) continue;
      if (Math.abs(b.x - a.x) < 1e-6) {
        lo = Math.min(lo, a.y, b.y); hi = Math.max(hi, a.y, b.y);
      } else {
        const y = a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
        lo = Math.min(lo, y); hi = Math.max(hi, y);
      }
    }
    return lo <= hi ? { lo, hi } : null;
  }

  /** Half-width at this x, with the corners rounded off in plan. */
  planW(x: number): number {
    const { halfW, cornerF: f, cornerR: r } = this.spec;
    let w = halfW;
    const dF = x - (this.maxX - f);
    if (dF > 0) w = Math.min(w, halfW - f + Math.sqrt(Math.max(0, f * f - dF * dF)));
    const dR = this.minX + r - x;
    if (dR > 0) w = Math.min(w, halfW - r + Math.sqrt(Math.max(0, r * r - dR * dR)));
    return w;
  }

  private bump(x: number): number {
    const { flare, wells, wellR } = this.spec;
    if (flare <= 0) return 0;
    let b = 0;
    for (const w of wells) {
      const t = (x - w) / (wellR * 1.35);
      b = Math.max(b, Math.exp(-t * t * t * t));
    }
    return flare * b;
  }

  private section(x: number): Section | null {
    const s = this.span(x);
    if (!s) return null;
    const H = s.hi - s.lo;
    const ys = Math.min(Math.max(this.spec.shoulder, s.lo + 0.3 * H), s.hi - 0.25 * H);
    return { yb: s.lo, yt: s.hi, ys, W: this.planW(x) };
  }

  private point(s: Section, x: number, theta: number): V3 {
    const c = Math.cos(theta), sn = Math.sin(theta);
    const up = sn >= 0;
    const p = up ? this.spec.topExp : this.spec.lowExp;
    const zf = Math.sign(c || 1) * Math.pow(Math.abs(c), 2 / p);
    const yf = Math.sign(sn || 1) * Math.pow(Math.abs(sn), 2 / p);
    const swell = 1 + this.bump(x) * (up ? (1 - yf) * (1 - yf) : 1);
    const h = up ? s.yt - s.ys : s.ys - s.yb;
    return new THREE.Vector3(x, s.ys + h * yf, s.W * zf * swell);
  }

  /** How far out the side is at (x, y), for bolting things flush onto it. */
  sideZ(x: number, y: number): number {
    const s = this.section(x);
    if (!s) return this.spec.halfW;
    const { topExp, lowExp } = this.spec;
    if (y >= s.ys) {
      const t = Math.min(1, (y - s.ys) / Math.max(1e-4, s.yt - s.ys));
      const zf = Math.pow(Math.max(0, 1 - Math.pow(t, topExp)), 1 / topExp);
      return s.W * zf * (1 + this.bump(x) * (1 - t) * (1 - t));
    }
    const t = Math.min(1, (s.ys - y) / Math.max(1e-4, s.ys - s.yb));
    return s.W * Math.pow(Math.max(0, 1 - Math.pow(t, lowExp)), 1 / lowExp) * (1 + this.bump(x));
  }

  /** Height of the top surface at (x, z). */
  topY(x: number, z: number): number {
    const s = this.section(x);
    if (!s) return 0;
    const e = this.spec.topExp;
    const zf = Math.min(1, Math.abs(z) / s.W);
    return s.ys + (s.yt - s.ys) * Math.pow(Math.max(0, 1 - Math.pow(zf, e)), 1 / e);
  }

  // MARK: Mesh

  private buildGrid() {
    const { cornerF, cornerR } = this.spec;
    const { minX, maxX, N } = this;
    let cand: number[] = [];
    for (let x = minX; x < maxX; x += 0.035) cand.push(x);
    cand.push(maxX);
    cand.push(...this.poly.map((p) => p.x));
    for (let k = 0; k <= 14; k++) {
      const s = Math.sin((k / 14) * Math.PI / 2);
      cand.push(maxX - cornerF + cornerF * s, minX + cornerR - cornerR * s);
    }
    cand = cand.filter((c) => c >= minX && c <= maxX).sort((a, b) => a - b);
    const picked: number[] = [];
    for (const c of cand) if (!picked.length || c - picked[picked.length - 1] > 0.003) picked.push(c);
    if (picked[picked.length - 1] < maxX) picked[picked.length - 1] = maxX;

    for (const x of picked) {
      const s = this.section(x);
      if (!s) continue;
      const ring: V3[] = [];
      for (let j = 0; j <= N; j++) ring.push(this.point(s, x, -Math.PI / 2 + (2 * Math.PI * j) / N));
      this.grid.push(ring);
    }
    const G = this.grid, S = G.length;
    this.norms = G.map((_, i) => {
      const out: V3[] = [];
      for (let j = 0; j <= N; j++) {
        const ip = Math.min(i + 1, S - 1), im = Math.max(i - 1, 0);
        const jp = j === N ? 1 : j + 1, jm = j === 0 ? N - 1 : j - 1;
        const dX = G[ip][j].clone().sub(G[im][j]);
        const dT = G[i][jp].clone().sub(G[i][jm]);
        const n = new THREE.Vector3().crossVectors(dX, dT);
        if (n.length() > 1e-9) { out.push(n.normalize()); continue; }
        const p = G[i][j];
        const r = new THREE.Vector3(0, p.y - (G[i][0].y + G[i][N / 2].y) / 2, p.z);
        out.push(r.length() > 1e-6 ? r.normalize() : new THREE.Vector3(i === 0 ? -1 : 1, 0, 0));
      }
      return out;
    });
  }

  private buildGeometry(): THREE.BufferGeometry {
    const { grid, norms, N } = this;
    const pos: number[] = [], nor: number[] = [];
    for (let i = 0; i < grid.length; i++) {
      for (let j = 0; j <= N; j++) {
        const p = grid[i][j], n = norms[i][j];
        pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z);
      }
    }
    const row = N + 1;
    const band = Math.floor(N * 0.085);
    const top: number[] = [], bottom: number[] = [];
    for (let i = 0; i < grid.length - 1; i++) {
      for (let j = 0; j < N; j++) {
        const a = i * row + j, b = (i + 1) * row + j, c = b + 1, d = a + 1;
        // SceneKit and Three agree on counter-clockwise front faces; this winding faces outward.
        const tri = [a, b, c, a, c, d];
        if (j < band || j >= N - band) bottom.push(...tri); else top.push(...tri);
      }
    }
    // End caps (flat faces at the very nose and tail).
    for (const [i, dir] of [[grid.length - 1, 1], [0, -1]] as const) {
      const ring = grid[i];
      const c = new THREE.Vector3();
      for (let j = 0; j < N; j++) c.add(ring[j]);
      c.divideScalar(N);
      const base = pos.length / 3;
      pos.push(c.x, c.y, c.z); nor.push(dir, 0, 0);
      for (let j = 0; j <= N; j++) { const p = ring[j]; pos.push(p.x, p.y, p.z); nor.push(dir, 0, 0); }
      for (let j = 0; j < N; j++) {
        const p0 = base + 1 + j, p1 = p0 + 1;
        top.push(...(dir > 0 ? [base, p1, p0] : [base, p0, p1]));
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setIndex([...top, ...bottom]);
    g.addGroup(0, top.length, 0);
    g.addGroup(top.length, bottom.length, 1);
    return g;
  }

  /**
   * A thin skin over both flat-ish sides carrying a picture (stickers, door seams).
   * `right` is for the +Z side and `left` for the -Z side (already mirrored); both map onto
   * `rect` in car XY.
   */
  decal(right: THREE.Texture, left: THREE.Texture, rect: { minX: number; maxX: number; minY: number; maxY: number },
    offset: number, order: number, make: (map: THREE.Texture) => THREE.Material): THREE.Group {
    const root = new THREE.Group();
    const { grid, norms, N } = this;
    const w = rect.maxX - rect.minX, h = rect.maxY - rect.minY;
    for (const [side, map] of [[1, right], [-1, left]] as const) {
      const j0 = side > 0 ? 0 : N / 2, j1 = side > 0 ? N / 2 : N;
      const pos: number[] = [], nor: number[] = [], uv: number[] = [];
      const index: number[][] = grid.map(() => new Array(N + 1).fill(-1));
      for (let i = 0; i < grid.length; i++) {
        for (let j = j0; j <= j1; j++) {
          const n = norms[i][j];
          if (n.z * side <= 0.3) continue;
          const p = grid[i][j].clone().addScaledVector(n, offset);
          index[i][j] = pos.length / 3;
          pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z);
          const u = side > 0 ? (p.x - rect.minX) / w : (rect.maxX - p.x) / w;
          uv.push(u, (p.y - rect.minY) / h);
        }
      }
      const tris: number[] = [];
      for (let i = 0; i < grid.length - 1; i++) {
        for (let j = j0; j < j1; j++) {
          const q = [index[i][j], index[i + 1][j], index[i + 1][j + 1], index[i][j + 1]];
          if (q.includes(-1)) continue;
          tris.push(q[0], q[1], q[2], q[0], q[2], q[3]);
        }
      }
      if (!tris.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(tris);
      const m = new THREE.Mesh(g, make(map));
      m.renderOrder = order;
      m.receiveShadow = true;
      root.add(m);
    }
    return root;
  }
}
