// Chapter renderers. Each one patches the DOM in place so a refresh every minute
// never resets scroll position, running animations or quiz answers.
import { $, h, fmt, compact, setNum, setText, avatar, fmtDay, fmtRange, plural, motionOn, store } from "./util.js";
import { SITE, BADGES, BADGE_ORDER, levelOf } from "./content.js";
import { blip } from "./ecg.js";
import { sweep } from "./monitor.js";
import { LAKE } from "./lake.js";
import { heartSvg } from "./heart.js";
import * as D from "./derive.js";
import { renderQuiz } from "./trivia.js";

const NS = "http://www.w3.org/2000/svg";
const same = (el, key) => { if (el.dataset.key === key) return true; el.dataset.key = key; return false; };

// ------------------------------------------------------------------ lake motif
export function lakeInto(svg, { contours = 9, marker = true } = {}) {
  svg.setAttribute("viewBox", LAKE.viewBox);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  const frag = [];
  LAKE.contours.slice(0, contours).forEach((d, i) => frag.push(`<path class="iso" d="${d}" opacity="${(0.55 - i * 0.05).toFixed(2)}"/>`));
  frag.push(`<path class="shore" d="${LAKE.shore}"/>`);
  if (marker) {
    const [x, y] = LAKE.hospital;
    frag.push(`<circle class="hosp-ring" cx="${x}" cy="${y}" r="7"/><circle class="hosp" cx="${x}" cy="${y}" r="5"/>` +
      `<text x="${x + 12}" y="${y + 4}" fill="currentColor" style="font:600 13px var(--mono);letter-spacing:.1em;fill:var(--heart)">LMH</text>`);
  }
  svg.innerHTML = frag.join("");
}

// ------------------------------------------------------------------ hero
let heroTrace = null;
export function hero(b, ctx) {
  const c = b.challenge;
  if (!heroTrace) {
    lakeInto($("#hero-lake"));
    heroTrace = sweep($("#hero-trace svg"), { type: "flat", water: true, pxPerSec: 150,
      onBeat: () => { const el = $("#hero"); el.classList.add("beat"); setTimeout(() => el.classList.remove("beat"), 140); } });
  }
  heroTrace.setType(c.status === "finished" ? "brady" : "sinus");

  const pill = $("#pill");
  pill.className = "pill " + c.status;
  setText($("#pill-text"), c.status === "live" ? `Day ${c.day_number}/${c.days_total}` :
    c.status === "upcoming" ? `Starts ${fmtDay(c.start_date, { month: "short", day: "numeric" })}` : "Final results");
  setText($("#ch-status"), c.status === "live" ? `Day ${c.day_number}/${c.days_total}` : c.status === "upcoming" ? "Not started" : "Final");

  const h1 = $("#hero-title");
  const lines = c.status === "upcoming" ? [`Starts ${fmtDay(c.start_date, { weekday: "long", month: "short", day: "numeric" })}.`, "Join now."]
    : c.status === "finished" ? ["That's a wrap.", "Thank you, Lake Monroe."]
    : (c.tagline || "Every step counts.").split(/(?<=\.)\s+/);
  const key = lines.join("|");
  if (!same(h1, key)) {
    h1.replaceChildren(...lines.map((l, i) => h("span", { class: "line" }, i === lines.length - 1 && lines.length > 1 ? h("em", { text: l }) : l)));
  }

  setNum($('[data-num="steps"]'), b.totals.steps);
  setNum($('[data-num="goal"]'), D.goalFrac(b) * 100);
  setText($("#ch-today-l"), c.status === "live" ? "Today" : c.status === "upcoming" ? "Starts in" : "Length");
  setText($("#ch-today-u"), c.status === "live" ? "steps" : "days");
  setNum($('[data-num="today"]'), c.status === "live" ? D.hospitalToday(b) : c.status === "upcoming" ? c.days_left : c.days_total);
  setNum($('[data-num="walkers"]'), b.totals.participants);
  setNum($('[data-num="km"]'), Math.round(b.totals.distance_m / 1000));

  const { theme } = D.announcementsSplit(b);
  const chip = $("#theme-chip");
  chip.hidden = !theme || c.status !== "live";
  if (theme) setText(chip, `Today · ${theme.title}`);

  const cta = $("#hero-cta");
  const me = b.me;
  if (me) { setText(cta, c.status === "upcoming" ? "You're in · see who's joined" : "See your chart"); cta.setAttribute("href", c.status === "upcoming" ? "#board" : "#you"); }
  else { setText(cta, "Join in 3 minutes"); cta.setAttribute("href", "#join"); }
  const kmTot = compact(Math.round(b.totals.distance_m / 1000));
  setText($("#hero-sub"), c.status === "live" ? `${fmt(b.totals.active_today)} of ${fmt(b.totals.participants)} walkers moving today · ${kmTot} km together`
    : c.status === "upcoming" ? `${plural(c.days_left, "day")} to go · ${plural(b.totals.participants, "colleague")} already in`
    : `${plural(b.totals.participants, "walker")} · ${kmTot} km together`);
}

