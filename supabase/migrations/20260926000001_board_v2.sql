-- get_board v2: additive fields for the engagement mechanics.
--   leaderboard[] and me: yesterday, rank_yesterday, best_prior, days_hit_week, joined_on
--   me also gains: avatar, week_rank, best_day, badges
--   daily[]:            hospital total per day (steps, active, hit)
--   weekly_champions[]: top 3 of every finished week
-- Signature, grants and security settings are unchanged.

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
    select p.id, p.display_name, p.avatar_url, p.last_synced_at,
      (p.joined_at at time zone c.timezone)::date                          as joined_on,
      coalesce(sum(w.steps), 0)::bigint                                   as total,
      coalesce(sum(w.distance_m), 0)::bigint                              as distance_m,
      coalesce(sum(w.steps) filter (where w.day = v_today), 0)::bigint    as today,
      coalesce(sum(w.steps) filter (where w.day = v_today - 1), 0)::bigint as yesterday,
      coalesce(sum(w.steps) filter (where w.day between v_wk_start and v_wk_end), 0)::bigint as week,
      coalesce(sum(w.steps) filter (where w.day between v_prev_start and v_wk_start - 1), 0)::bigint as prev_week,
      coalesce(max(w.steps), 0)                                           as best_day,
      coalesce(max(w.steps) filter (where w.day < v_today), 0)            as best_prior,
      count(*) filter (where w.day between v_wk_start and v_wk_end
                         and w.steps >= c.streak_threshold)::int          as days_hit_week
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
      rank() over (order by per.total desc)             as rank,
      rank() over (order by per.week desc)              as week_rank,
      rank() over (order by per.total - per.today desc) as rank_yesterday,
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
  ),
  weeks as (
    select greatest(g.ws::date, c.start_date) as w_from,
           least(g.ws::date + 6, c.end_date)  as w_to
    from generate_series(date_trunc('week', c.start_date::timestamp),
                         date_trunc('week', v_last::timestamp), interval '7 days') g(ws)
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
        'total', b.total, 'today', b.today, 'yesterday', b.yesterday,
        'week', b.week, 'week_rank', b.week_rank, 'rank_yesterday', b.rank_yesterday,
        'best_day', b.best_day, 'best_prior', b.best_prior, 'days_hit_week', b.days_hit_week,
        'streak', b.streak, 'badges', b.badges, 'joined_on', b.joined_on,
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
    'daily', coalesce((select jsonb_agg(jsonb_build_object(
        'day', g.d::date,
        'steps', coalesce((select sum(w.steps) from win w where w.day = g.d::date), 0),
        'active', (select count(*) from win w where w.day = g.d::date and w.steps > 0),
        'hit', (select count(*) from win w where w.day = g.d::date and w.steps >= c.streak_threshold))
        order by g.d)
      from generate_series(c.start_date::timestamp, v_last::timestamp, interval '1 day') g(d)), '[]'::jsonb),
    'weekly_champions', coalesce((select jsonb_agg(jsonb_build_object(
        'week_start', wk.w_from, 'week_end', wk.w_to,
        'top', coalesce((select jsonb_agg(t.x order by t.s desc, t.n) from (
            select jsonb_build_object('id', p.id, 'name', p.display_name, 'avatar', p.avatar_url,
                     'steps', sum(w.steps)) x, sum(w.steps) s, p.display_name n
            from win w join public.participants p on p.id = w.participant_id
            where w.day between wk.w_from and wk.w_to
            group by p.id having sum(w.steps) > 0
            order by sum(w.steps) desc, p.display_name limit 3) t), '[]'::jsonb))
        order by wk.w_from)
      from weeks wk where wk.w_to < v_today), '[]'::jsonb),
    'announcements', coalesce((select jsonb_agg(jsonb_build_object(
        'title', a.title, 'body', a.body, 'publish_at', a.publish_at) order by a.publish_at desc)
      from (select * from public.announcements where publish_at <= now()
            order by publish_at desc limit 5) a), '[]'::jsonb),
    'me', (select jsonb_build_object('id', b.id, 'rank', b.rank, 'name', b.display_name,
             'avatar', b.avatar_url, 'total', b.total, 'today', b.today, 'yesterday', b.yesterday,
             'week', b.week, 'week_rank', b.week_rank, 'rank_yesterday', b.rank_yesterday,
             'best_day', b.best_day, 'best_prior', b.best_prior, 'days_hit_week', b.days_hit_week,
             'streak', b.streak, 'badges', b.badges, 'joined_on', b.joined_on,
             'last_synced_at', b.last_synced_at)
           from badged b where b.id = me)
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_board(uuid) from public;
grant execute on function public.get_board(uuid) to anon, authenticated;
