// Sample data for ?demo. Builds a realistic dataset of walkers and computes the
// exact get_board() shape in JavaScript. Nothing here touches the database.
// Also imported by tests/board.test.mjs, which checks this logic against the SQL.

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- dates
export const addDays = (iso, n) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const diffDays = (a, b) => Math.round((Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 864e5);
export const mondayOf = (iso) => {
  const dow = (new Date(iso + "T00:00:00Z").getUTCDay() + 6) % 7;
  return addDays(iso, -dow);
};
export const todayIn = (tz, at = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
const minD = (a, b) => (a < b ? a : b);
const maxD = (a, b) => (a > b ? a : b);

// ---------------------------------------------------------------- people
const FIRST = ("Maria James Priya Marcus Aisha Daniel Sofia Kevin Lauren Andre Mei Carlos Rachel Tyler Fatima " +
  "Jordan Grace Luis Hannah Omar Brianna Nick Keisha Ryan Elena Victor Chloe Darius Nadia Sean Ashley Raj " +
  "Monique Ethan Leah Hector Jasmine Tom Yesenia Brandon Olivia Kwame Tiffany Mateo Hope Samir Kayla Devon " +
  "Lucia Chris Amara Jake Rosa Malik Emily Tuan Destiny Paul Ingrid Andrew Zoe Dmitri Camila Ben Nia Gabe " +
  "Leticia Scott Imani Derek Ana Wes Latoya Josh Megan Anh Travis Carmen Eli Shanice Vince Dana Ricardo").split(" ");
const LAST = "ABCDEFGHJKLMNOPRSTVWY".split("");
const HANDLES = ["nightshiftnurse", "stairsnotelevators", "RT_Mike", "cathlabkat", "5WestWalker", "pharmD_jess",
  "EDrunner", "echo_tech_tina", "drP", "lakeloop", "ICU_Ray", "sanford_steps"];

function avatarData(r, initials) {
  const hues = [168, 190, 12, 38, 205, 150, 340];
  const h1 = hues[Math.floor(r() * hues.length)], h2 = (h1 + 30 + Math.floor(r() * 60)) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="hsl(${h1} 55% 42%)"/><stop offset="1" stop-color="hsl(${h2} 60% 28%)"/></linearGradient></defs>` +
    `<rect width="64" height="64" fill="url(#g)"/><text x="32" y="40" font-family="Arial" font-size="22" font-weight="700" ` +
    `fill="rgba(255,255,255,.92)" text-anchor="middle">${initials}</text></svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

const uuid = (r) => {
  const h = () => Math.floor(r() * 16).toString(16);
  const s = (n) => Array.from({ length: n }, h).join("");
  return `${s(8)}-${s(4)}-4${s(3)}-${"89ab"[Math.floor(r() * 4)]}${s(3)}-${s(12)}`;
};

function gauss(r) {
  return Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
}

// ---------------------------------------------------------------- dataset
// state: live | upcoming | finished. Dates are relative to "today" in the challenge
// timezone so the board always looks current.
export function makeDataset({ n = 150, seed = 20261005, state = "live", dayNumber = 12, daysTotal = 28, now = new Date(), alignMonday = true } = {}) {
  const r = rng(seed);
  const tz = "America/New_York";
  const today = todayIn(tz, now);
  let start;
  if (state === "upcoming") start = alignMonday ? mondayOf(addDays(today, 9)) : addDays(today, 9);
  else if (state === "finished" && alignMonday) start = mondayOf(addDays(today, -(daysTotal + 1)));
  else if (state === "finished") start = addDays(today, -(daysTotal + 1));
  else start = alignMonday ? mondayOf(addDays(today, 2 - dayNumber)) : addDays(today, -(dayNumber - 1));
  const end = addDays(start, daysTotal - 1);

  const challenge = {
    name: "Cardio Step Challenge",
    tagline: "Every step counts. Literally.",
    start_date: start, end_date: end, timezone: tz,
    streak_threshold: 7500, collective_goal_steps: 25000000, collective_goal_label: "Walk the coronary tree",
  };

  // Hour of day in the challenge timezone, for a believable partial "today".
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false }).format(now)) % 24;
  const dayFrac = Math.min(1, Math.max(0.06, (hour - 5.5) / 16));

  const used = new Set();
  const participants = [];
  const steps = [];
  const lastDay = minD(today, end);
  for (let i = 0; i < n; i++) {
    let name;
    do {
      name = r() < 0.07 ? HANDLES[Math.floor(r() * HANDLES.length)]
        : `${FIRST[Math.floor(r() * FIRST.length)]} ${LAST[Math.floor(r() * LAST.length)]}.`;
    } while (used.has(name));
    used.add(name);
    const initials = name.split(/[\s_]/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    const id = uuid(r);
    // Most people join in the week before the start; about 1 in 8 join late.
    const late = state !== "upcoming" && r() < 0.12;
    const joinDay = late ? addDays(start, 1 + Math.floor(r() * Math.min(9, Math.max(1, diffDays(lastDay, start))))) :
      addDays(start, -1 - Math.floor(r() * 8));
    const p = {
      id, display_name: name,
      avatar_url: r() < 0.62 ? avatarData(r, initials) : null,
      joined_at: joinDay + "T16:00:00Z",
      active: true, last_synced_at: now.toISOString(),
    };
    participants.push(p);
    if (state === "upcoming") continue;

    const base = Math.exp(Math.log(7400) + 0.42 * gauss(r)) * (r() < 0.04 ? 1.9 : 1);
    const weekend = 0.75 + r() * 0.45;
    const trend = (r() - 0.35) * 0.03;   // some people ramp up week over week
    const stride = 0.68 + r() * 0.14;
    const firstDay = late ? addDays(joinDay, -8) : start; // Pacer returns about 8 days of history
    for (let d = maxD(start, firstDay); d <= lastDay; d = addDays(d, 1)) {
      const k = diffDays(d, start);
      const dow = new Date(d + "T00:00:00Z").getUTCDay();
      if (r() < 0.035) continue; // forgot the phone
      let s = base * (dow === 0 || dow === 6 ? weekend : 1) * (1 + trend * k) * (1 + 0.24 * gauss(r));
      if (r() < 0.05) s *= 1.7 + r(); // big day
      if (d === today) s *= dayFrac * (0.8 + 0.4 * r());
      s = Math.max(0, Math.round(s));
      if (s === 0) continue;
      steps.push({ participant_id: id, day: d, steps: s, distance_m: Math.round(s * stride) });
    }
  }

  const t0 = new Date(now.getTime() - 26 * 3600e3);
  const announcements = state === "upcoming" ? [] : [
    { ...THEMES[new Date(today + "T12:00:00Z").getUTCDay()], publish_at: new Date(now.getTime() - 3 * 3600e3).toISOString() },
    { title: "Shout-out: 4 West", body: "Night shift on 4 West walked the unit loop on every break this week.", publish_at: t0.toISOString() },
    { title: "Leadership walk Friday", body: "Join hospital leadership for a lap of the Riverwalk at noon.", publish_at: new Date(now.getTime() - 50 * 3600e3).toISOString() },
  ];
  return { challenge, participants, steps, announcements, today, now };
}

// Sample themed days, one per weekday (Sunday first).
const THEMES = [
  { title: "Sunday stroll", body: "Take a slow lap somewhere you like. It all counts." },
  { title: "Fresh-start Monday", body: "New week, clean board. Everyone starts at zero on the weekly round." },
  { title: "Stairs Tuesday", body: "Skip the elevator all day. Every flight counts." },
  { title: "Walking rounds Wednesday", body: "Take one set of rounds on foot and invite your team." },
  { title: "Long-way Thursday", body: "Park farther out and take the long way to the unit." },
  { title: "Lake loop Friday", body: "Lunch-break lap on the RiverWalk. Bring a colleague." },
  { title: "Weekend walk", body: "Weekend steps count the same. Get outside." },
];

// Nudge today's steps upward, as the 30-minute sync would.
export function tick(ds, seed = Date.now()) {
  const r = rng(seed);
  const today = minD(ds.today, ds.challenge.end_date);
  if (ds.today < ds.challenge.start_date || ds.today > ds.challenge.end_date) return;
  for (const s of ds.steps) {
    if (s.day === today && r() < 0.35) {
      const add = Math.round(80 + r() * 900);
      s.steps += add; s.distance_m += Math.round(add * 0.74);
    }
  }
}

// ---------------------------------------------------------------- board
// Mirrors public.get_board() in supabase/migrations/20260926000001_board_v2.sql.
function rankBy(rows, key) {
  const sorted = [...rows].sort((a, b) => key(b) - key(a));
  const out = new Map();
  sorted.forEach((row, i) => {
    const prev = sorted[i - 1];
    out.set(row.id, prev && key(prev) === key(row) ? out.get(prev.id) : i + 1);
  });
  return out;
}

export function buildBoard(ds, me = null) {
  const c = ds.challenge;
  const vToday = ds.today;
  const vLast = minD(vToday, c.end_date);
  const status = vToday < c.start_date ? "upcoming" : vToday > c.end_date ? "finished" : "live";
  const mon = mondayOf(vLast);
  const wkStart = maxD(mon, c.start_date);
  const wkEnd = minD(addDays(mon, 6), c.end_date);
  const prevStart = maxD(addDays(mon, -7), c.start_date);
  const thr = c.streak_threshold;

  const active = ds.participants.filter((p) => p.active);
  const activeIds = new Set(active.map((p) => p.id));
  const win = ds.steps.filter((s) => activeIds.has(s.participant_id) && s.day >= c.start_date && s.day <= vLast);
  const byP = new Map(active.map((p) => [p.id, new Map()]));
  for (const s of win) byP.get(s.participant_id).set(s.day, s);

  const per = active.map((p) => {
    const days = byP.get(p.id);
    let total = 0, dist = 0, today = 0, yesterday = 0, week = 0, prev = 0, best = 0, bestPrior = 0, hitWeek = 0;
    for (const [d, s] of days) {
      total += s.steps; dist += s.distance_m;
      if (d === vToday) today += s.steps;
      if (d === addDays(vToday, -1)) yesterday += s.steps;
      if (d >= wkStart && d <= wkEnd) { week += s.steps; if (s.steps >= thr) hitWeek++; }
      if (d >= prevStart && d < wkStart) prev += s.steps;
      best = Math.max(best, s.steps);
      if (d < vToday) bestPrior = Math.max(bestPrior, s.steps);
    }
    const stepsOn = (d) => days.get(d)?.steps ?? 0;
    const anchor = stepsOn(vLast) >= thr ? vLast : addDays(vLast, -1);
    let lastMiss = addDays(c.start_date, -1);
    for (let d = c.start_date; d <= anchor; d = addDays(d, 1)) if (stepsOn(d) < thr) lastMiss = d;
    const streak = Math.max(0, diffDays(anchor, lastMiss));
    const joinedOn = todayIn(c.timezone, new Date(p.joined_at));
    return { id: p.id, name: p.display_name, avatar: p.avatar_url, last_synced_at: p.last_synced_at,
      joined_on: joinedOn, total, distance_m: dist, today, yesterday, week, prev_week: prev,
      best_day: best, best_prior: bestPrior, days_hit_week: hitWeek, streak };
  });

  // Top 3 finishers per past day (rank <= 3 with ties).
  const podiumEver = new Set();
  const byDay = new Map();
  for (const s of win) if (s.steps > 0 && s.day < vToday) (byDay.get(s.day) ?? byDay.set(s.day, []).get(s.day)).push(s);
  for (const list of byDay.values()) {
    const rk = rankBy(list.map((s) => ({ id: s.participant_id, v: s.steps })), (x) => x.v);
    for (const [id, rnk] of rk) if (rnk <= 3) podiumEver.add(id);
  }

  const rank = rankBy(per, (x) => x.total);
  const weekRank = rankBy(per, (x) => x.week);
  const rankY = rankBy(per, (x) => x.total - x.today);
  const rows = per.map((x) => ({
    ...x, rank: rank.get(x.id), week_rank: weekRank.get(x.id), rank_yesterday: rankY.get(x.id),
    badges: [
      x.total > 0 && "first_steps", x.total >= 5e4 && "k50", x.total >= 1e5 && "k100", x.total >= 2.5e5 && "k250",
      x.total >= 5e5 && "k500", x.total >= 1e6 && "m1", x.distance_m >= 42195 && "marathon",
      x.best_day >= 20000 && "day20k", x.streak >= 7 && "streak7", x.streak >= 14 && "streak14",
      podiumEver.has(x.id) && "podium",
    ].filter(Boolean),
  }));
  rows.sort((a, b) => a.rank - b.rank || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  const pub = (x) => ({ rank: x.rank, id: x.id, name: x.name, avatar: x.avatar, total: x.total, today: x.today,
    yesterday: x.yesterday, week: x.week, week_rank: x.week_rank, rank_yesterday: x.rank_yesterday,
    best_day: x.best_day, best_prior: x.best_prior, days_hit_week: x.days_hit_week, streak: x.streak,
    badges: x.badges, joined_on: x.joined_on, last_synced_at: x.last_synced_at });

  const nameOf = new Map(rows.map((x) => [x.id, x]));
  const podium = win.filter((s) => s.day === addDays(vToday, -1) && s.steps > 0)
    .sort((a, b) => b.steps - a.steps).slice(0, 3)
    .map((s) => ({ id: s.participant_id, name: nameOf.get(s.participant_id).name, avatar: nameOf.get(s.participant_id).avatar, steps: s.steps }));

  let movers = [];
  if (wkStart > c.start_date) {
    const dThis = Math.max(1, diffDays(vLast, wkStart) + 1), dPrev = Math.max(1, diffDays(wkStart, prevStart));
    movers = rows.filter((x) => x.prev_week > 0)
      .map((x) => ({ x, raw: x.week / dThis - x.prev_week / dPrev }))
      .sort((a, b) => b.raw - a.raw).slice(0, 3)
      .map(({ x, raw }) => ({ id: x.id, name: x.name, avatar: x.avatar,
        this_week_avg: Math.round(x.week / dThis), last_week_avg: Math.round(x.prev_week / dPrev), delta: Math.round(raw) }))
      .filter((m) => m.delta > 0);
  }

  const daily = [];
  for (let d = c.start_date; d <= vLast; d = addDays(d, 1)) {
    const list = win.filter((s) => s.day === d);
    daily.push({ day: d, steps: list.reduce((a, s) => a + s.steps, 0),
      active: list.filter((s) => s.steps > 0).length, hit: list.filter((s) => s.steps >= thr).length });
  }

  const weekly_champions = [];
  for (let ws = mondayOf(c.start_date); ws <= mondayOf(vLast); ws = addDays(ws, 7)) {
    const from = maxD(ws, c.start_date), to = minD(addDays(ws, 6), c.end_date);
    if (!(to < vToday)) continue;
    const sums = new Map();
    for (const s of win) if (s.day >= from && s.day <= to) sums.set(s.participant_id, (sums.get(s.participant_id) ?? 0) + s.steps);
    const top = [...sums].filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1] || (nameOf.get(a[0]).name < nameOf.get(b[0]).name ? -1 : 1)).slice(0, 3)
      .map(([id, v]) => ({ id, name: nameOf.get(id).name, avatar: nameOf.get(id).avatar, steps: v }));
    weekly_champions.push({ week_start: from, week_end: to, top });
  }

  const meRow = me && nameOf.get(me);
  return {
    generated_at: new Date().toISOString(),
    challenge: {
      name: c.name, tagline: c.tagline, start_date: c.start_date, end_date: c.end_date, timezone: c.timezone,
      today: vToday, status,
      day_number: Math.max(0, diffDays(minD(vToday, c.end_date), c.start_date) + 1),
      days_total: diffDays(c.end_date, c.start_date) + 1,
      days_left: Math.max(0, diffDays(c.end_date, vToday) + (status === "upcoming" ? 1 : 0)),
      streak_threshold: thr, collective_goal_steps: c.collective_goal_steps,
      collective_goal_label: c.collective_goal_label, week_start: wkStart, week_end: wkEnd,
    },
    totals: {
      steps: per.reduce((a, x) => a + x.total, 0), distance_m: per.reduce((a, x) => a + x.distance_m, 0),
      participants: per.length, active_today: per.filter((x) => x.today > 0).length,
    },
    leaderboard: rows.map(pub),
    podium_yesterday: podium,
    movers,
    daily,
    weekly_champions,
    announcements: ds.announcements.filter((a) => a.publish_at <= new Date().toISOString())
      .sort((a, b) => (a.publish_at < b.publish_at ? 1 : -1)).slice(0, 5),
    me: meRow ? { ...pub(meRow) } : null,
  };
}

// The demo viewer: a mid-pack walker with a live streak, so every "you" feature shows.
export function pickDemoMe(board) {
  const lb = board.leaderboard;
  const want = Math.min(lb.length - 1, 38);
  for (let i = want; i < Math.min(lb.length, want + 25); i++) {
    const x = lb[i];
    if (x.streak >= 3 && x.rank_yesterday > x.rank) return x.id;
  }
  return lb[want]?.id ?? null;
}