// ------------------------------------------------------------------ banner
const BANNERS = {
  joined: ["ok", "You're in. Your steps will show up within a few minutes and keep updating on their own."],
  denied: ["warn", "Pacer access wasn't approved. Go to step 2 and tap Connect again, then tap Approve."],
  expired: ["warn", "That sign-in took too long and expired. Go to step 2 and tap Connect again."],
  error: ["warn", "Something went wrong connecting to Pacer. Wait a minute and tap Connect again. If it keeps failing, tell Cardio Connect LMH."],
  missing: ["warn", "We couldn't find your connection on this phone. Connect again below; your steps are kept."],
};
export function banner(kind) {
  const el = $("#banner");
  const b = BANNERS[kind];
  el.hidden = !b || kind === "joined";
  if (!b || kind === "joined") return;
  el.className = "banner " + b[0];
  setText($("#banner-text"), b[1]);
}

// ------------------------------------------------------------------ you
export function you(b, ctx) {
  const me = b.me, c = b.challenge;
  const lv = levelOf(me.total);
  const mon = $("#youmon");
  if (!mon.firstChild) {
    mon.append(
      h("div", { class: "who" }, h("span", { id: "me-av" }), h("div", {}, h("b", { id: "me-name" }), h("span", { class: "lvl", id: "me-lvl" }))),
      h("div", { class: "channels" },
        h("div", { class: "ch c-ecg" }, h("label", {}, h("span", { text: "Rank" }), h("span", { id: "me-of" })),
          h("span", { class: "v rank-row" }, h("span", {}, "#", h("span", { "data-num": "", id: "me-rank" })), h("span", { id: "me-blip" }))),
        h("div", { class: "ch c-white" }, h("label", {}, h("span", { text: "Total" }), h("span", { text: "steps" })), h("span", { class: "v" }, h("span", { "data-num": "", id: "me-total" }))),
        h("div", { class: "ch c-amber" }, h("label", {}, h("span", { text: "Today" }), h("span", { text: "steps" })), h("span", { class: "v" }, h("span", { "data-num": "", id: "me-today" }))),
        h("div", { class: "ch c-spo2" }, h("label", {}, h("span", { text: "Streak" }), h("span", { text: "days" })), h("span", { class: "v" }, h("span", { "data-num": "", id: "me-streak" }))),
      ),
      gaugeEl(),
      h("div", { class: "lvlbar" }, h("div", { class: "row" }, h("span", { id: "lv-a" }), h("span", { id: "lv-b" })), h("div", { class: "track" }, h("div", { class: "fill", id: "lv-fill" }))),
    );
  }
  if (!same($("#me-av"), me.avatar || me.name)) $("#me-av").replaceChildren(avatar(me));
  setText($("#me-name"), me.name);
  setText($("#me-lvl"), `Level · ${lv.name}`);
  setText($("#me-of"), `of ${fmt(b.totals.participants)}`);
  setNum($("#me-rank"), me.rank);
  setNum($("#me-total"), me.total);
  setNum($("#me-today"), me.today);
  setNum($("#me-streak"), me.streak);
  const dir = c.status === "live" ? Math.sign((me.rank_yesterday || me.rank) - me.rank) : 0;
  if (!same($("#me-blip"), String(dir))) $("#me-blip").innerHTML = blip(dir);

  const thr = c.streak_threshold;
  const g = $("#gauge");
  const frac = Math.min(1, me.today / thr);
  g.classList.toggle("done", frac >= 1);
  g.querySelector(".fg").style.strokeDashoffset = String(176 * (1 - frac));
  $("#gauge-text").innerHTML = c.status !== "live" ? `Daily target: <b>${fmt(thr)}</b> steps. Streaks count days in a row at or above it.`
    : frac >= 1 ? `<b>${fmt(thr)} reached today.</b> Streak day ${fmt(me.streak)} is in.`
    : `<b>${fmt(me.today)} of ${fmt(thr)}</b> today. Streaks count days in a row at ${fmt(thr)}+.`;

  setText($("#lv-a"), lv.name);
  setText($("#lv-b"), lv.next ? `${fmt(lv.next.min - me.total)} to ${lv.next.name}` : "Top level");
  $("#lv-fill").style.width = (lv.pct * 100).toFixed(1) + "%";

  ladder(b, me);
  feed(b, me, ctx);
  badges(me);
  joinedMoment(ctx);
}

