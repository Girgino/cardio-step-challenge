// The coronary tree drawing used by the journey, TV mode and the quiz.
import { HEART } from "./content.js";

const NS = "http://www.w3.org/2000/svg";
const mk = (tag, attrs = {}) => { const el = document.createElementNS(NS, tag); for (const k in attrs) el.setAttribute(k, attrs[k]); return el; };

// Label positions (end of each segment, nudged so text stays clear of the vessels).
const LABEL_AT = { LM: [214, 136, "start"], LAD: [262, 318, "end"], D1: [314, 236, "start"], D2: [318, 326, "start"],
  LCx: [346, 222, "start"], OM: [340, 282, "start"], RCA: [120, 350, "end"], AM: [98, 312, "end"], PDA: [236, 400, "middle"] };

export function heartSvg({ labels = true, hit = false } = {}) {
  const svg = mk("svg", { viewBox: "40 10 340 420", role: "img", "aria-label": "Coronary arteries" });
  svg.append(mk("path", { class: "outline", d: HEART.outline + "Z" }), mk("path", { class: "aorta", d: HEART.aorta }));
  const segs = HEART.segments.map((s) => {
    const bg = mk("path", { class: "seg-bg", d: s.d });
    const fg = mk("path", { class: "seg-fg", d: s.d });
    svg.append(bg, fg);
    return { ...s, bg, fg, len: 0 };
  });
  const tip = mk("circle", { class: "tip", r: 5, cx: 206, cy: 114 });
  svg.append(tip);
  const lbls = {};
  if (labels) for (const s of segs) {
    const [x, y, anchor] = LABEL_AT[s.key];
    const t = mk("text", { class: "lbl", x, y, "text-anchor": anchor }); t.textContent = s.key;
    svg.append(t); lbls[s.key] = t;
  }
  const hits = {};
  if (hit) for (const s of segs) { const p = mk("path", { class: "hit", d: s.d, "data-key": s.key }); svg.append(p); hits[s.key] = p; }

  let total = 0;
  const measure = () => {
    total = 0;
    for (const s of segs) {
      s.len = s.fg.getTotalLength();
      s.fg.style.strokeDasharray = `${s.len} ${s.len}`;
      s.fg.style.strokeDashoffset = s.len;
      total += s.len;
    }
  };

  // Fill the tree to fraction f (0..1). Returns the segment we're in and steps-left info.
  function set(f) {
    if (!total) measure();
    f = Math.max(0, Math.min(1, f));
    let left = f * total, current = segs[0], within = 0;
    for (const s of segs) {
      const take = Math.max(0, Math.min(s.len, left));
      s.fg.style.strokeDashoffset = s.len - take;
      lbls[s.key]?.classList.toggle("on", take > 0);
      if (left > 0 && left <= s.len) { current = s; within = take / s.len; }
      left -= s.len;
    }
    if (f >= 1) { current = segs[segs.length - 1]; within = 1; }
    const p = current.fg.getPointAtLength(current.len * within || 0.01);
    tip.setAttribute("cx", p.x); tip.setAttribute("cy", p.y);
    tip.style.opacity = f > 0 && f < 1 ? 1 : 0;
    return { current, within, index: segs.indexOf(current) };
  }

  // Fraction of the goal at which each segment starts.
  function starts() {
    if (!total) measure();
    let acc = 0;
    return segs.map((s) => { const st = acc / total; acc += s.len; return { key: s.key, name: s.name, start: st }; });
  }

  return { svg, set, starts, segs, hits, measure };
}
