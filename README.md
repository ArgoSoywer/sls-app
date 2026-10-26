# Solo Leveling System

A single-player, offline-first habit tracker built with Next.js, TypeScript, Tailwind CSS, Framer Motion, React Three Fiber, and Supabase.

## Run locally

```powershell
npm install
npm run dev
```

Without Supabase environment variables, the app runs as a local profile using IndexedDB. Tasks and XP persist in this browser. To enable server persistence, copy `.env.example` to `.env.local`, provide a Supabase project URL and anon key, apply the migrations, and enable anonymous sign-in and email/password authentication in Supabase Auth. For cross-browser sync, link the local profile to an email account in System Settings, then sign in with that account on other browsers. Never put a service-role key in a browser environment variable.

```powershell
npm run typecheck
npm test
npm run test:coverage
npm run lint
npm run build
```

The test suite covers all level thresholds from 1 through 10,000; status cutoffs and bars across all three period scales; timezone-aware day, Tuesday-week, and calendar-month boundaries; local IndexedDB task/completion rules; retry-safe Supabase outbox behavior; provider period calculations; and terminal, HUD, task-editor, and dungeon interactions. The coverage command enforces minimum coverage for the game engine, local persistence, and synchronization core.

The initial Supabase migration creates the profile, task, XP-log, and daily-stat tables, RLS policies, an idempotent `complete_task` RPC, and a `pg_cron` reconciliation job. The calendar migration adds `tasks.scheduled_date` and its lookup index without changing the original schema migration. With the Supabase CLI linked and authenticated to the project, apply all pending migrations using `supabase db push`. XP awards are serialized by task and guarded by idempotency keys and database uniqueness constraints.

## Progress and calendar rules

- Everyday, Challenge, and Planned rewards are 10, 30, and 50 XP.
- Level thresholds use `ceil(1000 * ((1.00001^n - 1) / 0.00001))`; Level 1 starts at exactly 1,000 XP and Level 10,000 is capped.
- The Daily bar uses 300/500/750/1,000 XP thresholds. Weekly thresholds are multiplied by 7. Monthly thresholds are multiplied by the actual number of days in the player's current local month.
- Weeks start Tuesday at 00:00 in the saved IANA timezone. Each bar queries only its current day, week, or month and resets on that period boundary; lifetime XP and historical logs are retained.
- The monthly bar alone supplies the master status. Above the last named threshold, the Monster bar stays full and shows overflow.
- Offline completions are written to IndexedDB immediately and queued with stable idempotency keys. The same local calendar date is submitted when they later synchronize; future-dated completions are rejected by the RPC.
- Scheduled tasks keep an optional calendar date; the Calendar page displays, creates, and edits tasks for the selected local calendar date.

The 3D portrait is assembled from local Three.js primitives, so it requires no external model download. The service worker caches the application shell and same-origin navigations for offline return visits.
