// Pacer OpenAPI client. Docs: https://developer.mypacer.com/doc
// Pacer always answers HTTP 200; success/failure is in the JSON body.
import { crypto } from "jsr:@std/crypto@1";
import { encodeHex } from "jsr:@std/encoding@1/hex";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

export const DIALOG_URL = "https://developer.mypacer.com/oauth2/dialog";
const API_HOSTS = ["https://openapi.mypacer.com", "http://openapi.mypacer.com"];
let workingHost: string | null = null;

export function admin(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

export async function settings(db: SupabaseClient): Promise<Record<string, string>> {
  const { data, error } = await db.from("app_settings").select("key,value");
  if (error) throw new Error(`settings: ${error.message}`);
  return Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
}

export async function logEvent(
  db: SupabaseClient, kind: string, detail: unknown, participantId?: string,
) {
  await db.from("event_log").insert({ kind, detail, participant_id: participantId ?? null });
}

async function md5(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("MD5", new TextEncoder().encode(s));
  return encodeHex(new Uint8Array(buf));
}

export async function signature(clientId: string, clientSecret: string) {
  return md5((await md5(clientSecret + "pacer_oauth")) + clientId);
}

export class PacerError extends Error {
  constructor(message: string, public body?: unknown) { super(message); }
}

// deno-lint-ignore no-explicit-any
async function call(path: string, init: RequestInit): Promise<any> {
  const hosts = workingHost ? [workingHost] : API_HOSTS;
  let lastErr: unknown;
  for (const host of hosts) {
    try {
      const res = await fetch(host + path, { ...init, signal: AbortSignal.timeout(20000) });
      const text = await res.text();
      workingHost = host;
      let body: any;
      try { body = JSON.parse(text); } catch {
        throw new PacerError(`non-JSON response (${res.status})`, text.slice(0, 300));
      }
      if (!body?.success) {
        throw new PacerError(body?.error?.message ?? `pacer error status ${body?.status}`, body);
      }
      return body.data;
    } catch (e) {
      if (e instanceof PacerError) throw e;
      lastErr = e; // network/TLS failure: try the next host
    }
  }
  throw new PacerError(`network: ${String(lastErr)}`);
}

export interface TokenSet {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  user_id: string;
}

export async function exchangeCode(clientId: string, clientSecret: string, code: string): Promise<TokenSet> {
  return await call("/oauth2/access_token", {
    method: "POST",
    headers: { Authorization: await signature(clientId, clientSecret), "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, code, grant_type: "authorization_code" }),
  });
}

export async function refreshToken(clientId: string, clientSecret: string, refresh: string): Promise<TokenSet> {
  return await call("/oauth2/access_token", {
    method: "POST",
    headers: { Authorization: await signature(clientId, clientSecret), "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, refresh_token: refresh, grant_type: "refresh_token" }),
  });
}

export async function userInfo(token: string, userId: string) {
  return await call(`/users/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  }) as { user_id: string; display_name?: string; avatar_path?: string };
}

export interface DailyActivity {
  recorded_for_date: string;
  steps?: number;
  total_distance?: number;
  active_time?: number;
  source?: string;
  recorded_by?: string;
}

export async function dailyActivities(token: string, userId: string, start: string, end: string) {
  const q = new URLSearchParams({ start_date: start, end_date: end, accept_manual_input: "false" });
  const data = await call(`/users/${encodeURIComponent(userId)}/activities/daily.json?${q}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  return (data?.daily_activities ?? []) as DailyActivity[];
}

// ---------------------------------------------------------------- dates
export function todayIn(tz: string): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
}
export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const maxIso = (a: string, b: string) => (a > b ? a : b);
const minIso = (a: string, b: string) => (a < b ? a : b);

export interface Challenge { start_date: string; end_date: string; timezone: string }

/** Date range to pull. "recent" = last 3 days; "full" = whole window (max 31 days back). */
export function syncRange(c: Challenge, mode: "recent" | "full"): [string, string] {
  const today = todayIn(c.timezone);
  const oldestAllowed = addDays(today, -30);
  if (mode === "recent") return [addDays(today, -2), today];
  const end = minIso(today, c.end_date);
  let start = maxIso(c.start_date, oldestAllowed);
  if (start > end) start = addDays(end, -6); // before launch: still pull a week for testing
  return [maxIso(start, oldestAllowed), end];
}

// ---------------------------------------------------------------- one participant
export interface SyncContext {
  db: SupabaseClient;
  clientId: string;
  clientSecret: string;
  challenge: Challenge;
}

/** Refresh token if needed, pull days, upsert. Returns number of days written. */
export async function syncParticipant(
  ctx: SyncContext,
  p: { id: string; pacer_user_id: string },
  mode: "recent" | "full",
): Promise<number> {
  const { db } = ctx;
  const { data: tok, error: tokErr } = await db.from("participant_tokens")
    .select("access_token,refresh_token,expires_at").eq("participant_id", p.id).single();
  if (tokErr || !tok) throw new Error("no token on file");

  let access = tok.access_token as string;
  const expiresAt = new Date(tok.expires_at).getTime();
  if (expiresAt - Date.now() < 2 * 3600 * 1000) {
    if (!tok.refresh_token) throw new Error("token expired and no refresh token");
    const t = await refreshToken(ctx.clientId, ctx.clientSecret, tok.refresh_token);
    access = t.access_token;
    await db.from("participant_tokens").update({
      access_token: t.access_token,
      refresh_token: t.refresh_token ?? tok.refresh_token,
      expires_at: new Date(Date.now() + (t.expires_in ?? 86400) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("participant_id", p.id);
  }

  const [start, end] = syncRange(ctx.challenge, mode);
  const days = await dailyActivities(access, p.pacer_user_id, start, end);
  const rows = days
    .filter((d) => d.recorded_for_date)
    .map((d) => ({
      participant_id: p.id,
      day: d.recorded_for_date.slice(0, 10),
      steps: Math.max(0, Math.round(d.steps ?? 0)),
      distance_m: Math.max(0, Math.round(d.total_distance ?? 0)),
      active_time_s: Math.max(0, Math.round(d.active_time ?? 0)),
      source: d.source ?? d.recorded_by ?? null,
      fetched_at: new Date().toISOString(),
    }));
  if (rows.length) {
    const { error } = await db.from("daily_steps").upsert(rows, { onConflict: "participant_id,day" });
    if (error) throw new Error(`upsert: ${error.message}`);
  }
  await db.from("participants").update({
    last_synced_at: new Date().toISOString(), last_error: null,
  }).eq("id", p.id);
  return rows.length;
}
