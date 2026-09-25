// Smooth scrolling (Lenis) and scroll-driven animation (GSAP ScrollTrigger).
// With prefers-reduced-motion (or ?motion=off) everything shows in its final state.
import { $, $$, countIn, motionOn } from "./util.js";
import { ecg, toPath } from "./ecg.js";

export function initMotion(ctx) {
  const g = window.gsap, ST = window.ScrollTrigger, L = window.Lenis;
  const on = motionOn() && g && ST;
  let lenis = null;
  const api = { scan, refresh, scrollTo, on: !!on };

  // Reveals and count-ups are driven by IntersectionObserver so content added later
  // (after a refresh) is picked up by scan() without rebuilding ScrollTriggers.
  const io = new IntersectionObserver((entries) => {
    let k = 0;
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      const el = e.target;
      if (el.hasAttribute("data-num")) countIn(el);
      if (el.hasAttribute("data-reveal")) {
        if (on) g.to(el, { opacity: 1, y: 0, duration: 0.9, ease: "power3.out", delay: 0.08 * (k++ % 4) });
        else { el.style.opacity = 1; el.style.transform = "none"; }
      }
    }
  }, { rootMargin: "0px 0px -8% 0px" });

  function scan(immediate = false) {
    for (const el of $$("[data-reveal]:not([data-seen-r])")) {
      el.setAttribute("data-seen-r", "");
      if (!on || immediate) { el.style.opacity = 1; el.style.transform = "none"; continue; }
      io.observe(el);
    }
    for (const el of $$("[data-num]:not([data-seen-n])")) { el.setAttribute("data-seen-n", ""); io.observe(el); }
  }

  let lastH = document.documentElement.scrollHeight, rt;
  function refresh() {
    if (!on) return;
    clearTimeout(rt);
    rt = setTimeout(() => {
      const hNow = document.documentElement.scrollHeight;
      if (Math.abs(hNow - lastH) > 2) { lastH = hNow; ST.refresh(); }
    }, 120);
  }

  function scrollTo(target) {
    const el = typeof target === "string" ? $(target) : target;
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: -72, duration: 1.2 });
    else el.scrollIntoView({ behavior: motionOn() ? "smooth" : "auto", block: "start" });
  }
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-scroll], a[href^='#']");
    if (!a) return;
    const href = a.getAttribute("href");
    if (!href || href === "#" || href === "#tv") return;
    const el = document.getElementById(href.slice(1));
    if (!el || el.hidden) return;
    e.preventDefault();
    scrollTo(el);
  });

  // Top-bar progress: an ECG trace that draws itself as you scroll.
  const pPath = $("#progress-path"), pSvg = $("#progress-svg");
  let pLen = 0;
  const drawProgress = () => {
    const w = Math.max(320, window.innerWidth);
    pSvg.setAttribute("viewBox", `0 0 ${w} 16`);
    pPath.setAttribute("d", toPath(ecg({ width: w, height: 16, bpm: 64, pxPerSec: 120, seed: 3, amp: 0.9, step: 3 }).points));
    pLen = pPath.getTotalLength();
    pPath.style.strokeDasharray = `${pLen} ${pLen}`;
    setP();
  };
  const setP = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
    pPath.style.strokeDashoffset = String(pLen * (1 - p));
  };
  drawProgress();
  addEventListener("resize", () => { clearTimeout(drawProgress.t); drawProgress.t = setTimeout(drawProgress, 200); });

  if (!on) {
    addEventListener("scroll", setP, { passive: true });
    scan(true);
    return api;
  }

  g.registerPlugin(ST);
  if (L) {
    lenis = new L({ lerp: 0.11, smoothWheel: true, syncTouch: false });
    lenis.on("scroll", () => { ST.update(); setP(); });
    g.ticker.add((t) => lenis.raf(t * 1000));
    g.ticker.lagSmoothing(0);
  } else addEventListener("scroll", setP, { passive: true });

  // Hero: headline and readouts drift up as the monitor scrolls away; pinned on wide screens.
  const mm = g.matchMedia();
  mm.add("(min-width: 760px)", () => {
    const tl = g.timeline({ scrollTrigger: { trigger: "#hero", start: "top top+=64", end: "+=55%", scrub: 0.6, pin: true, pinSpacing: true } });
    tl.to("#hero-title", { y: -40, opacity: 0.25, ease: "none" }, 0)
      .to("#hero-lake", { scale: 1.12, xPercent: -4, ease: "none" }, 0)
      .to("#hero-channels", { y: -18, ease: "none" }, 0)
      .to(".hero .grid", { opacity: 0.15, ease: "none" }, 0);
  });
  mm.add("(max-width: 759px)", () => {
    g.to("#hero-title", { yPercent: -18, opacity: 0.35, ease: "none", scrollTrigger: { trigger: "#hero", start: "top top", end: "bottom top", scrub: true } });
    g.to("#hero-lake", { yPercent: 12, ease: "none", scrollTrigger: { trigger: "#hero", start: "top top", end: "bottom top", scrub: true } });
  });

  // Intro: the hero monitor powers on.
  g.from(".hero .kicker, #hero-title .line, #hero-channels .ch, .hero-foot > *", { y: 24, opacity: 0, duration: 1, ease: "power3.out", stagger: 0.07, delay: 0.1 });

  // Journey: the coronary tree fills as the stage scrolls into view.
  ST.create({
    trigger: "#stage", start: "top 82%", end: "center 50%", scrub: 0.7,
    onUpdate: (self) => ctx.onJourney(self.progress),
    onLeave: () => ctx.onJourneyDone(),
  });

  // Chapter headings slide in.
  for (const el of $$(".chead")) g.from(el.children, { y: 30, opacity: 0, duration: 0.9, stagger: 0.08, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 85%", once: true } });

  scan();
  return api;
}
