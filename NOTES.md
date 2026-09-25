# Project notes and decisions

Context for future work sessions. The runbook is in README.md.

## Decisions (with the club)

- **Scoring:** total steps only. The team chose simplicity. Engagement mechanics sit on top without changing the score.
- **Teams:** none. Individual leaderboard.
- **Identity:** Pacer display name and avatar. No extra sign-up fields.
- **Dates:** not decided. Placeholder window is in `public.challenge`.
- **Audience:** hospital-wide. Expect 100 to 200 participants, maximum about 300. Mostly phones; one break-room TV.
- **Isolation:** fully independent from the organizer's other projects. Use only `~/.cardio-supabase-token` and `scripts/sql.sh`.

## Verified in the infrastructure session (2026-09-24)

- Pacer OAuth, backfill, 30-minute cron sync, token refresh and per-participant failure isolation all work with a real account.
- Anon can call only `get_board`; every table is blocked.
- Supabase serves HTML as text/plain on its free domain, so the page lives on GitHub Pages.

## Findings that shape the launch

- **History limit:** Pacer returned only about 8 days before the organizer's install, even though the window asked for 15. Late joiners likely lose early days. Push everyone to connect before the start date, with a "join by day 3" deadline.
- **Login method:** participants must log in on our page the same way they signed up in the Pacer app (Apple, Google, Facebook or email). A different method creates an empty Pacer account.
- **Sources:** past days arrive tagged `Apple Health`; today's partial day arrives as `Pacer`.

## Data contract for the page

The page makes one call, repeated every 60 seconds:

`POST {SUPABASE_URL}/rest/v1/rpc/get_board` with header `apikey: <publishable key>` and body `{"me": "<participant uuid or null>"}`.

The response contains:

- `challenge`: name, tagline, dates, timezone, status (upcoming, live, finished), day number and total, days left, streak threshold, collective goal and its label, and this week's range.
- `totals`: steps, distance in meters, participants, active today.
- `leaderboard[]`: rank, id, name, avatar, total, today, week, week rank, best day, streak and badges.
- `podium_yesterday[]`: the top 3 from yesterday.
- `movers[]`: the biggest week-over-week gains in daily average.
- `announcements[]`: messages whose publish time has passed.
- `me`: the viewer's own row, or null.

Badge keys: `first_steps k50 k100 k250 k500 m1 marathon day20k streak7 streak14 podium`.

`me` is saved in localStorage after the OAuth redirect (`?me=<uuid>#joined`). The hash values `#joined #denied #expired #error` drive banners.

## Sign-up flow (agreed direction)

One QR code, one page, two steps. The page detects iPhone or Android.

1. **Get Pacer:** the App Store or Play Store button. The person installs the app, signs in with Apple or Google, and allows Health access.
2. **Connect:** they return to the same browser tab, tap Connect, use the same login method, and approve.

The page remembers which step someone reached, so they can finish later. It takes about 3 minutes.

Supporting tactics:

- Email the link ahead of the poster campaign.
- Staff a sign-up table during launch week.
- The poster promises "one scan, 3 minutes."

**Open risk:** the Pacer app may create an anonymous account on first open. The dry run must test a brand-new phone.

## Planned sessions

1. Done: infrastructure.
2. **Mechanics, page, sign-up flow and poster:** brainstorm and flesh out mechanics; design the immersive, scroll-driven page, including the guided two-step sign-up; design the QR poster in the same visual identity.
3. **Launch kit:**
   - real dates and collective goal
   - announcement calendar seeded into the database
   - participant one-pager and email announcement text
   - sign-up table script
   - dry run with 5 people, including one brand-new phone and one Android
   - go-live checklist
   - end-of-event results export, awards and teardown
