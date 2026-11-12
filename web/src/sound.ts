// Every sound is synthesized at start-up (same recipes as the native app), so there are no audio
// files to download. Browsers only allow sound after the first touch, so `unlock` must be called
// from a touch handler.

export type Effect = 'pop' | 'click' | 'honk' | 'vroom' | 'sparkle' | 'boing' | 'clunk' | 'bubbles' | 'brush' | 'spray' | 'whee' | 'splat' | 'siren' | 'motor' | 'baa' | 'door';

const SR = 44100;
const TAU = Math.PI * 2;
let ctx: AudioContext | null = null;
let out: GainNode | null = null;
const buffers = new Map<Effect, AudioBuffer>();

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return (s / 4294967295) * 2 - 1; };
}

function make(seconds: number, fill: (d: Float32Array, n: number) => void): AudioBuffer {
  const n = Math.floor(seconds * SR);
  const b = ctx!.createBuffer(1, n, SR);
  fill(b.getChannelData(0), n);
  return b;
}

const recipes: Record<Effect, () => AudioBuffer> = {
  pop: () => make(0.16, (d, n) => {
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR, f = 320 * Math.pow(3.5, t / 0.16);
      ph += (TAU * f) / SR;
      d[i] = Math.sin(ph) * Math.min(1, t / 0.004) * Math.exp(-t * 26) * 0.6;
    }
  }),
  click: () => make(0.06, (d, n) => {
    for (let i = 0; i < n; i++) { const t = i / SR; d[i] = Math.sin(TAU * 1400 * t) * Math.exp(-t * 80) * 0.4; }
  }),
  sparkle: () => make(0.75, (d, n) => {
    const notes = [[0, 1046.5], [0.07, 1318.5], [0.14, 1568], [0.21, 2093]];
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      let s = 0;
      for (const [t0, f] of notes) if (t >= t0) {
        const dt = t - t0;
        s += (Math.sin(TAU * f * dt) + 0.3 * Math.sin(TAU * f * 2 * dt)) * Math.exp(-dt * 9) * Math.min(1, dt / 0.003);
      }
      d[i] = s * 0.22;
    }
  }),
  boing: () => make(0.45, (d, n) => {
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR, f = 260 * (1 + 0.55 * Math.sin(TAU * 11 * t) * Math.exp(-t * 5)) * (1 - 0.3 * t);
      ph += (TAU * f) / SR;
      d[i] = Math.sin(ph) * Math.exp(-t * 6) * Math.min(1, t / 0.005) * 0.55;
    }
  }),
  clunk: () => make(0.35, (d, n) => {
    let ph = 0;
    const noise = lcg(12345);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      ph += (TAU * 140 * Math.exp(-t * 3)) / SR;
      d[i] = (Math.sin(ph) * Math.exp(-t * 14) + noise() * Math.exp(-t * 60) * 0.5) * 0.7;
    }
  }),
  honk: () => make(0.62, (d, n) => {
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      // "beep-beeeep"
      let on = 0;
      if (t < 0.17) on = Math.min(1, t / 0.01) * Math.min(1, (0.17 - t) / 0.02);
      else if (t > 0.24 && t < 0.6) on = Math.min(1, (t - 0.24) / 0.01) * Math.min(1, (0.6 - t) / 0.04);
      const raw = Math.sin(TAU * 392 * t) + 0.8 * Math.sin(TAU * 494 * t) + 0.3 * Math.sin(TAU * 784 * t);
      d[i] = Math.tanh(raw * 2.2) * on * 0.32;
    }
  }),
  // Car wash: lots of little bubble blips.
  bubbles: () => make(1.9, (d, n) => {
    const r = lcg(4242);
    const pops: [number, number][] = [];
    for (let k = 0; k < 34; k++) pops.push([((r() + 1) / 2) * 1.75, 500 + ((r() + 1) / 2) * 900]);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      let s = 0;
      for (const [t0, f] of pops) {
        const dt = t - t0;
        if (dt < 0 || dt > 0.09) continue;
        s += Math.sin(TAU * f * dt * (1 + dt * 18)) * Math.exp(-dt * 45) * Math.min(1, dt / 0.002);
      }
      d[i] = Math.tanh(s * 0.9) * 0.35 * Math.min(1, (1.9 - t) / 0.2);
    }
  }),
  // Spinning brushes: soft swishing noise that pulses with each turn.
  brush: () => make(1.8, (d, n) => {
    const noise = lcg(77);
    let y = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      y += 0.08 * (noise() - y);
      const pulse = 0.55 + 0.45 * Math.sin(TAU * 6 * t);
      d[i] = y * 2.6 * pulse * Math.min(1, t / 0.15) * Math.min(1, (1.8 - t) / 0.25);
    }
  }),
  // Rinse: a hissy spray of water.
  spray: () => make(1.6, (d, n) => {
    const noise = lcg(31337);
    let lo = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const x = noise();
      lo += 0.3 * (x - lo);
      d[i] = (x - lo) * 0.32 * Math.min(1, t / 0.08) * Math.min(1, (1.6 - t) / 0.3);
    }
  }),
  // Off the ramp: a slide whistle swooping up and back down.
  whee: () => make(0.9, (d, n) => {
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const sweep = t < 0.45 ? t / 0.45 : 1 - (t - 0.45) / 0.45 * 0.7;
      const f = (520 + 900 * sweep) * (1 + 0.025 * Math.sin(TAU * 7 * t));
      ph += (TAU * f) / SR;
      d[i] = (Math.sin(ph) + 0.15 * Math.sin(2 * ph)) * 0.32 * Math.min(1, t / 0.03) * Math.min(1, (0.9 - t) / 0.12);
    }
  }),
  // Mud: a few wet squelchy splats.
  splat: () => make(0.7, (d, n) => {
    const noise = lcg(555);
    const hits = [0, 0.11, 0.2, 0.34];
    let lo = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      lo += 0.12 * (noise() - lo);
      let s = 0;
      for (const [k, t0] of hits.entries()) {
        const dt = t - t0;
        if (dt < 0) continue;
        const env = Math.exp(-dt * 22) * Math.min(1, dt / 0.003);
        s += (lo * 3 + Math.sin(TAU * (90 + 25 * k) * dt * (1 - dt * 2))) * env * (1 - k * 0.15);
      }
      d[i] = Math.tanh(s * 1.4) * 0.45;
    }
  }),
  // Fire truck / police: "nee-naw nee-naw".
  siren: () => make(1.7, (d, n) => {
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const step = Math.floor(t / 0.4), within = (t % 0.4) / 0.4;
      const target = step % 2 === 0 ? 960 : 720, prev = step % 2 === 0 ? 720 : 960;
      const f = step === 0 ? target : prev + (target - prev) * Math.min(1, within / 0.12);
      ph += f / SR;
      const sq = Math.tanh(Math.sin(TAU * ph) * 3);
      d[i] = (sq * 0.7 + 0.3 * Math.sin(TAU * ph * 2)) * 0.24 * Math.min(1, t / 0.02) * Math.min(1, (1.7 - t) / 0.12);
    }
  }),
  // Out for a drive: one second of steady engine that loops seamlessly (whole cycles only).
  motor: () => make(1, (d, n) => {
    let y = 0;
    const noise = lcg(4321);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const ph = 120 * t + 0.02 * Math.sin(TAU * 2 * t), sub = 60 * t;
      const x = (2 * (ph - Math.floor(ph)) - 1) * 0.5 + (2 * (sub - Math.floor(sub)) - 1) * 0.4 + noise() * 0.1;
      y += 0.22 * (x - y);
      d[i] = Math.tanh(y * 1.8) * 0.42;
    }
  }),
  // A sheep saying hello.
  baa: () => make(0.75, (d, n) => {
    let ph = 0, y = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const f = (330 + 50 * Math.min(1, t / 0.08) - 60 * t) * (1 + 0.035 * Math.sin(TAU * 26 * t));
      ph += f / SR;
      const saw = 2 * (ph - Math.floor(ph)) - 1;
      y += 0.18 * (saw - y);
      const env = Math.min(1, t / 0.04) * Math.min(1, (0.75 - t) / 0.25);
      d[i] = (y * 1.4 + 0.25 * Math.sin(TAU * 3 * ph)) * env * 0.4;
    }
  }),
  // The roll-up door rattling open.
  door: () => make(1.0, (d, n) => {
    const noise = lcg(99);
    let lo = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      lo += 0.05 * (noise() - lo);
      const rattle = 0.5 + 0.5 * Math.sign(Math.sin(TAU * 22 * t));
      d[i] = (lo * 4 * rattle + Math.sin(TAU * 70 * t) * 0.15) * Math.min(1, t / 0.05) * Math.min(1, (1 - t) / 0.2) * 0.5;
    }
  }),
  vroom: () => make(4.7, (d, n) => {
    let ph = 0, sub = 0, y = 0;
    const noise = lcg(987);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      let f: number;
      if (t < 0.3) f = 55 + 150 * (t / 0.3); // rev
      else if (t < 0.5) f = 205 - 80 * ((t - 0.3) / 0.2); // clutch
      else if (t < 1.3) f = 125 + 110 * ((t - 0.5) / 0.8); // go!
      else if (t < 3.7) f = 235 + 14 * Math.sin(TAU * 1.3 * t); // cruising the lap
      else f = 235 - 165 * Math.min(1, (t - 3.7) / 0.9); // slow down
      ph += f / SR; sub += (f * 0.5) / SR;
      const x = (2 * (ph - Math.floor(ph)) - 1) * 0.5 + (2 * (sub - Math.floor(sub)) - 1) * 0.4 + noise() * 0.12;
      y += 0.22 * (x - y);
      const env = Math.min(1, t / 0.04) * (t > 4.2 ? Math.max(0, (4.7 - t) / 0.5) : 1);
      d[i] = Math.tanh(y * 1.8) * env * 0.5;
    }
  }),
};

