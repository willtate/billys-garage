import * as THREE from 'three';
import { box, canvas, mergeStatic } from './geom';
import { addons } from './addons';
import { anchor, BodyStyle, makeDriver, Slot, stripes } from './bodies';
import { makeSticker } from './stickers';
import { CarMaterials } from './materials';
import { WheelStyle } from './wheels';

export interface Design {
  body: string; wheels: string; paint: string; sticker: string;
  engine: string; front: string; roof: string; back: string;
}
export const slots: Slot[] = ['engine', 'front', 'roof', 'back'];

export interface BuiltCar {
  root: THREE.Group;
  body: THREE.Group;
  spinners: THREE.Object3D[];
  driver: THREE.Group;
  addons: Partial<Record<Slot, THREE.Object3D>>;
  /** Animated bits (police lights, beacon, rocket flames): call every frame. */
  tickers: ((now: number) => void)[];
  /** Where exhaust smoke comes out, in car space. */
  tailpipe: THREE.Vector3;
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
  if (design.sticker === 'stripes') bodyNode.add(...stripes(shell, m));
  const sticker = makeSticker(design.sticker, body.id, shell, m);
  if (sticker) bodyNode.add(sticker);

  const driver = makeDriver(m);
  driver.position.set(...body.seat);
  driver.scale.setScalar(body.driverScale);
  bodyNode.add(driver);

  // Everything on the body except the bobbing helmet becomes a few big meshes.
  mergeStatic(bodyNode, (o) => o.name === 'head');

  const fitted: BuiltCar['addons'] = {};
  const tickers: BuiltCar['tickers'] = [];
  for (const slot of slots) {
    const make = (addons[slot].find((a) => a.id === design[slot]) ?? addons[slot][0]).build;
    if (!make) continue;
    const n = make(m, body);
    const a = anchor(body, slot);
    n.position.set(a.x, a.y, 0);
    bodyNode.add(n);
    fitted[slot] = n;
    if (n.userData.tick) tickers.push(n.userData.tick);
  }

  const spinners: THREE.Object3D[] = [];
  const halfTrack = body.track / 2 + (width - body.wheelWidth) / 2;
  for (const x of [body.wheelbase / 2, -body.wheelbase / 2]) {
    for (const side of [1, -1]) {
      const mount = new THREE.Group();
      mount.position.set(x, radius, side * halfTrack);
      if (side < 0) mount.rotation.y = Math.PI; // hub faces outward on both sides
      const spinner = new THREE.Group();
      const shape = wheel.build(m, radius, width);
      mergeStatic(shape);
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

  const tailpipe = new THREE.Vector3(body.tail.x - 0.1, body.tail.y + lift, 0);
  return { root, body: bodyNode, spinners, driver, addons: fitted, tickers, tailpipe };
}
