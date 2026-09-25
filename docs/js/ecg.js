// ECG trace generator. Each beat is a sum of Gaussian waves (P, Q, R, S, T).
// Used by the hero monitor, the scroll progress trace, rank blips and the trivia strips.
import { rng } from "./demo.js";

const g = (t, mu, s, a) => a * Math.exp(-((t - mu) ** 2) / (2 * s * s));

const WAVES = {
  normal: [[-0.2, 0.025, 0.12], [-0.03, 0.01, -0.12], [0, 0.012, 1], [0.03, 0.012, -0.25], [0.26, 0.05, 0.28]],
  noP: [[-0.03, 0.01, -0.1], [0, 0.012, 1], [0.03, 0.012, -0.25], [0.24, 0.05, 0.26]],
  flutter: [[-0.02, 0.01, -0.08], [0, 0.012, 0.95], [0.03, 0.012, -0.22]],
  wide: [[0, 0.055, 0.95], [0.12, 0.06, -0.75]],
  stemi: [[-0.2, 0.025, 0.12], [-0.03, 0.01, -0.12], [0, 0.012, 1], [0.03, 0.012, -0.1], [0.12, 0.07, 0.36], [0.26, 0.055, 0.38]],
};

// Returns {points: [[x, y]...], peaks: [x...]} for a strip `width` px wide.
export function ecg({ width, height, type = "sinus", bpm = 72, pxPerSec = 110, seed = 7, amp = 0.82, step = 2, lead = 0.35 }) {
  const r = rng(seed);
  const dur = width / pxPerSec;
  const beats = [];
  let t = lead;
  const rr = () => {
    switch (type) {
      case "afib": return 0.42 + r() * 0.62;
      case "flutter": return 0.4;
      case "vt": return 0.36;
      case "brady": return 60 / 44;
      case "tachy": return 60 / 128 + (r() - 0.5) * 0.02;
      case "flat": return 99;
      default: return (60 / bpm) * (1 + (r() - 0.5) * 0.05);
    }
  };
  while (t < dur + 1) { beats.push(t); t += rr(); }
  const shape = type === "afib" ? WAVES.noP : type === "flutter" ? WAVES.flutter : type === "vt" ? WAVES.wide
    : type === "stemi" ? WAVES.stemi : WAVES.normal;
  const fibPhase = [r() * 6, r() * 6, r() * 6];
  const base = height * 0.62;
  const points = [];
  for (let x = 0; x <= width; x += step) {
    const tt = x / pxPerSec;
    let v = 0;
    if (type !== "flat") {
      for (const b of beats) {
        const d = tt - b;
        if (d < -0.4 || d > 0.6) continue;
        for (const [mu, s, a] of shape) v += g(d, mu, s, a);
      }
    }
    if (type === "afib") v += 0.035 * Math.sin(tt * 41 + fibPhase[0]) + 0.025 * Math.sin(tt * 57 + fibPhase[1]) + 0.02 * Math.sin(tt * 29 + fibPhase[2]);
    if (type === "flutter") { const ph = (tt % 0.2) / 0.2; v += 0.16 * (ph < 0.8 ? -ph / 0.8 : (ph - 1) / 0.2 + 0) + 0.08; }
    if (type === "flat") v += 0.006 * Math.sin(tt * 30 + fibPhase[0]);
    points.push([x, base - v * amp * height * 0.58]);
  }
  return { points, peaks: beats.map((b) => b * pxPerSec).filter((x) => x <= width) };
}

export const toPath = (pts) => "M" + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L");

// A tiny rank-change glyph: up = QRS spike, down = inverted dip, same = flat line.
export function blip(dir) {
  const d = dir > 0 ? "M1 9H6L8 11L10.5 2L13 13L15 9H23" : dir < 0 ? "M1 5H6L8 3L10.5 12L13 1L15 5H23" : "M1 7H23";
  return `<svg class="blip ${dir > 0 ? "up" : dir < 0 ? "down" : "same"}" viewBox="0 0 24 14" aria-hidden="true"><path d="${d}"/></svg>`;
}