function gaugeEl() {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 64 64");
  svg.innerHTML = `<circle class="bg" cx="32" cy="32" r="28"/><circle class="fg" cx="32" cy="32" r="28" stroke-dasharray="176 176" stroke-dashoffset="176"/>`;
  return h("div", { class: "gauge", id: "gauge" }, svg, h("p", { id: "gauge-text" }));
}

function ladder(b, me) {
  const el = $("#ladder");
  const n = D.neighbors(b, me);
  const key = n.rows.map((x) => `${x.id}:${x.total}`).join(",");
  if (same(el, key)) return;
  el.replaceChildren(h("h3", { class: "label", text: "Near you" }), ...n.rows.map((x) => {
    const gap = x.total - me.total;
    return h("div", { class: "lrow" + (x.id === me.id ? " me" : "") },
      h("span", { class: "r", text: "#" + x.rank }), avatar(x),
      h("span", { class: "nm", text: x.id === me.id ? "You" : x.name }),
      h("span", { class: "gap", html: x.id === me.id ? `<b>${fmt(x.total)}</b>` : gap > 0 ? `<b>${fmt(gap)}</b> ahead` : gap < 0 ? `<b>${fmt(-gap)}</b> behind` : "tied" }));
  }));
}

function note(cls, icon, title, small) {
  return h("div", { class: "card note " + cls, "data-reveal": "" },
    h("span", { class: "ico", html: icon }), h("p", {}, h("b", { text: title }), small ? h("small", { text: small }) : null));
}
const ICON_UP = `<svg viewBox="0 0 24 14"><path d="M1 9H6L8 11L10.5 2L13 13L15 9H23" fill="none" stroke="var(--ecg-ink)" stroke-width="2" stroke-linejoin="round"/></svg>`;
const ICON_STAR = `<svg viewBox="0 0 24 14"><path d="M1 10H5L7 4L9 12L11 1L13 13L15 7L17 10H23" fill="none" stroke="var(--heart-ink)" stroke-width="2" stroke-linejoin="round"/></svg>`;
const ICON_FLAT = `<svg viewBox="0 0 24 14"><path d="M1 7H23" fill="none" stroke="var(--amber-ink)" stroke-width="2"/></svg>`;
const ICON_DOWN = `<svg viewBox="0 0 24 14"><path d="M1 5H6L8 3L10.5 12L13 1L15 5H23" fill="none" stroke="var(--amber-ink)" stroke-width="2" stroke-linejoin="round"/></svg>`;

