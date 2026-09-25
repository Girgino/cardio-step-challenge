-- Cardio Step Challenge: core schema.
-- Everything is RLS-locked. The public page reads only through get_board().

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- ---------------------------------------------------------------- settings
-- Server-only key/value settings (client id, sync secret, URLs).
create table public.app_settings (
  key   text primary key,
  value text not null
);
alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;

insert into public.app_settings (key, value) values
  ('sync_secret',     encode(extensions.gen_random_bytes(24), 'hex')),
  ('functions_url',   'https://ipwnyjsbdpzjjdojyebl.supabase.co/functions/v1'),
  ('page_url',        'https://lmhstepchallenge.github.io/'),
  ('pacer_client_id', 'SET_ME');

-- ---------------------------------------------------------------- challenge
create table public.challenge (
  id                     int primary key default 1 check (id = 1),
  name                   text not null default 'Cardio Step Challenge',
  tagline                text not null default 'Every step counts. Literally.',
  start_date             date not null,
  end_date               date not null,
  timezone               text not null default 'America/New_York',
  streak_threshold       int  not null default 7500,
  collective_goal_steps  bigint not null default 25000000,
  collective_goal_label  text not null default 'Hospital goal',
  check (end_date >= start_date)
);
alter table public.challenge enable row level security;
revoke all on public.challenge from anon, authenticated;

-- Placeholder window until real dates are chosen: last 14 days + next 14.
insert into public.challenge (start_date, end_date)
values (current_date - 14, current_date + 14);

-- ---------------------------------------------------------------- people
create table public.participants (
  id             uuid primary key default gen_random_uuid(),
  pacer_user_id  text not null unique,
  display_name   text not null default 'Walker',
  avatar_url     text,
  joined_at      timestamptz not null default now(),
  active         boolean not null default true,
  last_synced_at timestamptz,
  last_error     text
);
alter table public.participants enable row level security;
revoke all on public.participants from anon, authenticated;

create table public.participant_tokens (
  participant_id uuid primary key references public.participants(id) on delete cascade,
  access_token   text not null,
  refresh_token  text,
  expires_at     timestamptz not null,
  updated_at     timestamptz not null default now()
);
alter table public.participant_tokens enable row level security;
revoke all on public.participant_tokens from anon, authenticated;

create table public.daily_steps (
  participant_id uuid not null references public.participants(id) on delete cascade,
  day            date not null,
  steps          int  not null default 0,
  distance_m     int  not null default 0,
  active_time_s  int  not null default 0,
  source         text,
  fetched_at     timestamptz not null default now(),
  primary key (participant_id, day)
);
alter table public.daily_steps enable row level security;
revoke all on public.daily_steps from anon, authenticated;
create index daily_steps_day_idx on public.daily_steps (day);

create table public.announcements (
  id         bigint generated always as identity primary key,
  publish_at timestamptz not null,
  title      text not null,
  body       text not null default ''
);
alter table public.announcements enable row level security;
revoke all on public.announcements from anon, authenticated;

create table public.oauth_states (
  state      text primary key,
  created_at timestamptz not null default now()
);
alter table public.oauth_states enable row level security;
revoke all on public.oauth_states from anon, authenticated;

-- Diagnostics (no tokens are ever written here).
create table public.event_log (
  id             bigint generated always as identity primary key,
  at             timestamptz not null default now(),
  kind           text not null,
  participant_id uuid,
  detail         jsonb
);
alter table public.event_log enable row level security;
revoke all on public.event_log from anon, authenticated;