/** Call from a touch: creates the audio context (browsers require a gesture) and wakes it after backgrounding. */
export function unlock() {
  if (!ctx) {
    ctx = new AudioContext({ sampleRate: SR });
    out = ctx.createGain();
    out.gain.value = 0.85;
    out.connect(ctx.destination);
  }
  if (ctx.state !== 'running') ctx.resume();
}

function source(e: Effect): AudioBufferSourceNode | null {
  if (!ctx || !out) return null;
  let b = buffers.get(e);
  if (!b) { b = recipes[e](); buffers.set(e, b); }
  const src = ctx.createBufferSource();
  src.buffer = b;
  return src;
}

export function play(e: Effect) {
  const src = source(e);
  if (!src) return;
  src.connect(out!);
  src.start();
}

/** Play a sound on repeat. `rate` bends its pitch (engine speed); `stop` fades it out. */
export function loop(e: Effect) {
  const src = source(e);
  if (!src || !ctx) return { rate: (_: number) => {}, stop: () => {} };
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.gain.setTargetAtTime(1, ctx.currentTime, 0.08);
  src.loop = true;
  src.connect(gain).connect(out!);
  src.start();
  return {
    rate: (r: number) => src.playbackRate.setTargetAtTime(r, ctx!.currentTime, 0.1),
    stop: () => { gain.gain.setTargetAtTime(0, ctx!.currentTime, 0.15); src.stop(ctx!.currentTime + 1); },
  };
}