function feed(b, me, ctx) {
  const c = b.challenge;
  const items = [];
  const names = (list) => list.slice(0, 3).map((x) => x.name).join(", ") + (list.length > 3 ? ` and ${list.length - 3} more` : "");
  if (ctx.zeroWarning) items.push(["warn", ICON_FLAT, "Seeing 0 steps?", "You probably picked a different sign-in on the Pacer screen than the one you use in the app. Tap Reconnect Pacer at the bottom of this page and choose the other one."]);
  const { passed, passedBy } = D.passedToday(b, me);
  if (passed.length) items.push(["", ICON_UP, `You passed ${plural(passed.length, "colleague")} today`, names(passed)]);
  if (D.isPB(me)) items.push(["pb", ICON_STAR, `New personal best: ${fmt(me.today)} steps today`, `Your previous best day was ${fmt(me.best_prior)}.`]);
  const n = D.neighbors(b, me);
  if (c.status !== "upcoming") {
    if (n.above) items.push(["", ICON_UP, `${fmt(n.above.total - me.total + 1)} steps to pass ${n.above.name}`, `That would put you at #${n.above.rank}.`]);
    else if (me.rank === 1) items.push(["pb", ICON_STAR, c.status === "finished" ? "You finished first in the hospital." : "You're leading the hospital.", n.below ? `${fmt(me.total - n.below.total)} steps ahead of ${n.below.name}.` : null]);
  }
  if (passedBy.length && c.status === "live") items.push(["warn", ICON_DOWN, `${plural(passedBy.length, "colleague")} moved past you today`, `A short walk now gets some of those places back.`]);
  const key = JSON.stringify(items);
  const el = $("#feed");
  if (same(el, key)) return;
  el.replaceChildren(...items.map((i) => note(...i)));
  ctx.motion?.scan();
}

function badges(me) {
  const el = $("#mybadges");
  const key = me.badges.join(",");
  if (same(el, key)) return;
  const have = new Set(me.badges);
  const next = BADGE_ORDER.filter((k) => !have.has(k)).slice(0, 3);
  const chip = (k, locked) => h("span", { class: "badge" + (locked ? " locked" : ""), title: BADGES[k].note },
    h("i", { text: BADGES[k].tag }), h("span", {}, BADGES[k].name, h("small", { style: "display:block;font-weight:400;color:var(--muted);font-size:11.5px", text: BADGES[k].note })));
  el.replaceChildren(
    h("div", { class: "label", text: `Badges · ${me.badges.length} of ${BADGE_ORDER.length}` }),
    h("h3", { text: me.badges.length ? "Earned" : "Your first badge comes with your first synced steps" }),
    h("div", { class: "badges" }, ...me.badges.filter((k) => BADGES[k]).map((k) => chip(k, false))),
    next.length ? h("h3", { text: "Up next", style: "margin-top:18px" }) : null,
    h("div", { class: "badges" }, ...next.map((k) => chip(k, true))),
  );
}

function joinedMoment(ctx) {
  const slot = $("#joined-slot");
  if (!ctx.justJoined) { slot.replaceChildren(); return; }
  if (slot.firstChild) return;
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("preserveAspectRatio", "none");
  const box = h("div", { class: "screen joined", style: "margin-bottom:14px" },
    h("div", { class: "kicker", html: "<b>Connected</b> · Pacer" }),
    h("div", { class: "trace" }, svg),
    h("h3", { text: "You're in." }),
    h("p", { text: "Your steps will show up here within a few minutes and then update on their own every 30 minutes. You don't need to do anything else. Just keep your phone with you." }),
    h("p", { style: "margin-top:10px", text: "Tip: add this page to your home screen to check your rank. On iPhone, tap Share, then Add to Home Screen." }));
  slot.append(box);
  requestAnimationFrame(() => sweep(svg, { type: "sinus", bpm: 84, pxPerSec: 170 }));
}

