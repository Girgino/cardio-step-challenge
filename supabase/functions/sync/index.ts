// POST /sync {mode: "recent" | "full"} with header x-sync-secret.
// Called by pg_cron. Returns 202 at once and keeps working in the background.
import { admin, getClientSecret, logEvent, settings, syncParticipant } from "../_shared/pacer.ts";

const CONCURRENCY = 8;

async function runSync(mode: "recent" | "full", only?: string) {
  const db = admin();
  const s = await settings(db);
  const clientSecret = getClientSecret()!;
  const { data: challenge } = await db.from("challenge").select("start_date,end_date,timezone").single();
  let query = db.from("participants").select("id,pacer_user_id").eq("active", true);
  if (only) query = query.eq("id", only);
  const { data: people } = await query;
  const ctx = { db, clientId: s.pacer_client_id, clientSecret, challenge: challenge! };

  const started = Date.now();
  let ok = 0, failed = 0, rows = 0;
  const queue = [...(people ?? [])];
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    for (let p = queue.shift(); p; p = queue.shift()) {
      try {
        rows += await syncParticipant(ctx, p, mode);
        ok++;
      } catch (e) {
        failed++;
        await db.from("participants").update({ last_error: String(e).slice(0, 500) }).eq("id", p.id);
      }
    }
  }));
  await logEvent(db, "sync", { mode, ok, failed, rows, ms: Date.now() - started });
}

Deno.serve(async (req) => {
  const db = admin();
  const s = await settings(db);
  if (req.headers.get("x-sync-secret") !== s.sync_secret) {
    return new Response("forbidden", { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  if (body.mode === "check") {
    return Response.json({
      pacer_secret_present: !!getClientSecret(),
      pacer_client_id_set: !!s.pacer_client_id && s.pacer_client_id !== "SET_ME",
    });
  }
  const mode = body.mode === "full" ? "full" : "recent";
  const task = runSync(mode, body.participant_id);
  // deno-lint-ignore no-explicit-any
  const rt = (globalThis as any).EdgeRuntime;
  if (rt?.waitUntil) {
    rt.waitUntil(task);
    return new Response(JSON.stringify({ accepted: true, mode }), { status: 202 });
  }
  await task;
  return new Response(JSON.stringify({ done: true, mode }), { status: 200 });
});
