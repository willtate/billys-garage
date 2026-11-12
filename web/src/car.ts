import * as THREE from 'three';
import { box, canvas, tracePath } from './geom';
import { BodyBuild, BodyStyle, makeDriver, stripes } from './bodies';
import { CarMaterials } from './materials';
import { WheelStyle } from './wheels';

export interface Design { body: string; wheels: string; paint: string; sticker: string }

export interface BuiltCar {
  root: THREE.Group;
  body: THREE.Group;
  spinners: THREE.Object3D[];
  driver: THREE.Group;
}

/** Soft dark patch under the car so it looks planted on the floor. */
const contactShadow = (() => {
  const w = 256, h = 128;
  const el = canvas(w, h, (c) => {
    const img = c.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = Math.abs((x / (w - 1)) * 2 - 1), v = Math.abs((y / (h - 1)) * 2 - 1);
      const d = Math.pow(u ** 4 + v ** 4, 0.25);
      const t = Math.max(0, Math.min(1, (d - 0.35) / 0.65));
      // alphaMap reads the green channel.
      const a = 255 * 0.85 * (1 - t * t * (3 - 2 * t)), i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = a;
      img.data[i + 3] = 255;
    }
    c.putImageData(img, 0, 0);
  });
  return new THREE.CanvasTexture(el);
})();

export function buildCar(design: Design, body: BodyStyle, wheel: WheelStyle, m: CarMaterials): BuiltCar {
  // Wheels are sized relative to the body, then scaled by the wheel style.
  const radius = body.wheelRadius * wheel.scale;
  const width = body.wheelWidth * wheel.widthScale;
  const lift = radius - body.wheelRadius; // bigger wheels raise the whole body

  const root = new THREE.Group();
  root.name = 'car';
  const shell = body.build(m, radius);
  const bodyNode = shell.node;
  bodyNode.position.y += lift;
  bodyNode.userData.baseY = bodyNode.position.y;
  root.add(bodyNode);
  if (design.sticker === 'stripes') bodyNode.add(...stripes(shell, m), sideStripes(shell, m));

  const driver = makeDriver(m);
  driver.position.set(...body.seat);
  driver.scale.setScalar(body.driverScale);
  bodyNode.add(driver);

  const spinners: THREE.Object3D[] = [];
  const halfTrack = body.track / 2 + (width - body.wheelWidth) / 2;
  for (const x of [body.wheelbase / 2, -body.wheelbase / 2]) {
    for (const side of [1, -1]) {
      const mount = new THREE.Group();
      mount.position.set(x, radius, side * halfTrack);
      if (side < 0) mount.rotation.y = Math.PI; // hub faces outward on both sides
      const spinner = new THREE.Group();
      const shape = wheel.build(m, radius, width);
      shape.rotation.x = Math.PI / 2; // axle along +Z, hub face outward
      spinner.add(shape);
      mount.add(spinner);
      if (wheel.id !== 'offroad') {
        // Brake caliper: fixed to the hub, so it doesn't spin with the wheel.
        mount.add(box(m.caliper, radius * 0.32, radius * 0.16, width * 0.16, radius * 0.05, [0, radius * 0.4, width * 0.12]));
      }
      root.add(mount);
      spinners.push(spinner);
    }
  }

  const len = body.wheelbase + radius * 2 + 0.9;
  const wid = halfTrack * 2 + width + 0.5;
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(len, wid),
    new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: contactShadow, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.008;
  shadow.renderOrder = -1;
  root.add(shadow);

  return { root, body: bodyNode, spinners, driver };
}

/** Twin pinstripes along both flanks, drawn white and tinted with the stripe colour. */
function sideStripes(shell: BodyBuild, m: CarMaterials): THREE.Object3D {
  const b = shell.panel.bounds();
  const scale = 220, L = b.width, H = b.height;
  const draw = (mirror: boolean) => {
    const el = canvas(Math.round(L * scale), Math.round(H * scale), (c, W, Hh) => {
      if (mirror) { c.translate(W, 0); c.scale(-1, 1); }
      c.translate(0, Hh); c.scale(scale, -scale); c.translate(-b.minX, -b.minY);
      tracePath(c, shell.panel); c.clip();
      c.fillStyle = '#fff';
      c.fillRect(b.minX, b.minY + H * 0.3, L, H * 0.09);
      c.fillRect(b.minX, b.minY + H * 0.44, L, H * 0.04);
      // Wipe a band along the outline where the rounded edge curves away.
      c.globalCompositeOperation = 'destination-out';
      tracePath(c, shell.panel);
      c.lineWidth = 0.11 * 2 + 0.03; c.lineJoin = 'round'; c.stroke();
    });
    const t = new THREE.CanvasTexture(el);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };
  return shell.loft.decal(draw(false), draw(true), b, 0.006, 5, (map) => {
    const mat = new THREE.MeshPhysicalMaterial({ map, transparent: true, depthWrite: false, roughness: 0.3, clearcoat: 1,
      clearcoatRoughness: 0.04, polygonOffset: true, polygonOffsetFactor: -4 });
    mat.color = m.stripe.color; // shared, so a paint change recolours it
    return mat;
  });
}
