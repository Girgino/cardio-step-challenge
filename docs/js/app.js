// Boot, data and refresh loop. The page reads one RPC, get_board, every 60 seconds.
// ?demo[=live|new|joined|upcoming|finished] swaps in sample data (never written anywhere).
import { $, $$, h, store, setText } from "./util.js";
import { SITE } from "./content.js";
import * as V from "./views.js";
import { renderJoin, clearSignup } from "./signup.js";
import { initMotion } from "./motion.js";

const params = new URLSearchParams(location.search);
const demo = params.has("demo") ? params.get("demo") || "live" : null;
const ns = demo ? "demo:" : "";
const isTV = () => location.hash === "#tv";

const ctx = {
  demo, ns, view: "total", showAll: false, filter: "",
  justJoined: false, zeroWarning: false, journeyTarget: 0, journeyDone: false, motion: null,
  forceOS: params.get("os") || null,
  setShowAll(v) { ctx.showAll = v; if (board) V.board(board, ctx); ctx.motion?.refresh(); },
  onJourney(p) { if (!ctx.journeyDone) V.showJourney(ctx.journeyTarget * p, board); },
  onJourneyDone() { if (!ctx.journeyDone) { ctx.journeyDone = true; V.showJourney(ctx.journeyTarget, board); } },
};

// ------------------------------------------------------------------ who is viewing
// Real visitors: ?me=<uuid> arrives from the Pacer callback and is kept on this phone.
function readMe() {
  if (demo) return null;
  let me = null;
  try {
    const q = params.get("me");
    if (q && /^[0-9a-f-]{36}$/i.test(q)) {
      localStorage.setItem("me", q);
      const u = new URL(location.href); u.searchParams.delete("me");
      history.replaceState(null, "", u.pathname + u.search + u.hash);
    }
    me = localStorage.getItem("me");
  } catch {}
  return me;
}
let me = readMe();

const hash = location.hash.slice(1);
if (hash === "joined") {
  ctx.justJoined = true;
  if (!demo) { store.set("joinedAt", Date.now()); clearSignup(); }
} else if (["denied", "expired", "error"].includes(hash)) V.banner(hash);
if (["joined", "denied", "expired", "error"].includes(hash)) history.replaceState(null, "", location.pathname + location.search);

// ------------------------------------------------------------------ data
let board = null;
let demoData = null;
async function fetchBoard() {
  if (demo) {
    const D = await import("./demo.js");
    const state = ["upcoming", "finished"].includes(demo) ? demo : "live";
    if (!demoData) {
      demoData = D.makeDataset({ state });
      const b0 = D.buildBoard(demoData);
      demoData.me = demo === "new" ? null : D.pickDemoMe(b0);
    } else D.tick(demoData);
    return D.buildBoard(demoData, demoData.me);
  }
  const res = await fetch(SITE.supabaseUrl + "/rest/v1/rpc/get_board", {
    method: "POST",
    headers: { apikey: SITE.publishableKey, "Content-Type": "application/json" },
    body: JSON.stringify({ me: me || null }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error("get_board " + res.status);
  return res.json();
}

let failures = 0;
async function load() {
  try {
    const b = await fetchBoard();
    failures = 0;
    board = b;
    render();
  } catch (e) {
    failures++;
    console.warn(e);
    if (!board) setText($("#pill-text"), failures > 1 ? "Offline · retrying" : "Connecting");
  }
}

// ------------------------------------------------------------------ render
let first = true;
function render() {
  const b = board;
  if (isTV()) { import("./tv.js").then((m) => m.renderTV(b, ctx)); return; }
  const c = b.challenge;

  // Safety net: joined 15+ minutes ago, live challenge, still no steps at all.
  const joinedAt = store.get("joinedAt", 0);
  ctx.zeroWarning = !demo && b.me && c.status === "live" && b.me.total === 0 && b.me.today === 0 && joinedAt && Date.now() - joinedAt > 15 * 60e3;
  if (!demo && me && !b.me) V.banner("missing");

  V.hero(b, ctx);
  const connected = !!b.me;
  $("#you").hidden = !connected;
  $("#join").hidden = connected;
  if (connected) V.you(b, ctx); else renderJoin(ctx);
  V.board(b, ctx);
  V.vitals(b, ctx);
  V.rounds(b, ctx);
  V.hall(b, ctx);

  $("#forget").hidden = !me || !!demo;
  const t = new Date(b.generated_at);
  setText($("#updated"), `Last refreshed ${t.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`);

  if (first) {
    first = false;
    ctx.motion = initMotion(ctx);
    // Arrived mid-page (or no scroll animation): show the journey at its real value.
    const st = $("#stage").getBoundingClientRect();
    if (!ctx.motion.on || st.bottom < 0) ctx.onJourneyDone();
    if (ctx.justJoined && connected) setTimeout(() => ctx.motion.scrollTo("#you"), 900);
    else if (hash && ["denied", "expired", "error"].includes(hash)) setTimeout(() => ctx.motion.scrollTo("#step2"), 600);
  } else {
    ctx.motion.scan();
    ctx.motion.refresh();
  }
}

// ------------------------------------------------------------------ controls
for (const btn of $$(".seg button")) {
  btn.addEventListener("click", () => {
    ctx.view = btn.dataset.view;
    for (const b2 of $$(".seg button")) b2.setAttribute("aria-pressed", String(b2 === btn));
    if (board) V.board(board, ctx);
    ctx.motion?.refresh();
  });
}
let ft;
$("#find").addEventListener("input", (e) => {
  clearTimeout(ft);
  ft = setTimeout(() => { ctx.filter = e.target.value; if (board) V.board(board, ctx); ctx.motion?.refresh(); }, 120);
});
$("#reconnect").href = demo ? "?demo=joined#joined" : SITE.supabaseUrl + "/functions/v1/auth-start";
$("#forget").addEventListener("click", () => {
  try { localStorage.removeItem("me"); } catch {}
  store.del("joinedAt");
  location.reload();
});
addEventListener("hashchange", () => { if (isTV() || location.hash === "" && document.documentElement.classList.contains("tv-mode")) location.reload(); });

// ------------------------------------------------------------------ demo chip
if (demo) {
  const chip = $("#demo-chip");
  chip.hidden = false;
  const sel = h("select", { "aria-label": "Sample scenario" },
    ...[["live", "Live, connected"], ["new", "New visitor"], ["joined", "Just joined"], ["upcoming", "Before start"], ["finished", "After the end"]]
      .map(([v, l]) => h("option", { value: v, selected: v === demo || null, text: l })));
  sel.addEventListener("change", () => { location.href = `?demo=${sel.value}${sel.value === "joined" ? "#joined" : ""}`; });
  chip.append(h("span", { text: "Sample data" }), sel, h("a", { href: isTV() ? `?demo=${demo}` : `?demo=${demo}#tv`, text: isTV() ? "Page" : "TV" }), h("a", { href: "./", text: "Exit" }));
}

// ------------------------------------------------------------------ go
if (isTV()) { $("#app").hidden = true; $("#tv").hidden = false; }
load();
let timer = setInterval(load, 60e3);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { clearInterval(timer); timer = null; }
  else if (!timer) { load(); timer = setInterval(load, 60e3); }
});
