// GET /auth-start -> 302 to Pacer's consent screen with a fresh state nonce.
import { admin, DIALOG_URL, settings } from "../_shared/pacer.ts";

Deno.serve(async () => {
  const db = admin();
  const s = await settings(db);
  const state = crypto.randomUUID();
  await db.from("oauth_states").insert({ state });
  const url = new URL(DIALOG_URL);
  url.searchParams.set("client_id", s.pacer_client_id);
  url.searchParams.set("redirect_uri", `${s.functions_url}/auth-callback`);
  url.searchParams.set("state", state);
  return new Response(null, { status: 302, headers: { Location: url.toString(), "Cache-Control": "no-store" } });
});
