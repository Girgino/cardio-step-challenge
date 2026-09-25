// Break-room TV (#tv): no scrolling, scenes rotate every ~15 seconds.
import { $, h, fmt, compact, avatar, fmtDay, fmtRange, plural, motionOn } from "./util.js";
import { SITE, levelOf } from "./content.js";
import { blip } from "./ecg.js";
import { sweep } from "./monitor.js";
import { heartSvg } from "./heart.js";
import { lakeInto } from "./views.js";
import * as D from "./derive.js";

const SCENE_MS = 15000;
let b = null, shell = null, stage = null, idx = -1, timer = null, bar = null;

const SCENES = [
  { key: "vitals", show: () => true, build: vitalsScene },
  { key: "leaders", show: () => b.challenge.status !== "upcoming" && b.leaderboard.length > 0, build: () => topScene("total") },
  { key: "week", show: () => b.challenge.status === "live" && b.leaderboard.some((x) => x.week > 0), build: () => topScene("week") },
  { key: "yesterday", show: () => b.podium_yesterday.length > 0, build: yesterdayScene },
  { key: "rounds", show: () => true, build: roundsScene },
  { key: "join", show: () => b.challenge.status !== "finished", build: joinScene },
];

export function renderTV(board) {
  b = board;
  if (!shell) boot();
  setClock();
  $("#tv-day").textContent = b.challenge.status === "live" ? `Day ${b.challenge.day_number} of ${b.challenge.days_total}`
    : b.challenge.status === "upcoming" ? `Starts ${fmtDay(b.challenge.start_date, { month: "short", day: "numeric" })}` : "Final results";
  if (idx < 0) next();
}

