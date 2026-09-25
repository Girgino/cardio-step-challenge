// GET /auth-callback?code=&state=&auth_result= (Pacer redirect target).
// Exchanges the code, saves the participant, backfills steps, returns to the page.
import {
  admin, exchangeCode, getClientSecret, logEvent, settings, syncParticipant, userInfo,
} from "../_shared/pacer.ts";

Deno.serve(async (req) => {
  const db = admin();
  const s = await settings(db);
  const page = s.page_url;
  const back = (hash: string, me?: string) =>
    new Response(null, {
      status: 302,
      headers: {
        Location: `${page}${me ? `?me=${me}` : ""}#${hash}`,
        "Cache-Control": "no-store",
      },
    });

  const q = new URL(req.url).searchParams;
  const code = q.get("code");
  const state = q.get("state");
  const result = q.get("auth_result");

  try {
    if (result === "fail" || !code) {
      await logEvent(db, "auth_denied", { result });
      return back("denied");
    }
    const { data: st } = await db.from("oauth_states").delete().eq("state", state ?? "").select("created_at");
    if (!st?.length || Date.now() - new Date(st[0].created_at).getTime() > 30 * 60 * 1000) {
      await logEvent(db, "auth_bad_state", { state });
      return back("expired");
    }

    const clientSecret = getClientSecret();
    if (!clientSecret) throw new Error("PACER_CLIENT_SECRET not set");
    const tok = await exchangeCode(s.pacer_client_id, clientSecret, code);
    const userId = String(tok.user_id);

    let name = "Walker";
    let avatar: string | null = null;
    try {
      const u = await userInfo(tok.access_token, userId);
      name = (u.display_name ?? "").trim() || name;
      avatar = u.avatar_path || null;
    } catch (e) {
      await logEvent(db, "userinfo_failed", { message: String(e) });
    }

    const { data: p, error: pErr } = await db.from("participants").upsert(
      { pacer_user_id: userId, display_name: name, avatar_url: avatar, active: true, last_error: null },
      { onConflict: "pacer_user_id" },
    ).select("id,pacer_user_id").single();
    if (pErr || !p) throw new Error(`participant upsert: ${pErr?.message}`);

    const { error: tErr } = await db.from("participant_tokens").upsert({
      participant_id: p.id,
      access_token: tok.access_token,
      refresh_token: tok.refresh_token ?? null,
      expires_at: new Date(Date.now() + (tok.expires_in ?? 86400) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (tErr) throw new Error(`token upsert: ${tErr.message}`);

    const { data: challenge } = await db.from("challenge").select("start_date,end_date,timezone").single();
    let days = 0;
    try {
      days = await syncParticipant({ db, clientId: s.pacer_client_id, clientSecret, challenge: challenge! }, p, "full");
    } catch (e) {
      await db.from("participants").update({ last_error: String(e) }).eq("id", p.id);
      await logEvent(db, "backfill_failed", { message: String(e) }, p.id);
    }
    await logEvent(db, "joined", {
      days, has_refresh: !!tok.refresh_token, expires_in: tok.expires_in, got_name: name !== "Walker",
    }, p.id);
    return back("joined", p.id);
  } catch (e) {
    // deno-lint-ignore no-explicit-any
    await logEvent(db, "auth_error", { message: String(e), body: (e as any)?.body ?? null });
    return back("error");
  }
});
