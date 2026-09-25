// A bedside-monitor sweep: the new trace draws left to right and overwrites the
// previous sweep, with a small erase gap ahead of the bright head.
import { ecg, toPath } from "./ecg.js";
import { motionOn } from "./util.js";

let uid = 0;
const NS = "http://www.w3.org/2000/svg";
const mk = (tag, attrs) => { const el = document.createElementNS(NS, tag); for (const k in attrs) el.setAttribute(k, attrs[k]); return el; };

export function sweep(svg, { type = "sinus", bpm = 72, pxPerSec = 150, water = false, onBeat, amp } = {}) {
  const id = "sw" + ++uid;
  svg.replaceChildren();
  const defs = mk("defs", {});
  const clipNew = mk("clipPath", { id: id + "n" }), rNew = mk("rect", { x: 0, y: -50, width: 0, height: 1000 });
  const clipOld = mk("clipPath", { id: id + "o" }), rOld = mk("rect", { x: 0, y: -50, width: 0, height: 1000 });
  clipNew.append(rNew); clipOld.append(rOld); defs.append(clipNew, clipOld); svg.append(defs);
  const waterPath = water ? mk("path", { class: "water" }) : null;
  if (waterPath) svg.append(waterPath);
  const oldP = mk("path", { class: "line", "clip-path": `url(#${id}o)`, opacity: "0.45" });
  const newP = mk("path", { class: "line", "clip-path": `url(#${id}n)` });
  const head = mk("circle", { class: "head", r: 3.5 });
  svg.append(oldP, newP, head);

  let W = 0, H = 0, cur = null, prev = null, seed = 1, x = 0, last = 0, raf = 0, kind = type, peaksHit = 0, running = false;
  const build = () => ecg({ width: W, height: H, type: kind, bpm, pxPerSec, seed: seed++, amp: amp ?? 0.82 });

  function layout() {
    const r = svg.getBoundingClientRect();
    W = Math.max(40, Math.round(r.width)); H = Math.max(20, Math.round(r.height));
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    cur = build(); prev = build();
    newP.setAttribute("d", toPath(cur.points)); oldP.setAttribute("d", toPath(prev.points));
    if (!motionOn()) { rNew.setAttribute("width", W); rOld.setAttribute("width", 0); head.style.display = "none"; drawWater(0); }
  }
  function drawWater(t) {
    if (!waterPath) return;
    const base = H * 0.62 + H * 0.2;
    let d = "";
    for (let i = 0; i <= W; i += 8) d += (i ? "L" : "M") + i + " " + (base + 2.4 * Math.sin(i / 38 + t * 0.9) + 1.4 * Math.sin(i / 17 - t * 1.3)).toFixed(1);
    waterPath.setAttribute("d", d);
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    x += dt * pxPerSec;
    if (x >= W) { x = 0; prev = cur; cur = build(); oldP.setAttribute("d", newP.getAttribute("d")); newP.setAttribute("d", toPath(cur.points)); peaksHit = 0; }
    rNew.setAttribute("width", x);
    rOld.setAttribute("x", x + 22); rOld.setAttribute("width", Math.max(0, W - x - 22));
    const pts = cur.points, i = Math.min(pts.length - 1, Math.round(x / 2));
    head.setAttribute("cx", x); head.setAttribute("cy", pts[i][1]);
    while (peaksHit < cur.peaks.length && cur.peaks[peaksHit] <= x) { peaksHit++; onBeat?.(); }
    drawWater(now / 1000);
  }
  const start = () => { if (running || !motionOn()) return; running = true; last = 0; raf = requestAnimationFrame(frame); };
  const stop = () => { running = false; cancelAnimationFrame(raf); };
  layout();
  start();
  let rt;
  const ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { const w = W; layout(); if (w !== W) x = Math.min(x, W); }, 150); });
  ro.observe(svg);
  // Pause when off screen to save battery.
  const io = new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()));
  io.observe(svg);
  return {
    setType(t) { if (t === kind) return; kind = t; cur = build(); newP.setAttribute("d", toPath(cur.points)); if (!motionOn()) layout(); },
    destroy() { stop(); ro.disconnect(); io.disconnect(); },
  };
}
