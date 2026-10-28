# Changelog

## [Unreleased] — 2026-10-26

### Added
- Added a month calendar view with date selection, scheduled-task indicators, task details, and date-prefilled task creation/editing.
- Added an additive Supabase migration for nullable task `scheduled_date` values and a user/date index.
- Added bounded retry with exponential backoff for transient Supabase fetch failures.
- Added account linking and sign-in controls so the same player profile can sync across browsers.
- Added a guarded, one-time SQL recovery script to transfer existing task and XP ownership between player IDs without deleting rows.

### Changed
- Renamed the daily status “Loser” to “Looser” and moved the terminal path question to its own line.
- Increased System HUD text sizes and progress-bar heights for improved legibility.
- Persisted scheduled dates locally and included them in Supabase task reads and writes.
- Push queued task changes to Supabase immediately after the local IndexedDB transaction commits when online; retain the outbox when the network fails.

### Fixed
- Improved “Failed to fetch” handling: keep changes queued, stop further network operations for the failed sync pass, and display an actionable connection/configuration message.
- Prevented locally edited scheduled tasks from being lost when task data is synchronized.

### Refactored
- Centralized path and task-category metadata, reused the game engine's task XP and month-length helpers, and narrowed path routes with a type guard.
- Removed the unused `@testing-library/user-event` development dependency.
- Reused one sync-notice component across the dashboard and dungeon views.
- Shared queued task payload mapping and outbox operation dispatch, separated remote task seeding/merging, and unified IndexedDB completion and sync-state helpers.
- Split calendar month-grid and selected-day rendering from calendar state/navigation.
- Extracted dungeon task-category and task-card rendering from path-level state/actions.
- Separated Supabase account operations and the cross-browser account form from timezone settings.
- Isolated local/remote profile initialization and task/timezone actions from the game context provider.
