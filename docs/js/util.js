// Small DOM and formatting helpers shared by the page and TV mode.

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export const fmt = (n, dec = 0) =>
  (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
export const compact = (n) => {
  n = Number(n) || 0;
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 1 : 2).replace(/\.?0+$/, "") + "M";
  if (n >= 1e4) return Math.round(n / 1e3) + "k";
  return fmt(n);
};
export const km = (m) => (Number(m) || 0) / 1000;
export const plural = (n, one, many = one + "s") => `${fmt(n)} ${n === 1 ? one : many}`;

export const motionOn = () => document.documentElement.classList.contains("js-motion");

// Element builder: h("div", {class: "x", text: "hi", onclick}, child, ...)
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElementNS(tag.startsWith("svg:") ? "http://www.w3.org/2000/svg" : "http://www.w3.org/1999/xhtml",
    tag.replace("svg:", ""));
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "text") el.textContent = v;
    else if (k === "html") el.innerHTML = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "dataset") Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : document.createTextNode(kid));
  return el;
}

// Only touch the DOM when text actually changes (keeps selection and animations intact).
export function setText(el, text) {
  if (el && el.textContent !== String(text)) el.textContent = text;
}

// Animated numbers. Elements start at 0 and count up once they are first seen
// (motion.js calls countIn). Later updates tween from the current value.
export function setNum(el, value, dec = Number(el?.dataset.dec || 0)) {
  if (!el) return;
  value = Number(value) || 0;
  const prev = Number(el.dataset.v ?? 0);
  el.dataset.v = value;
  const g = window.gsap;
  if (!motionOn() || !g) { el.textContent = fmt(value, dec); return; }
  if (!el.dataset.seen) { if (!el.textContent) el.textContent = fmt(0, dec); return; }
  if (prev === value) { el.textContent = fmt(value, dec); return; }
  const o = { v: prev };
  g.to(o, { v: value, duration: 1.1, ease: "power2.out", overwrite: true, onUpdate: () => (el.textContent = fmt(o.v, dec)) });
}
export function countIn(el) {
  if (el.dataset.seen) return;
  el.dataset.seen = "1";
  const dec = Number(el.dataset.dec || 0);
  const to = Number(el.dataset.v || 0);
  const g = window.gsap;
  if (!g || !motionOn()) { el.textContent = fmt(to, dec); return; }
  const o = { v: 0 };
  g.to(o, { v: to, duration: 1.6, ease: "power3.out", onUpdate: () => (el.textContent = fmt(o.v, dec)) });
}

export function initials(name = "") {
  const parts = name.replace(/[^\p{L}\p{N}\s_.-]/gu, "").split(/[\s_.-]+/).filter(Boolean);
  return ((parts[0]?.[0] || "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
export function avatar(p, cls = "avatar") {
  const ph = () => h("span", { class: cls, "aria-hidden": "true", text: initials(p?.name) });
  if (!p?.avatar) return ph();
  const img = h("img", { class: cls, src: p.avatar, alt: "", loading: "lazy", decoding: "async", referrerpolicy: "no-referrer" });
  img.addEventListener("error", () => img.replaceWith(ph()), { once: true });
  return img;
}

// Dates arrive as YYYY-MM-DD; format them without timezone drift.
const D = (iso) => new Date(iso + "T12:00:00Z");
export const fmtDay = (iso, opts = { weekday: "short", month: "short", day: "numeric" }) =>
  D(iso).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
export function fmtRange(a, b) {
  const A = D(a), B = D(b);
  const m = (x) => x.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  return A.getUTCMonth() === B.getUTCMonth() ? `${m(A)} ${A.getUTCDate()}–${B.getUTCDate()}` : `${m(A)} ${A.getUTCDate()} – ${m(B)} ${B.getUTCDate()}`;
}
export const localDay = (tz, at = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);

export const store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