// ------------------------------------------------------------------ board
const rowsById = new Map();
export function board(b, ctx) {
  const c = b.challenge;
  const lb = $("#lb");
  const meId = b.me?.id;
  const bar = $(".boardbar");

  if (c.status === "upcoming") {
    bar.hidden = true;
    setText($("#board-lede"), `${plural(b.totals.participants, "colleague")} ${b.totals.participants === 1 ? "has" : "have"} joined so far. The board starts ${fmtDay(c.start_date, { weekday: "long", month: "long", day: "numeric" })}.`);
    setText($("#weeknote"), "");
    const key = "wall:" + b.leaderboard.map((x) => x.id).join(",");
    if (same(lb, key)) return;
    rowsById.clear();
    const people = [...b.leaderboard].sort((a, z) => a.name.localeCompare(z.name));
    lb.replaceChildren(h("li", { style: "display:block;border:0" }, h("div", { class: "wall" }, ...people.map((p) => { const a = avatar(p); a.title = p.name; if (p.id === meId) a.style.boxShadow = "0 0 0 2px var(--surface), 0 0 0 4px var(--heart-ink)"; return a; }))));
    $("#more").replaceChildren();
    return;
  }
  bar.hidden = false;
  setText($("#board-lede"), c.status === "finished" ? "Final standings. Total steps was the only score." : "Total steps is the only score. Weekly rounds start fresh every Monday.");
  const lastWeek = b.weekly_champions?.filter((w) => w.top.length).slice(-1)[0];
  setText($("#weeknote"), ctx.view === "week"
    ? `Week of ${fmtRange(c.week_start, c.week_end)}${c.status === "live" ? " · resets Monday" : ""}${lastWeek ? ` · last week: ${lastWeek.top[0].name}` : ""}`
    : c.status === "live" ? `Day ${c.day_number} of ${c.days_total} · ${plural(c.days_left, "day")} left` : `${fmtRange(c.start_date, c.end_date)}`);

  const week = ctx.view === "week";
  const sorted = week ? [...b.leaderboard].sort((a, z) => a.week_rank - z.week_rank || a.name.localeCompare(z.name)) : b.leaderboard;
  let show;
  const q = ctx.filter.trim().toLowerCase();
  if (q) show = sorted.filter((x) => x.name.toLowerCase().includes(q)).slice(0, 60);
  else if (ctx.showAll || sorted.length <= 15) show = sorted;
  else {
    show = sorted.slice(0, 10);
    const i = sorted.findIndex((x) => x.id === meId);
    if (i >= 10) {
      const from = Math.max(10, i - 2);
      if (from > 10) show.push({ sep: true, id: "sep" });
      show.push(...sorted.slice(from, i + 3));
    }
  }

  // FLIP: remember positions, reorder, animate from old to new.
  const first = new Map();
  if (motionOn() && window.gsap) for (const [id, li] of rowsById) if (li.isConnected) first.set(id, li.getBoundingClientRect().top);
  const wanted = show.map((x) => {
    let li = rowsById.get(x.id);
    if (!li) { li = x.sep ? h("li", { class: "sep", text: "···", "aria-hidden": "true" }) : rowEl(); rowsById.set(x.id, li); }
    if (!x.sep) fillRow(li, x, b, week, x.id === meId);
    return li;
  });
  const keep = new Set(wanted);
  for (const li of [...lb.children]) if (!keep.has(li)) li.remove();
  wanted.forEach((li, i) => { if (lb.children[i] !== li) lb.insertBefore(li, lb.children[i] || null); });
  if (first.size) {
    for (const [id, li] of rowsById) {
      if (!li.isConnected || !first.has(id)) continue;
      const dy = first.get(id) - li.getBoundingClientRect().top;
      if (Math.abs(dy) > 1 && Math.abs(dy) < 1500) window.gsap.fromTo(li, { y: dy }, { y: 0, duration: 0.7, ease: "power3.out", clearProps: "transform" });
    }
  }

  const more = $("#more");
  const mk = q ? (show.length ? "" : "none") : !ctx.showAll && sorted.length > 15 ? "all" : ctx.showAll && sorted.length > 15 ? "less" : "";
  if (!same(more, mk + sorted.length)) {
    more.replaceChildren(
      mk === "all" ? h("button", { type: "button", onclick: () => ctx.setShowAll(true), text: `Show all ${fmt(sorted.length)}` }) :
      mk === "less" ? h("button", { type: "button", onclick: () => ctx.setShowAll(false), text: "Show top 10" }) :
      mk === "none" ? h("p", { class: "empty", text: "Nobody by that name yet." }) : "");
  }
}

