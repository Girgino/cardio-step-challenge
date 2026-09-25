// Checks public.get_board() (SQL) against the JavaScript board in docs/js/demo.js,
// using an in-memory Postgres (PGlite). Run: cd tests && npm install && npm test
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";
import { makeDataset, buildBoard, pickDemoMe } from "../docs/js/demo.js";

const mig = new URL("../supabase/migrations/", import.meta.url);
const init = readFileSync(new URL("20260924000001_init.sql", mig), "utf8")
  .split("-- ---------------------------------------------------------------- schedules")[0]
  .replace(/^create extension.*$/gm, "")
  .replace("extensions.gen_random_bytes(24)", "'x'::bytea");
const later = readdirSync(mig).filter((f) => f > "20260925000001_lock_rls_helper.sql" && f.endsWith(".sql")).sort();

async function freshDb() {
  const db = await PGlite.create();
  await db.exec("create role anon; create role authenticated;");
  await db.exec(init);
  for (const f of later) await db.exec(readFileSync(new URL(f, mig), "utf8"));
  return db;
}

async function load(db, ds) {
  const c = ds.challenge;
  await db.query(`update public.challenge set start_date=$1, end_date=$2, timezone=$3, streak_threshold=$4,
    collective_goal_steps=$5, collective_goal_label=$6 where id=1`,
    [c.start_date, c.end_date, c.timezone, c.streak_threshold, c.collective_goal_steps, c.collective_goal_label]);
  await db.query(`insert into public.participants (id, pacer_user_id, display_name, avatar_url, joined_at, active, last_synced_at)
    select id, id::text, display_name, avatar_url, joined_at, active, last_synced_at
    from jsonb_to_recordset($1::jsonb) as x(id uuid, display_name text, avatar_url text, joined_at timestamptz, active bool, last_synced_at timestamptz)`,
    [JSON.stringify(ds.participants)]);
  await db.query(`insert into public.daily_steps (participant_id, day, steps, distance_m)
    select * from jsonb_to_recordset($1::jsonb) as x(participant_id uuid, day date, steps int, distance_m int)`,
    [JSON.stringify(ds.steps)]);
}

const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o[k]]));
const ROW = ["rank", "id", "name", "total", "today", "yesterday", "week", "week_rank", "rank_yesterday",
  "best_day", "best_prior", "days_hit_week", "streak", "joined_on"];
const num = (o) => JSON.parse(JSON.stringify(o), (k, v) => (typeof v === "string" && /^-?\d+$/.test(v) ? Number(v) : v));

async function check(label, opts) {
  const db = await freshDb();
  const ds = makeDataset({ alignMonday: false, ...opts });
  await load(db, ds);
  const js0 = buildBoard(ds);
  const me = pickDemoMe(js0);
  const js = buildBoard(ds, me);
  const { rows } = await db.query("select public.get_board($1::uuid) as b", [me]);
  const sql = num(rows[0].b);

  const cKeys = ["start_date", "end_date", "today", "status", "day_number", "days_total", "days_left", "week_start", "week_end"];
  assert.deepEqual(pick(sql.challenge, cKeys), pick(js.challenge, cKeys), `${label}: challenge`);
  assert.deepEqual(sql.totals, js.totals, `${label}: totals`);
  const byId = new Map(sql.leaderboard.map((r) => [r.id, r]));
  assert.equal(sql.leaderboard.length, js.leaderboard.length, `${label}: leaderboard length`);
  for (const r of js.leaderboard) {
    const s = byId.get(r.id);
    assert.deepEqual(pick(s, ROW), pick(r, ROW), `${label}: row ${r.name}`);
    assert.deepEqual([...s.badges].sort(), [...r.badges].sort(), `${label}: badges ${r.name}`);
  }
  assert.deepEqual(sql.daily, js.daily, `${label}: daily`);
  assert.deepEqual(sql.weekly_champions.map((w) => [w.week_start, w.week_end, w.top.map((t) => t.steps)]),
    js.weekly_champions.map((w) => [w.week_start, w.week_end, w.top.map((t) => t.steps)]), `${label}: weekly champions`);
  assert.deepEqual(sql.podium_yesterday.map((p) => p.steps), js.podium_yesterday.map((p) => p.steps), `${label}: podium`);
  assert.deepEqual(sql.movers.map((m) => [m.id, m.delta]), js.movers.map((m) => [m.id, m.delta]), `${label}: movers`);
  if (me) assert.deepEqual(pick(sql.me, ROW), pick(js.me, ROW), `${label}: me`);
  else assert.equal(sql.me, null);
  const nullMe = num((await db.query("select public.get_board(null) as b")).rows[0].b);
  assert.equal(nullMe.me, null, `${label}: null me`);
  console.log(`ok  ${label}  (${js.leaderboard.length} walkers, ${js.daily.length} days, ${js.weekly_champions.length} finished weeks, me rank ${js.me?.rank ?? "-"})`);
  await db.close();
}

await check("live day 12", { state: "live", dayNumber: 12 });
await check("live day 1", { state: "live", dayNumber: 1, seed: 11 });
await check("live day 7", { state: "live", dayNumber: 7, seed: 12 });
await check("live day 20", { state: "live", dayNumber: 20, seed: 13, n: 300 });
await check("live day 28", { state: "live", dayNumber: 28, seed: 14 });
await check("finished", { state: "finished", seed: 15 });
await check("upcoming", { state: "upcoming", seed: 16 });
console.log("all checks passed");
