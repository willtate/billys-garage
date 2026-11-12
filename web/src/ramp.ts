import * as THREE from 'three';
import { canvas } from './geom';

/** Jump ramp for the GO lap: a wedge with a yellow-and-black chevron deck. Rises along +X. */
export const RAMP_LEN = 2.0, RAMP_H = 0.55, RAMP_W = 1.7;

const deckMat = (() => {
  const t = new THREE.CanvasTexture(canvas(128, 128, (c) => {
    c.fillStyle = '#ffcc00'; c.fillRect(0, 0, 128, 128);
    c.fillStyle = '#141414';
    for (let i = -1; i < 3; i++) {
      // Chevrons pointing up the ramp (+u).
      const x = i * 48 + 10;
      c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 26, 64); c.lineTo(x, 128); c.lineTo(x + 18, 128); c.lineTo(x + 44, 64); c.lineTo(x + 18, 0); c.fill();
    }
  }));
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1.5, 1.5);
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, side: THREE.DoubleSide });
})();
const sideMat = new THREE.MeshStandardMaterial({ color: 0xe0321c, roughness: 0.5, side: THREE.DoubleSide });

export function makeRamp(): THREE.Group {
  const L = RAMP_LEN, H = RAMP_H, W = RAMP_W / 2;
  // Wedge as a triangle extruded across the track: sides red, sloped deck chevroned.
  const g = new THREE.BufferGeometry();
  const P = [
    [0, 0, -W], [L, 0, -W], [L, H, -W], // side -Z
    [0, 0, W], [L, H, W], [L, 0, W], // side +Z
    [0, 0, -W], [0, 0, W], [L, H, W], [0, 0, -W], [L, H, W], [L, H, -W], // deck
    [L, 0, -W], [L, H, W], [L, 0, W], [L, 0, -W], [L, H, -W], [L, H, W], // back face
  ];
  const deckU = (x: number) => x / L, deckV = (z: number) => (z + W) / (2 * W);
  g.setAttribute('position', new THREE.Float32BufferAttribute(P.flat(), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(P.flatMap(([x, , z]) => [deckU(x), deckV(z)]), 2));
  g.addGroup(0, 6, 1); g.addGroup(6, 6, 0); g.addGroup(12, 6, 1);
  g.computeVertexNormals();
  const ramp = new THREE.Mesh(g, [deckMat, sideMat]);
  const root = new THREE.Group();
  root.add(ramp);
  // Little lip at the top so it reads as a jump.
  const lip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, RAMP_W), sideMat);
  lip.position.set(L - 0.04, H + 0.03, 0);
  root.add(lip);
  return root;
}