function rowEl() {
  return h("li", {},
    h("span", { class: "r" }), h("span", { class: "d" }), h("span", { class: "a" }),
    h("span", { class: "nm" }, h("b"), h("small")),
    h("span", { class: "val main" }, h("span", { class: "n" }), h("small", { class: "m" })),
    h("span", { class: "val today" }));
}
function fillRow(li, x, b, week, isMe) {
  const c = b.challenge;
  const [r, d, a, nm, main, today] = li.children;
  li.classList.toggle("me", isMe);
  li.classList.toggle("top1", (week ? x.week_rank : x.rank) === 1);
  setText(r, week ? x.week_rank : x.rank);
  const dir = !week && c.status === "live" ? Math.sign((x.rank_yesterday || x.rank) - x.rank) : 0;
  if (!same(d, String(dir))) d.innerHTML = blip(dir);
  if (!same(a, x.avatar || x.name)) a.replaceChildren(avatar(x));
  setText(nm.children[0], isMe ? `${x.name} (you)` : x.name);
  const lv = levelOf(x.total).name;
  const subKey = `${lv}|${x.streak}|${x.badges.length}`;
  if (!same(nm.children[1], subKey)) {
    nm.children[1].innerHTML = `<span class="t">${lv}</span>${x.streak >= 2 ? ` · ${x.streak}-day streak` : ""}${x.badges.length > 1 ? ` · ${x.badges.length} badges` : ""}`;
  }
  setText(main.children[0], fmt(week ? x.week : x.total));
  setText(main.children[1], c.status === "live" ? `+${fmt(x.today)} today` : "");
  setText(today, c.status === "live" ? `+${fmt(x.today)}` : "");
}

// ------------------------------------------------------------------ vitals
let heartApi = null;
let journeyTarget = 0, journeyShown = 0;
export function vitals(b, ctx) {
  const c = b.challenge;
  if (!heartApi) {
    heartApi = heartSvg();
    $("#heart").append(heartApi.svg);
  }
  const lede = $("#vitals-lede");
  setText(lede, `Goal: ${compact(c.collective_goal_steps)} steps together. Every step anyone takes moves the whole hospital through the heart's arteries, from the left main to the PDA.`);
  journeyTarget = D.goalFrac(b);
  ctx.journeyTarget = journeyTarget;
  if (!motionOn() || ctx.journeyDone) showJourney(journeyTarget, b, !!ctx.journeyDone);
  else if (!journeyShown) showJourney(0, b);
  impactCards(b, ctx);
}

export function showJourney(f, b = lastBoard, tween = false) {
  lastBoard = b;
  if (!heartApi || !b) return;
  const g = window.gsap;
  if (tween && g && motionOn() && Math.abs(f - journeyShown) > 0.0005) {
    const o = { v: journeyShown };
    g.to(o, { v: f, duration: 1.4, ease: "power2.out", overwrite: true, onUpdate: () => paintJourney(o.v, b) });
  } else paintJourney(f, b);
}
let lastBoard = null;
function paintJourney(f, b) {
  journeyShown = f;
  const { current, index } = heartApi.set(f);
  const starts = heartApi.starts();
  const goal = b.challenge.collective_goal_steps;
  setText($("#j-pct"), (f * 100).toFixed(f < 0.1 ? 1 : 0));
  $("#j-bar").style.width = (f * 100).toFixed(2) + "%";
  const next = starts[index + 1];
  if (f >= 1) { setText($("#j-where-label"), "Goal"); setText($("#j-where"), "Complete"); setText($("#j-left"), `${compact(b.totals.steps - goal)} steps past the goal`); }
  else {
    setText($("#j-where-label"), "Now in");
    setText($("#j-where"), current.name);
    setText($("#j-left"), next ? `${compact(Math.max(0, next.start * goal - f * goal))} steps to the ${next.name}` : `${compact((1 - f) * goal)} steps to the finish`);
  }
  const lm = $("#landmark");
  if (lm.dataset.k !== current.key) { lm.dataset.k = current.key; lm.innerHTML = `<b>${current.name}.</b> ${current.fact}`; }
}

