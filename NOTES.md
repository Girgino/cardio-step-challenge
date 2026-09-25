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

Added in `20260926000001_board_v2.sql` (additive, same signature):

- per `leaderboard[]` row and in `me`: `yesterday`, `rank_yesterday` (rank by total minus today), `best_prior` (best day before today), `days_hit_week`, `joined_on`. `me` also has `avatar`, `week_rank`, `best_day`, `badges`.
- `daily[]`: hospital totals per day (`steps`, `active`, `hit` = walkers at or above the streak threshold).
- `weekly_champions[]`: top 3 of every finished week (`week_start`, `week_end`, `top[]`).

Badge keys: `first_steps k50 k100 k250 k500 m1 marathon day20k streak7 streak14 podium`.

`tests/board.test.mjs` loads the migrations into PGlite, seeds the `?demo` dataset and checks the SQL output against the JavaScript board in `docs/js/demo.js` (7 scenarios, including 300 walkers). Run it before changing `get_board`.

`me` is saved in localStorage after the OAuth redirect (`?me=<uuid>#joined`). The hash values `#joined #denied #expired #error` drive banners.

## Mechanics (session 2)

Score stays total steps. Everything below sits on top.

| Mechanic | Source |
|---|---|
| Weekly rounds (All / This week), resets Mondays | existing fields |
| Near you: 2 above, you, 2 below, steps to pass the next person | page |
| Streaks at 7,500 with a daily gauge | existing |
| Badges with cardiology names (`BADGES` in `content.js`) | existing keys, page labels |
| Yesterday's top 3, biggest movers | existing |
| Coronary-tree journey for the collective goal (LM → LAD → D1 → D2 → LCx → OM → RCA → AM → PDA) | page |
| Today's theme chip in the hero (latest non-shout-out announcement published today) | page |
| Rank change today (ECG blips; "you passed N colleagues") | SQL `rank_yesterday` |
| Personal best (today beats every earlier day, at least 5,000) | SQL `best_prior` |
| Hall of weeks | SQL `weekly_champions` |
| Hospital moments: record day, record number at 7,500+, landmark or 25/50/75/100% crossed, new joiners; only shown when true | SQL `daily` |
| Cardio levels by total (Resting → Warm-up → Aerobic → Tempo → Threshold → VO₂ max) | page |
| Weekly spotlight: most consistent, biggest comeback, rising newcomer | SQL `days_hit_week`, `joined_on` |
| Unit shout-outs: announcements titled `Shout-out: ...` get their own card | page |
| Cardio fact of the day (sourced), weekly interactive quiz (rhythm strips, guess-the-number, tap-the-artery, myth or fact) | page, answers kept on the phone |
| Hospital impact line for leadership (colleagues moving, km, RiverWalk lengths, laps of Lake Monroe, change since week 1) | page |
| Find someone (name filter) | page |

Not chosen: the streak-at-risk nudge.

## The page (session 2)

Static, no build step. `docs/index.html` loads ES modules from `docs/js/`:

- `app.js` boot, data, 60-second refresh (paused while the tab is hidden). Updates patch the DOM in place, so scroll position, animations and quiz answers survive a refresh.
- `views.js` chapters: hero monitor, your chart or join, board, vitals, rounds, hall of weeks.
- `content.js` all editable copy: levels, badge names, facts, quiz, journey, links.
- `derive.js` page-side mechanics. `signup.js`, `trivia.js`, `tv.js`, `motion.js`, `monitor.js` (ECG sweep), `ecg.js`, `heart.js`, `lake.js` (Lake Monroe outline from OpenStreetMap).
- CDN libraries, pinned with SRI: GSAP 3.15.0 + ScrollTrigger, Lenis 1.3.26. Fonts: Space Grotesk and JetBrains Mono.
- `prefers-reduced-motion` (or `?motion=off`) turns off smooth scrolling, pinning and count-ups.

Look: "night-shift monitor". Light housing with dark monitor panels; follows the phone's light or dark mode; TV always dark. Palette leans on HCA navy; the Cardio Connect LMH mark is original (heart-rhythm line over a Lake Monroe waterline). No HCA logo is used. A slot for the official logo is reserved on the poster footer if marketing provides one.

URLs:

- `/?demo` sample data, 150 made-up walkers, never written anywhere. Scenarios: `?demo=new`, `?demo=joined#joined`, `?demo=upcoming`, `?demo=finished`. A chip at the bottom switches between them.
- `/preview/` short link to `/?demo`, for sharing with the club.
- `/#tv` break-room TV: rotating scenes every 15 seconds (vitals and heart, top 10, this week, yesterday, today's theme and shout-outs, scan to join). Reloads itself every 6 hours. `?scene=<key>` pins one scene.
- `?os=ios` or `?os=android` forces the sign-up instructions for testing.

## Poster (session 2)

`materials/poster/`: `poster-letter.pdf` and `poster-11x17.pdf`. Dates and prize line live in `poster.config.json` ("Dates announced soon" and a placeholder prize line for now). `npm run build` rebuilds both and checks that the QR in each PDF decodes to the site URL. See its README.

## Sign-up flow (built in session 2)

One QR code, one page, two steps. The page detects iPhone or Android.

1. **Get Pacer:** the App Store or Play Store button. The person installs the app, signs in with Apple or Google, and allows Health access.
2. **Connect:** they return to the same browser tab, tap Connect, use the same login method, and approve.

The page remembers which step someone reached, so they can finish later. It takes about 3 minutes.

As built: step 1 shows the App Store or Play button by device (both, plus a QR, on a computer) and says to sign in with Apple or Google before anything else, then allow Health access. Step 2 unlocks after "Done. I'm signed in", has two tick boxes (signed in, allowed Health) that enable Connect, and tells people to pick the same sign-in on the Pacer screen. Returning with `#joined` shows a "You're in" panel above their chart. `#denied`, `#expired`, `#error` show a banner and scroll to step 2. If a joined person still has 0 steps 15 minutes later during a live challenge, their chart shows "Seeing 0 steps?" with the fix.

Supporting tactics:

- Email the link ahead of the poster campaign.
- Staff a sign-up table during launch week.
- The poster promises "one scan, 3 minutes."

**Open risk:** the Pacer app may create an anonymous account on first open. The copy tells people to sign in inside Pacer first and not skip it. The dry run must test a brand-new phone. Also confirm in the dry run: where Pacer's own sign-in lives if it doesn't prompt (the help text says "open your profile"), and whether the Pacer approval page opens inside the Pacer app instead of the browser on iPhone.

## Planned sessions

1. Done: infrastructure.
2. Done: mechanics, page, sign-up flow, TV mode, demo mode and poster.
3. **Launch kit:**
   - real dates and collective goal (update `public.challenge`, `poster.config.json`, rebuild the poster; consider renaming `collective_goal_label` to "Walk the coronary tree")
   - write this week's themed days and shout-outs as announcements
   - review the fact list and quiz answers in `docs/js/content.js` with a cardiologist
   - announcement calendar seeded into the database
   - participant one-pager and email announcement text
   - sign-up table script
   - dry run with 5 people, including one brand-new phone and one Android
   - go-live checklist
   - end-of-event results export, awards and teardown
