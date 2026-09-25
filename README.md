# Cardio Step Challenge

Hospital-wide step challenge for the cardiology club.

- **Steps** come from the free Pacer app (phone sensor, Apple Health, Health Connect, Fitbit, Garmin). Participants connect once.
- **Backend** is Supabase project `ipwnyjsbdpzjjdojyebl`: Postgres, three Edge Functions, pg_cron.
- **Page** is static, in `docs/`, served by GitHub Pages. It reads one RPC, `get_board`.

## How it works

1. A participant taps **Connect Pacer** on the page and approves access in Pacer.
2. `auth-callback` saves them, pulls their steps for the whole window, and sends them back to the page.
3. `sync` runs every 30 minutes (last 3 days) and at 08:00 UTC (whole window) for everyone.
4. Manually typed steps are excluded (`accept_manual_input=false`).

Nobody has to do anything daily.

## Organizer tasks

### Set the challenge dates and name

Run in the Supabase SQL editor:

```sql
update public.challenge set
  name = 'Cardio Step Challenge',
  start_date = '2026-10-05',
  end_date   = '2026-11-01',
  timezone   = 'America/New_York',
  collective_goal_steps = 25000000,
  collective_goal_label = 'Hospital goal';
```

### Schedule an announcement

```sql
insert into public.announcements (publish_at, title, body)
values ('2026-10-06 07:00-04', 'Stairs Tuesday', 'Skip the elevator all day.');
```

### Remove a participant from the board

```sql
update public.participants set active = false where display_name = 'Name Here';
```

### Check sync health

```sql
select at, kind, detail from public.event_log order by at desc limit 20;
select display_name, last_synced_at, last_error from public.participants order by last_synced_at nulls first;
```

### Export results at the end

```sql
select p.display_name, sum(d.steps) as total
from public.daily_steps d join public.participants p on p.id = d.participant_id
where d.day between (select start_date from public.challenge) and (select end_date from public.challenge)
group by 1 order by 2 desc;
```

## Deploying changes

The Supabase token for this project lives in `~/.cardio-supabase-token` and sees only this project.

```bash
scripts/sql.sh -f supabase/migrations/<new-file>.sql
SUPABASE_ACCESS_TOKEN=$(tr -d '[:space:]' < ~/.cardio-supabase-token) supabase functions deploy auth-start auth-callback sync --project-ref ipwnyjsbdpzjjdojyebl --use-api
```

`scripts/sql.sh "select ..."` runs any SQL through the Supabase Management API, no database password needed.

The page deploys on every push to `main` (GitHub Pages, `docs/` folder).

## Secrets

Set in the Supabase dashboard under Edge Functions, Secrets:

- Pacer client secret from developer.mypacer.com. Currently stored under the name `pacer developer client secret`; the code also accepts `PACER_CLIENT_SECRET`.

Stored in `public.app_settings` (server-only table): `pacer_client_id`, `sync_secret` (random), `functions_url`, `page_url`.

## Teardown after the event

Export results, then pause or delete the Supabase project and archive the GitHub repo. Participants can also revoke access in the Pacer app.