function impactCards(b, ctx) {
  const el = $("#impact");
  const m = D.impact(b);
  const c = b.challenge;
  const key = JSON.stringify([m, b.daily.length, b.daily.at(-1)?.steps, c.status]);
  if (same(el, key)) return;
  const stat = (label, v, p) => h("div", { class: "card stat", "data-reveal": "" }, h("div", { class: "label", text: label }), h("span", { class: "v", text: v }), p ? h("p", { text: p }) : null);
  const cards = [
    stat("Moving today", c.status === "live" ? `${fmt(m.activeToday)} / ${fmt(m.participants)}` : fmt(m.participants),
      c.status === "live" ? "colleagues with steps synced today" : c.status === "upcoming" ? "colleagues signed up" : "colleagues took part"),
    stat("Distance together", `${fmt(m.km)} km`, m.riverwalks >= 1 ? `That's ${fmt(m.riverwalks)} lengths of the Sanford RiverWalk.` : "The RiverWalk is 7.8 km. We'll pass it soon."),
    stat("Per walker, per day", m.perWalker ? fmt(m.perWalker) : "—", m.change != null ? `${m.change >= 0 ? "Up" : "Down"} ${Math.abs(m.change * 100).toFixed(0)}% since week 1` : "Average steps on days with steps"),
  ];
  if (b.daily.length > 1) cards.push(sparkCard(b));
  if (c.status !== "upcoming" && m.km > 0)
    cards.push(h("div", { class: "card quote", "data-reveal": "" }, h("div", { class: "label", text: "In one sentence" }),
      h("p", { style: "margin-top:8px", text: `${plural(m.participants, "colleague")} at ${SITE.hospital} have walked ${fmt(m.km)} km together${m.lakeLoops >= 1 ? `, enough to circle Lake Monroe ${fmt(m.lakeLoops)} ${Math.round(m.lakeLoops) === 1 ? "time" : "times"}` : ""}.` })));
  el.replaceChildren(...cards);
  ctx.motion?.scan();
}

function sparkCard(b) {
  const days = b.daily;
  const max = Math.max(...days.map((d) => d.steps), 1);
  const W = 600, H = 90, bw = W / days.length;
  const done = days.filter((d) => d.day < b.challenge.today);
  const rec = done.length ? Math.max(...done.map((d) => d.steps)) : -1;
  const bars = days.map((d, i) => {
    const hh = Math.max(2, (d.steps / max) * (H - 18));
    const cls = d.day === b.challenge.today ? "last" : d.steps === rec ? "rec" : "";
    return `<rect class="${cls}" x="${(i * bw + 1.5).toFixed(1)}" y="${(H - 16 - hh).toFixed(1)}" width="${Math.max(1, bw - 3).toFixed(1)}" height="${hh.toFixed(1)}" rx="2"><title>${fmtDay(d.day)}: ${fmt(d.steps)} steps, ${d.active} walkers</title></rect>`;
  }).join("");
  const svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Hospital steps per day">${bars}` +
    `<text class="axis" x="0" y="${H}" >${fmtDay(days[0].day, { month: "short", day: "numeric" })}</text>` +
    `<text class="axis" x="${W}" y="${H}" text-anchor="end">${b.challenge.status === "live" ? "Today" : fmtDay(days.at(-1).day, { month: "short", day: "numeric" })}</text></svg>`;
  return h("div", { class: "card spark", "data-reveal": "" }, h("div", { class: "label", text: "Hospital steps per day · record day highlighted" }), h("div", { html: svg }));
}