function boot() {
  document.documentElement.classList.add("tv-mode");
  const root = $("#tv");
  root.hidden = false;
  const lake = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  lake.classList.add("lake", "tv-lake");
  lakeInto(lake);
  const traceSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  traceSvg.setAttribute("preserveAspectRatio", "none");
  shell = h("div", { class: "tv" },
    lake,
    h("header", { class: "tv-head" },
      h("div", { class: "tv-brand", html: `<svg class="mark"><use href="#mark"/></svg><div><b>Cardio Step Challenge</b><span>${SITE.hospital} · hosted by the ${SITE.host}</span></div>` }),
      h("div", { class: "tv-meta" }, h("span", { class: "tv-pill", id: "tv-day" }), h("span", { class: "tv-clock", id: "tv-clock" }))),
    stage = h("main", { class: "tv-stage" }),
    h("footer", { class: "tv-foot" },
      h("div", { class: "trace tv-trace" }, traceSvg),
      h("div", { class: "tv-bar" }, bar = h("span")),
      h("div", { class: "tv-urlline" }, h("span", { text: "Join: scan the poster or visit" }), h("b", { text: SITE.url.replace(/^https?:\/\//, "").replace(/\/$/, "") }))));
  root.replaceChildren(shell);
  requestAnimationFrame(() => sweep(traceSvg, { type: "sinus", pxPerSec: 220, water: true }));
  setInterval(setClock, 15000);
  // Pick up code changes without anyone touching the TV.
  setTimeout(() => location.reload(), 6 * 3600e3);
}

function setClock() {
  const tz = b?.challenge.timezone || "America/New_York";
  const el = $("#tv-clock");
  if (el) el.textContent = new Date().toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" });
}

// ?scene=<key> pins one scene (for checking a layout).
const pinned = new URLSearchParams(location.search).get("scene");

function next() {
  const list = SCENES.filter((s) => s.show() && (!pinned || s.key === pinned));
  if (!list.length) return;
  idx = (idx + 1) % SCENES.length;
  let s = SCENES[idx];
  while (!list.includes(s)) { idx = (idx + 1) % SCENES.length; s = SCENES[idx]; }
  const el = h("section", { class: "tv-scene tv-" + s.key }, ...s.build());
  const old = stage.firstElementChild;
  const g = document.hidden || !motionOn() ? null : window.gsap;
  stage.append(el);
  if (g) {
    if (old) g.to(old, { opacity: 0, y: -30, duration: 0.6, ease: "power2.in", onComplete: () => old.remove() });
    g.from(el.querySelectorAll("[data-in]"), { opacity: 0, y: 40, duration: 0.9, ease: "power3.out", stagger: 0.07, delay: old ? 0.45 : 0 });
    g.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: SCENE_MS / 1000, ease: "none" });
  } else old?.remove();
  el.dispatchEvent(new Event("shown"));
  clearTimeout(timer);
  if (!pinned) timer = setTimeout(next, SCENE_MS);
}

// ------------------------------------------------------------------ scenes
function title(kicker, text) {
  return h("div", { class: "tv-title", "data-in": "" }, h("div", { class: "kicker", html: kicker }), h("h2", { text }));
}

function vitalsScene() {
  const f = D.goalFrac(b);
  const heart = heartSvg();
  const hw = h("div", { class: "heart tv-heart", "data-in": "" }, heart.svg);
  requestAnimationFrame(() => {
    heart.measure();
    const g = motionOn() ? window.gsap : null, o = { v: 0 };
    const paint = (v) => { const r = heart.set(v); where.textContent = f >= 1 ? "Goal complete" : `Now in the ${r.current.name}`; };
    if (g) g.to(o, { v: f, duration: 3, ease: "power2.inOut", delay: 0.6, onUpdate: () => paint(o.v) }); else paint(f);
  });
  const where = h("div", { class: "tv-where" });
  const m = D.impact(b);
  const c = b.challenge;
  return [h("div", { class: "tv-split" },
    h("div", {},
      title("<b>Vitals</b> · walk the coronary tree", c.status === "upcoming" ? "The tree is waiting." : "The whole hospital, one heart."),
      h("div", { class: "tv-big c-ecg", "data-in": "" }, fmt(b.totals.steps), h("small", { text: "steps together" })),
      h("div", { class: "tv-chs", "data-in": "" },
        h("div", { class: "c-spo2" }, h("label", { text: "Goal" }), h("b", { text: (f * 100).toFixed(1) + "%" })),
        h("div", { class: "c-amber" }, h("label", { text: "Moving today" }), h("b", { text: c.status === "live" ? `${m.activeToday}/${m.participants}` : fmt(m.participants) })),
        h("div", { class: "c-heart" }, h("label", { text: "Distance" }), h("b", { text: compact(Math.round(m.km)) + " km" }))),
      h("p", { class: "tv-line", "data-in": "", text: m.km > 0 ? `That's ${fmt(m.riverwalks)} lengths of the Sanford RiverWalk.` : `${plural(m.participants, "colleague")} signed up so far.` })),
    h("div", { class: "tv-heartwrap" }, hw, where))];
}

function topScene(view) {
  const week = view === "week";
  const rows = (week ? [...b.leaderboard].sort((a, z) => a.week_rank - z.week_rank) : b.leaderboard).slice(0, 10);
  const c = b.challenge;
  const col = (list) => h("ol", { class: "tv-list" }, ...list.map((x) => h("li", { "data-in": "", class: (week ? x.week_rank : x.rank) === 1 ? "first" : null },
    h("span", { class: "r", text: week ? x.week_rank : x.rank }),
    h("span", { class: "d", html: !week && c.status === "live" ? blip(Math.sign((x.rank_yesterday || x.rank) - x.rank)) : "" }),
    avatar(x),
    h("span", { class: "nm" }, h("b", { text: x.name }), h("small", { text: `${levelOf(x.total).name}${x.streak >= 2 ? ` · ${x.streak}-day streak` : ""}` })),
    h("span", { class: "v", text: fmt(week ? x.week : x.total) }))));
  const lastWeek = b.weekly_champions?.filter((w) => w.top.length).slice(-1)[0];
  return [
    title(week ? `<b>This week</b> · ${fmtRange(c.week_start, c.week_end)}` : `<b>Telemetry</b> · ${c.status === "finished" ? "final standings" : "whole challenge"}`,
      week ? "Clean slate every Monday." : c.status === "finished" ? "Final board." : "Top 10."),
    h("div", { class: "tv-cols" }, col(rows.slice(0, 5)), col(rows.slice(5, 10))),
    week && lastWeek ? h("p", { class: "tv-line", "data-in": "", text: `Last week's winner: ${lastWeek.top[0].name}, ${fmt(lastWeek.top[0].steps)} steps.` }) : null,
  ];
}

function yesterdayScene() {
  const p = b.podium_yesterday;
  const ms = D.moments(b, null).slice(0, 1);
  const pod = (i) => { const x = p[i]; if (!x) return h("span"); return h("div", { class: "pod p" + (i + 1), "data-in": "" }, avatar(x), h("b", { text: x.name }), h("span", { class: "num", text: fmt(x.steps) }), h("div", { class: "plinth", text: String(i + 1) })); };
  return [h("div", { class: "tv-split" },
    h("div", {}, title("<b>Rounds</b> · yesterday", "Yesterday's top 3."), h("div", { class: "podium tv-podium" }, pod(1), pod(0), pod(2))),
    h("div", { class: "tv-side" },
      b.movers.length ? h("div", { class: "tv-card", "data-in": "" }, h("div", { class: "kicker", html: "<b>Climbing</b> · this week" }),
        h("ol", { class: "plist" }, ...b.movers.map((m) => h("li", {}, avatar(m), h("span", {}, h("b", { text: m.name }), h("small", { text: `${fmt(m.last_week_avg)} → ${fmt(m.this_week_avg)} a day` })), h("span", { class: "num", text: `+${fmt(m.delta)}` }))))) : null,
      ...ms.map((m) => h("div", { class: "tv-card", "data-in": "" }, h("div", { class: "kicker", html: "<b>Hospital moment</b>" }), h("div", { class: "tv-mbig", text: fmt(m.big) + " " + m.unit }), h("p", { text: m.title + "." })))))];
}

function roundsScene() {
  const { theme, shouts } = D.announcementsSplit(b);
  const f = D.factOfDay(b);
  const sp = D.spotlight(b).slice(0, 2);
  return [h("div", { class: "tv-split" },
    h("div", {},
      theme ? title("<b>Today</b>", theme.title) : title("<b>Cardio fact</b> · today", ""),
      theme ? h("p", { class: "tv-line", "data-in": "", text: theme.body }) : null,
      h("blockquote", { class: "tv-fact", "data-in": "" }, f.text, h("cite", { text: f.src }))),
    h("div", { class: "tv-side" },
      ...shouts.slice(0, 2).map((a) => h("div", { class: "tv-card shout", "data-in": "" }, h("div", { class: "kicker", html: "<b>Shout-out</b>" }), h("h3", { text: a.title.replace(/^shout[- ]?out:?\s*/i, "") }), h("p", { text: a.body }))),
      ...sp.map((s) => h("div", { class: "tv-card", "data-in": "" }, h("div", { class: "kicker", html: `<b>Spotlight</b> · ${s.label.toLowerCase()}` }), h("h3", { text: s.p.name }), h("p", { text: s.text })))))];
}

function joinScene() {
  const c = b.challenge;
  return [h("div", { class: "tv-split tv-joinscene" },
    h("div", {},
      title("<b>Join</b> · one scan, 3 minutes", "Not in yet? Scan this."),
      h("ol", { class: "tv-steps", "data-in": "" },
        h("li", {}, h("span", {}, h("b", { text: "Get Pacer" }), " and sign in with Apple or Google.")),
        h("li", {}, h("span", {}, h("b", { text: "Tap Connect" }), " on the page and pick the same sign-in."))),
      h("p", { class: "tv-line", "data-in": "", text: c.status === "upcoming" ? `Starts ${fmtDay(c.start_date, { weekday: "long", month: "long", day: "numeric" })}. ${plural(b.totals.participants, "colleague")} already in.` : `${plural(b.totals.participants, "colleague")} walking. It's not too late to join.` })),
    h("div", { class: "tv-qr", "data-in": "" }, h("img", { src: "assets/join-qr.svg", alt: "" }), h("span", { text: SITE.url.replace(/^https?:\/\//, "").replace(/\/$/, "") })))];
}
