// The weekly quiz. Page-only: answers are remembered on this phone and never affect the score.
import { QUIZ } from "./content.js";
import { h, fmt, store, motionOn } from "./util.js";
import { sweep } from "./monitor.js";
import { heartSvg } from "./heart.js";

export function renderQuiz(b, week, ctx) {
  const set = QUIZ[week % QUIZ.length];
  const key = `${ctx.ns || ""}quiz:${b.challenge.start_date}:${week}`;
  const saved = store.get(key, {});
  let i = Math.min(set.length - 1, Object.keys(saved).length < set.length ? firstOpen(set, saved) : 0);
  let strip = null;

  const card = h("div", { class: "screen quiz wide", "data-reveal": "" });
  const dots = h("div", { class: "dots", role: "tablist" });
  const body = h("div", { class: "qbody" });
  const nav = h("div", { class: "nav" });
  card.append(
    h("div", { class: "top" }, h("div", { class: "kicker", html: `<b>Rounds quiz</b> · week ${week + 1}` }), dots),
    body, nav);

  function firstOpen(s, sv) { for (let k = 0; k < s.length; k++) if (!(k in sv)) return k; return 0; }
  const score = () => set.reduce((a, q, k) => a + (k in saved && isRight(q, saved[k]) ? 1 : 0), 0);
  function isRight(q, v) {
    if (q.type === "guess") return Math.abs(v - q.answer) <= Math.max(q.step, Math.abs(q.answer) * 0.15);
    if (q.type === "artery") return v === q.answer;
    if (q.type === "mythfact") return v === q.answer;
    return v === q.answer;
  }
  function answer(v) {
    saved[i] = v;
    store.set(key, saved);
    draw(true);
  }

  function draw(justAnswered = false) {
    strip?.destroy(); strip = null;
    const q = set[i];
    const done = i in saved;
    const v = saved[i];
    dots.replaceChildren(...set.map((qq, k) => h("button", {
      type: "button", "aria-label": `Question ${k + 1}`,
      class: (k === i ? "on " : "") + (k in saved ? (isRight(qq, saved[k]) ? "ok" : "no") : ""),
      onclick: () => { i = k; draw(); },
    })));
    const parts = [h("h3", { text: q.q })];

    if (q.type === "rhythm") {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("preserveAspectRatio", "none");
      parts.push(h("div", { class: "qstrip" }, svg));
      requestAnimationFrame(() => { strip = sweep(svg, { type: q.rhythm, pxPerSec: 130, amp: 0.9 }); });
    }
    if (q.type === "rhythm" || q.type === "choice") {
      parts.push(h("div", { class: "opts" }, ...q.options.map((o, k) => h("button", {
        type: "button", class: "opt" + (done ? (k === q.answer ? " right" : k === v ? " wrong" : "") : ""),
        disabled: done || null, onclick: () => answer(k), text: o,
      }))));
    }
    if (q.type === "mythfact") {
      parts.push(h("div", { class: "opts mf" }, ...[[false, "Myth"], [true, "Fact"]].map(([val, label]) => h("button", {
        type: "button", class: "opt" + (done ? (val === q.answer ? " right" : val === v ? " wrong" : "") : ""),
        disabled: done || null, onclick: () => answer(val), text: label,
      }))));
    }
    if (q.type === "guess") {
      const start = done ? v : snap((q.min + q.max) / 2, q);
      const out = h("output", {}, h("span", { text: fmt(start, q.step < 1 ? 1 : 0) }), h("small", { text: q.unit }));
      const range = h("input", { type: "range", min: q.min, max: q.max, step: q.step, value: start, "aria-label": q.q, disabled: done || null });
      range.addEventListener("input", () => (out.firstChild.textContent = fmt(range.value, q.step < 1 ? 1 : 0)));
      const g = h("div", { class: "guess" }, h("div", { class: "label", text: done ? "Your guess" : "Slide to guess" }), out, range);
      if (!done) g.append(h("button", { type: "button", class: "btn", style: "justify-self:start;min-height:44px", text: "Lock it in", onclick: () => answer(Number(range.value)) }));
      else {
        const ans = h("div", { class: "ans", text: fmt(justAnswered && motionOn() ? v : q.answer, q.step < 1 ? 1 : 0) });
        g.append(h("div", { class: "label", text: "Answer" }), ans);
        if (justAnswered && motionOn() && window.gsap) {
          const o = { v }; window.gsap.to(o, { v: q.answer, duration: 1.4, ease: "power2.out", onUpdate: () => (ans.textContent = fmt(o.v, q.step < 1 ? 1 : 0)) });
        }
      }
      parts.push(g);
    }
    if (q.type === "artery") {
      const heart = heartSvg({ labels: done, hit: !done });
      const wrap = h("div", { class: "heart qheart" }, heart.svg);
      parts.push(wrap);
      if (!done) for (const [k, p] of Object.entries(heart.hits)) p.addEventListener("click", () => answer(k));
      requestAnimationFrame(() => {
        heart.measure();
        for (const s of heart.segs) s.fg.style.strokeDashoffset = s.len;
        if (done) {
          light(heart, q.answer, "var(--ecg)");
          if (v !== q.answer) light(heart, v, "var(--amber)");
        }
      });
    }
    if (done) {
      const ok = isRight(q, v);
      parts.push(h("div", { class: "explain" + (ok ? "" : " no") }, h("b", { text: ok ? "Correct. " : q.type === "guess" ? "Not quite. " : "Not this time. " }), q.explain));
    }
    body.replaceChildren(...parts);
    const answered = Object.keys(saved).length;
    nav.replaceChildren(
      h("span", { text: answered === set.length ? `You got ${score()} of ${set.length}. New quiz on Monday.` : `${i + 1} of ${set.length}` }),
      i < set.length - 1 ? h("button", { type: "button", text: done ? "Next" : "Skip", onclick: () => { i++; draw(); } }) : null);
    if (justAnswered && window.gsap && motionOn()) window.gsap.from(body.querySelector(".explain"), { y: 10, opacity: 0, duration: 0.5, ease: "power3.out" });
  }
  function light(heart, key, color) {
    const s = heart.segs.find((x) => x.key === key);
    if (!s) return;
    s.fg.style.stroke = color;
    s.fg.style.filter = `drop-shadow(0 0 6px ${color})`;
    if (window.gsap && motionOn()) window.gsap.fromTo(s.fg, { strokeDashoffset: s.len }, { strokeDashoffset: 0, duration: 0.9, ease: "power2.out" });
    else s.fg.style.strokeDashoffset = 0;
  }
  draw();
  return card;
}
const snap = (v, q) => Math.round((v - q.min) / q.step) * q.step + q.min;