// ------------------------------------------------------------------ rounds
const SLOTS = ["podium", "moments", "movers", "spotlight", "shouts", "news", "fact", "quiz"];
export function rounds(b, ctx) {
  const grid = $("#rounds-grid");
  if (!grid.children.length) for (const s of SLOTS) grid.append(h("div", { id: "slot-" + s, style: "display:contents" }));
  const c = b.challenge;
  const { shouts, news } = D.announcementsSplit(b);

  // podium
  put("podium", JSON.stringify(b.podium_yesterday), () => b.podium_yesterday.length ? [
    h("div", { class: "card rc", "data-reveal": "" }, h("div", { class: "label", text: "Yesterday's top 3" }),
      h("h3", { text: fmtDay(prevDay(c.today),{ weekday: "long", month: "short", day: "numeric" }) }),
      h("div", { class: "podium" }, ...[1, 0, 2].map((i) => { const p = b.podium_yesterday[i]; if (!p) return h("span"); return h("div", { class: "pod p" + (i + 1) }, avatar(p), h("b", { text: p.name }), h("span", { class: "num", text: fmt(p.steps) }), h("div", { class: "plinth", text: String(i + 1) })); })))] : []);

  // moments
  const ms = D.moments(b, heartApi?.starts());
  put("moments", JSON.stringify(ms), () => ms.map((m) => h("div", { class: "screen moment", "data-reveal": "" },
    h("div", { class: "kicker", html: `<b>Hospital moment</b>` }), h("div", { class: "big" }, fmt(m.big), h("span", { style: "font-size:.4em;margin-left:6px;color:var(--scr-muted)", text: m.unit })),
    h("p", {}, h("b", { text: m.title + ". " }), m.text))));

  // movers
  put("movers", JSON.stringify(b.movers), () => b.movers.length ? [h("div", { class: "card rc", "data-reveal": "" },
    h("div", { class: "label", text: "Climbing this week" }), h("h3", { text: "Biggest movers" }),
    h("ol", { class: "plist" }, ...b.movers.map((m) => h("li", {}, avatar(m), h("span", {}, h("b", { text: m.name }), h("small", { text: `${fmt(m.last_week_avg)} → ${fmt(m.this_week_avg)} a day` })), h("span", { class: "num", text: `+${fmt(m.delta)}` })))))] : []);

  // spotlight
  const sp = D.spotlight(b);
  put("spotlight", JSON.stringify(sp.map((s) => [s.label, s.p.id, s.text])), () => sp.length ? [h("div", { class: "card rc", "data-reveal": "" },
    h("div", { class: "label", text: "Weekly spotlight" }), h("h3", { text: "Not just the top 3" }),
    h("ol", { class: "plist" }, ...sp.map((s) => h("li", {}, avatar(s.p), h("span", {}, h("b", { text: s.p.name }), h("small", { text: s.text })), h("span", { class: "label", style: "text-align:right;max-width:9em", text: s.label })))))] : []);

  put("shouts", JSON.stringify(shouts), () => shouts.map((a) => h("div", { class: "card shout", "data-reveal": "" },
    h("div", { class: "label", text: "Shout-out" }), h("h3", { text: a.title.replace(/^shout[- ]?out:?\s*/i, "") }), h("p", { text: a.body }))));

  put("news", JSON.stringify(news), () => news.length ? [h("div", { class: "card rc news", "data-reveal": "" },
    h("div", { class: "label", text: "Announcements" }),
    ...news.map((a) => h("article", {}, h("time", { text: new Date(a.publish_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) }), h("h4", { text: a.title }), h("p", { text: a.body }))))] : []);

  const f = D.factOfDay(b);
  put("fact", f.text, () => [h("div", { class: "screen fact", "data-reveal": "" },
    h("div", { class: "kicker", html: "<b>Cardio fact</b> · today" }), h("blockquote", { text: f.text }), h("cite", { text: f.src }))]);

  const wk = D.quizWeek(b);
  put("quiz", `${c.start_date}:${wk}`, () => [renderQuiz(b, wk, ctx)]);
  ctx.motion?.scan();
}
const prevDay = (iso) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };
function put(slot, key, build) {
  const el = $("#slot-" + slot);
  if (same(el, key)) return;
  el.replaceChildren(...build());
}

// ------------------------------------------------------------------ hall of weeks
export function hall(b, ctx) {
  const c = b.challenge;
  const weeks = (b.weekly_champions || []).filter((w) => w.top.length);
  const live = c.status === "live" && c.week_start > c.start_date;
  const ch = $("#hall-ch");
  ch.hidden = !weeks.length && !live;
  if (ch.hidden) return;
  const current = live ? [...b.leaderboard].filter((x) => x.week > 0).sort((a, z) => a.week_rank - z.week_rank).slice(0, 3) : [];
  const key = JSON.stringify([weeks, current.map((x) => [x.id, x.week])]);
  const el = $("#hall");
  if (same(el, key)) return;
  const wkNo = (ws) => Math.floor((Date.parse(ws) - Date.parse(mondayOf(c.start_date))) / (7 * 864e5)) + 1;
  const card = (title, sub, list, isLive) => h("div", { class: "card wk" + (isLive ? " live" : ""), "data-reveal": "" },
    h("header", {}, h("b", { text: title }), h("span", { text: sub })),
    h("ol", {}, ...list.map((p, i) => h("li", {}, h("i", { text: String(i + 1) }), avatar(p), h("b", { text: p.name }), h("span", { class: "num", text: fmt(p.steps ?? p.week) })))));
  el.replaceChildren(
    ...(current.length ? [card(`Week ${wkNo(c.week_start)}`, "In progress", current, true)] : []),
    ...weeks.slice().reverse().map((w) => card(`Week ${wkNo(w.week_start)}`, fmtRange(w.week_start, w.week_end), w.top)));
  ctx.motion?.scan();
}
const mondayOf = (iso) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };

export { store };
