// Page-side mechanics computed from get_board. Pure functions, shared by page and TV.
import { PLACES, FACTS } from "./content.js";
import { localDay } from "./util.js";

const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const diff = (a, b) => Math.round((Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 864e5);

export const goalFrac = (b) => Math.min(1, (b.totals.steps || 0) / Math.max(1, b.challenge.collective_goal_steps));
export const hospitalToday = (b) => b.leaderboard.reduce((a, x) => a + (x.today || 0), 0);

// People who were ahead of me at the end of yesterday and are behind me now.
export function passedToday(b, me) {
  if (!me || b.challenge.status !== "live") return { passed: [], passedBy: [] };
  const myPrev = me.total - me.today;
  const passed = [], passedBy = [];
  for (const x of b.leaderboard) {
    if (x.id === me.id) continue;
    const prev = x.total - x.today;
    if (prev > myPrev && x.total < me.total) passed.push(x);
    if (prev < myPrev && x.total > me.total) passedBy.push(x);
  }
  return { passed, passedBy };
}

// Two above and two below me on the whole-challenge board.
export function neighbors(b, me, k = 2) {
  const lb = b.leaderboard;
  const i = lb.findIndex((x) => x.id === me.id);
  if (i < 0) return { rows: [], i };
  const from = Math.max(0, Math.min(i - k, lb.length - (2 * k + 1)));
  return { rows: lb.slice(from, from + 2 * k + 1), i, above: lb[i - 1] || null, below: lb[i + 1] || null };
}

export const isPB = (x) => x && x.today > x.best_prior && x.best_prior > 0 && x.today >= 5000;

// Completed days only (today is partial).
const doneDays = (b) => b.daily.filter((d) => d.day < b.challenge.today);

// Surprise highlight moments: only returned when true.
export function moments(b, landmarks) {
  const out = [];
  const days = doneDays(b);
  const c = b.challenge;
  if (days.length >= 3) {
    const y = days[days.length - 1];
    const earlier = days.slice(0, -1);
    if (y.steps > Math.max(...earlier.map((d) => d.steps)))
      out.push({ key: "record-day", big: y.steps, unit: "steps", title: "Biggest hospital day yet", text: `Yesterday the hospital walked more than on any day so far.` });
    if (y.hit > Math.max(...earlier.map((d) => d.hit)) && y.hit >= 3)
      out.push({ key: "record-hit", big: y.hit, unit: "colleagues", title: `Record day for ${c.streak_threshold.toLocaleString()}+`, text: `More colleagues reached ${c.streak_threshold.toLocaleString()} steps yesterday than on any day so far.` });
  }
  if (landmarks && days.length >= 1) {
    const goal = c.collective_goal_steps;
    const cumY = days.reduce((a, d) => a + d.steps, 0);
    const cumB = cumY - days[days.length - 1].steps;
    const crossed = landmarks.filter((l) => l.start > 0 && cumB / goal < l.start && cumY / goal >= l.start);
    if (crossed.length) {
      const l = crossed[crossed.length - 1];
      out.push({ key: "landmark-" + l.key, big: Math.floor(Math.min(1, cumY / goal) * 100), unit: "% of goal", title: `We reached the ${l.name}`, text: `Yesterday the hospital's steps carried the journey into the ${l.name}.` });
    }
    for (const m of [0.25, 0.5, 0.75, 1]) {
      if (cumB / goal < m && cumY / goal >= m) out.push({ key: "half-" + m, big: m * 100, unit: "%", title: m === 1 ? "Goal reached" : `${m * 100}% of the goal`, text: m === 1 ? "The whole coronary tree is done. Every step from here is extra." : `The hospital passed ${m * 100}% of the goal yesterday.` });
    }
  }
  const joinedWeek = b.leaderboard.filter((x) => x.joined_on && diff(c.today, x.joined_on) < 7).length;
  if (c.status === "live" && joinedWeek >= 3)
    out.push({ key: "joined", big: joinedWeek, unit: "new", title: "New colleagues this week", text: `${joinedWeek} people joined in the last 7 days. It's not too late to start.` });
  return out.slice(0, 3);
}

// Weekly spotlight: recognition beyond the top 3. Distinct people.
export function spotlight(b) {
  const c = b.challenge;
  if (c.status === "upcoming") return [];
  const used = new Set();
  const out = [];
  const daysIn = Math.max(1, diff(c.status === "finished" ? c.week_end : c.today, c.week_start) + 1);
  const consistent = [...b.leaderboard].filter((x) => x.days_hit_week >= Math.min(3, daysIn))
    .sort((a, b2) => b2.days_hit_week - a.days_hit_week || b2.week - a.week)[0];
  if (consistent) { used.add(consistent.id); out.push({ label: "Most consistent", p: consistent, text: `${consistent.days_hit_week} of ${Math.min(7, daysIn)} days at ${c.streak_threshold.toLocaleString()}+ this week` }); }
  const mover = (b.movers || []).find((m) => !used.has(m.id));
  if (mover) { used.add(mover.id); out.push({ label: "Biggest comeback", p: mover, text: `+${mover.delta.toLocaleString()} steps a day vs last week` }); }
  const fresh = b.leaderboard.filter((x) => !used.has(x.id) && x.joined_on > c.start_date && diff(c.today, x.joined_on) <= 10 && x.week > 0)
    .sort((a, b2) => b2.week - a.week)[0];
  if (fresh) out.push({ label: "Rising newcomer", p: fresh, text: `Joined ${diff(c.today, fresh.joined_on) === 0 ? "today" : diff(c.today, fresh.joined_on) + " days ago"}, ${fresh.week.toLocaleString()} steps this week` });
  return out;
}

// Numbers leadership can quote.
export function impact(b) {
  const c = b.challenge;
  const kmTot = (b.totals.distance_m || 0) / 1000;
  const days = doneDays(b);
  const wk1 = days.filter((d) => diff(d.day, c.start_date) < 7);
  const thisWk = days.filter((d) => d.day >= c.week_start);
  const avg = (list) => { const s = list.reduce((a, d) => a + d.steps, 0), p = list.reduce((a, d) => a + d.active, 0); return p ? s / p : 0; };
  const a1 = avg(wk1), aNow = avg(thisWk.length ? thisWk : days.slice(-3));
  return {
    km: kmTot,
    riverwalks: kmTot / PLACES.riverwalkKm,
    lakeLoops: kmTot / PLACES.lakeLoopKm,
    perWalker: aNow,
    change: a1 && thisWk.length && diff(c.week_start, c.start_date) >= 7 ? (aNow - a1) / a1 : null,
    activeToday: b.totals.active_today,
    participants: b.totals.participants,
  };
}

export function announcementsSplit(b) {
  const tz = b.challenge.timezone;
  const today = localDay(tz);
  const shouts = [], news = [];
  for (const a of b.announcements || []) (/^shout[- ]?out/i.test(a.title) ? shouts : news).push(a);
  const theme = news.find((a) => localDay(tz, new Date(a.publish_at)) === today) || null;
  return { shouts, news, theme };
}

export function factOfDay(b) {
  const k = Math.max(0, diff(b.challenge.today, b.challenge.start_date));
  return FACTS[((k % FACTS.length) + FACTS.length) % FACTS.length];
}

export function quizWeek(b) {
  const c = b.challenge;
  if (c.status === "upcoming") return 0;
  const mon = (iso) => addDays(iso, -((new Date(iso + "T00:00:00Z").getUTCDay() + 6) % 7));
  return Math.max(0, Math.floor(diff(mon(c.status === "finished" ? c.end_date : c.today), mon(c.start_date)) / 7));
}