-- ---------------------------------------------------------------- board
-- One call returns everything the page shows.
create or replace function public.get_board(me uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c          public.challenge;
  v_today    date;
  v_last     date;   -- last counted day (today, capped at end_date)
  v_wk_start date;
  v_wk_end   date;
  v_prev_start date;
  v_status   text;
  result     jsonb;
begin
  select * into c from public.challenge where id = 1;
  v_today := (now() at time zone c.timezone)::date;
  v_last  := least(v_today, c.end_date);
  v_status := case when v_today < c.start_date then 'upcoming'
                   when v_today > c.end_date  then 'finished'
                   else 'live' end;
  v_wk_start := greatest(date_trunc('week', v_last)::date, c.start_date);
  v_wk_end   := least(date_trunc('week', v_last)::date + 6, c.end_date);
  v_prev_start := greatest(date_trunc('week', v_last)::date - 7, c.start_date);

  with win as (
    select d.* from public.daily_steps d
    join public.participants p on p.id = d.participant_id and p.active
    where d.day between c.start_date and v_last
  ),
  per as (
    select p.id, p.display_name, p.avatar_url, p.joined_at, p.last_synced_at,
      coalesce(sum(w.steps), 0)::bigint                                   as total,
      coalesce(sum(w.distance_m), 0)::bigint                              as distance_m,
      coalesce(sum(w.steps) filter (where w.day = v_today), 0)::bigint    as today,
      coalesce(sum(w.steps) filter (where w.day between v_wk_start and v_wk_end), 0)::bigint as week,
      coalesce(sum(w.steps) filter (where w.day between v_prev_start and v_wk_start - 1), 0)::bigint as prev_week,
      coalesce(max(w.steps), 0)                                           as best_day
    from public.participants p
    left join win w on w.participant_id = p.id
    where p.active
    group by p.id
  ),
  -- Streak: consecutive days at/above threshold, ending today if today already
  -- counts, otherwise ending yesterday (so the streak is not "lost" mid-day).
  anchors as (
    select p.id,
      case when coalesce((select w.steps from win w where w.participant_id = p.id and w.day = v_last), 0)
                >= c.streak_threshold then v_last else v_last - 1 end as anchor
    from per p
  ),
  streaks as (
    select a.id,
      greatest(0, a.anchor - coalesce((
        select max(g.d::date)
        from generate_series(c.start_date::timestamp, a.anchor::timestamp, interval '1 day') g(d)
        left join win w on w.participant_id = a.id and w.day = g.d::date
        where coalesce(w.steps, 0) < c.streak_threshold), c.start_date - 1)) as streak
    from anchors a
  ),
  daily_rank as (
    select participant_id, day, rank() over (partition by day order by steps desc) as r
    from win where steps > 0
  ),
  ranked as (
    select per.*, s.streak,
      rank() over (order by per.total desc) as rank,
      rank() over (order by per.week desc)  as week_rank,
      (select count(*) > 0 from daily_rank dr where dr.participant_id = per.id and dr.r <= 3 and dr.day < v_today) as podium_ever
    from per join streaks s using (id)
  ),
  badged as (
    select r.*,
      to_jsonb(array_remove(array[
        case when r.total > 0              then 'first_steps' end,
        case when r.total >= 50000         then 'k50' end,
        case when r.total >= 100000        then 'k100' end,
        case when r.total >= 250000        then 'k250' end,
        case when r.total >= 500000        then 'k500' end,
        case when r.total >= 1000000       then 'm1' end,
        case when r.distance_m >= 42195    then 'marathon' end,
        case when r.best_day >= 20000      then 'day20k' end,
        case when r.streak >= 7            then 'streak7' end,
        case when r.streak >= 14           then 'streak14' end,
        case when r.podium_ever            then 'podium' end
      ], null)) as badges
    from ranked r
  )
  select jsonb_build_object(
    'generated_at', now(),
    'challenge', jsonb_build_object(
      'name', c.name, 'tagline', c.tagline,
      'start_date', c.start_date, 'end_date', c.end_date, 'timezone', c.timezone,
      'today', v_today, 'status', v_status,
      'day_number', greatest(0, least(v_today, c.end_date) - c.start_date + 1),
      'days_total', c.end_date - c.start_date + 1,
      'days_left', greatest(0, c.end_date - v_today + (case when v_status = 'upcoming' then 1 else 0 end)),
      'streak_threshold', c.streak_threshold,
      'collective_goal_steps', c.collective_goal_steps,
      'collective_goal_label', c.collective_goal_label,
      'week_start', v_wk_start, 'week_end', v_wk_end),
    'totals', jsonb_build_object(
      'steps', (select coalesce(sum(total), 0) from per),
      'distance_m', (select coalesce(sum(distance_m), 0) from per),
      'participants', (select count(*) from per),
      'active_today', (select count(*) from per where today > 0)),
    'leaderboard', coalesce((select jsonb_agg(jsonb_build_object(
        'rank', b.rank, 'id', b.id, 'name', b.display_name, 'avatar', b.avatar_url,
        'total', b.total, 'today', b.today, 'week', b.week, 'week_rank', b.week_rank,
        'best_day', b.best_day, 'streak', b.streak, 'badges', b.badges,
        'last_synced_at', b.last_synced_at) order by b.rank, b.display_name)
      from badged b), '[]'::jsonb),
    'podium_yesterday', coalesce((select jsonb_agg(x order by (x->>'steps')::int desc) from (
        select jsonb_build_object('id', p.id, 'name', p.display_name, 'avatar', p.avatar_url, 'steps', w.steps) x
        from win w join public.participants p on p.id = w.participant_id
        where w.day = v_today - 1 and w.steps > 0
        order by w.steps desc limit 3) t), '[]'::jsonb),
    'movers', case when v_wk_start > c.start_date then coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('id', b.id, 'name', b.display_name, 'avatar', b.avatar_url,
          'this_week_avg', round(b.week::numeric / greatest(1, v_last - v_wk_start + 1)),
          'last_week_avg', round(b.prev_week::numeric / greatest(1, v_wk_start - v_prev_start)),
          'delta', round(b.week::numeric / greatest(1, v_last - v_wk_start + 1)
                       - b.prev_week::numeric / greatest(1, v_wk_start - v_prev_start))) x
        from badged b where b.prev_week > 0
        order by (b.week::numeric / greatest(1, v_last - v_wk_start + 1)
                - b.prev_week::numeric / greatest(1, v_wk_start - v_prev_start)) desc
        limit 3) t where (x->>'delta')::numeric > 0), '[]'::jsonb) else '[]'::jsonb end,
    'announcements', coalesce((select jsonb_agg(jsonb_build_object(
        'title', a.title, 'body', a.body, 'publish_at', a.publish_at) order by a.publish_at desc)
      from (select * from public.announcements where publish_at <= now()
            order by publish_at desc limit 5) a), '[]'::jsonb),
    'me', (select jsonb_build_object('id', b.id, 'rank', b.rank, 'name', b.display_name,
             'total', b.total, 'today', b.today, 'week', b.week, 'streak', b.streak,
             'last_synced_at', b.last_synced_at)
           from badged b where b.id = me)
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_board(uuid) from public;
grant execute on function public.get_board(uuid) to anon, authenticated;

-- ---------------------------------------------------------------- schedules
create or replace function public.trigger_sync(mode text)
returns bigint
language sql
security definer
set search_path = ''
as $$
  select net.http_post(
    url     := (select value from public.app_settings where key = 'functions_url') || '/sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', (select value from public.app_settings where key = 'sync_secret')),
    body    := jsonb_build_object('mode', mode),
    timeout_milliseconds := 10000);
$$;
revoke all on function public.trigger_sync(text) from public, anon, authenticated;

select cron.schedule('steps-sync-recent', '*/30 * * * *', $$select public.trigger_sync('recent')$$);
select cron.schedule('steps-sync-full',   '0 8 * * *',    $$select public.trigger_sync('full')$$);
select cron.schedule('oauth-state-cleanup', '17 * * * *',
  $$delete from public.oauth_states where created_at < now() - interval '1 hour'$$);
select cron.schedule('event-log-cleanup', '23 4 * * *',
  $$delete from public.event_log where at < now() - interval '14 days'$$);
