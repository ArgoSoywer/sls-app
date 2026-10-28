# SLS Code Review

## Scope and baseline

Reviewed every file under `src/`, including UI, data, game-engine, styles, and tests, plus the package manifest for unused dependencies. The review focused on dead code, unused imports/dependencies, duplicated logic, functions over 40 lines, nested conditionals, and inconsistent patterns.

Baseline validation on `refactor/code-cleanup`:

- `npm test`: 88 tests passed.
- `npm run test:coverage`: 94.55% statements, 80.31% branches, 92.06% functions, 98.36% lines.
- `npm run lint`: passed.
- `npm run typecheck`: passed.

No confirmed unused exports or unused imports were found under `src/`. The `@testing-library/user-event` development dependency is not imported by the source or test suite.

## Findings

| # | File and lines | Severity | Finding | Recommended fix |
|---|---|---|---|---|
| 1 | `src/components/game/game-context.tsx:71-287` | Medium | `GameProvider` combines state initialization, browser lifecycle listeners, Supabase hydration, period calculations, task mutations, timezone updates, and context value assembly. | Extract profile initialization/synchronization and task mutation logic into focused helpers or hooks; keep the provider responsible for state wiring and context composition. |
| 2 | `src/components/game/game-context.tsx:110-151` | Medium | Startup initialization nests local-load handling, online checks, remote hydration, and multiple error handlers, making partial startup states difficult to follow. | Split local initialization and remote hydration into named functions with early returns and one clearly scoped error boundary per phase. |
| 3 | `src/lib/sync/service.ts:25-92` | Medium | `syncOutbox` exceeds 40 lines and combines client/session setup, operation dispatch, persistence transitions, network retry handling, and error collection. | Extract one-operation synchronization and shared error conversion; keep the outbox loop linear and focused on iteration/acknowledgment. |
| 4 | `src/lib/sync/service.ts:94-139` | Medium | `loadRemoteTasks` handles fetching, row conversion, empty-account seeding, pending-edit overlay, and merging in one function. | Extract the seed and merge steps, and share task-payload mapping with the task-upsert path in `syncOutbox`. |
| 5 | `src/lib/offline/database.ts:201-256` | Medium | `recordLocalCompletion` performs duplicate detection, transaction abort handling, XP record construction, outbox creation, and transaction completion in one long function. | Separate completion eligibility/record construction from the IndexedDB write while preserving the existing atomic transaction and error messages. |
| 6 | `src/lib/offline/database.ts:259-297` | Medium | `markOperationFailed` and `markOperationPending` duplicate transaction creation, outbox updates, completion lookup, and completion-state updates. | Share a private operation-state update helper parameterized by state and optional error; retain the existing transaction boundaries. |
| 7 | `src/components/calendar/calendar-page.tsx:43-239` | Medium | `CalendarPage` owns date selection, month navigation, task indexing, editor state, and the complete calendar/day-panel rendering. | Extract focused calendar-grid and selected-day panel components; keep date/task selection behavior in the parent. |
| 8 | `src/components/dungeons/dungeon-page.tsx:51-211` | Medium | `DungeonPage` combines task selection, completion state, error handling, metrics, three category sections, sync notices, and modal wiring. | Extract task-category/card and shared notification rendering; keep task operations and path-level state in the page. |
| 9 | `src/components/system/settings-panel.tsx:7-203` | Medium | `SettingsPanel` combines timezone and account forms, session loading, linking/sign-up, sign-in, and rendering. The account mutations duplicate client setup and error-state handling. | Extract account actions into a small hook/helper and a focused account-form component; preserve the current session-linking and sign-in paths. |
| 10 | `src/components/tasks/task-composer.tsx:14-148` | Medium | `TaskComposer` owns form state initialization, Escape handling, asynchronous submission, validation feedback, and all form markup. | Extract the save handler/state transitions and task-category selector into focused helpers/components; retain the current form fields and modal behavior. |
| 11 | `src/app/page.tsx:20-85` | Low | `DashboardPage` combines completion messaging, navigation, synchronization errors, and settings state in one component. | Extract repeated sync-notice UI and, if useful, the completion banner into small components. |
| 12 | `src/components/system/system-terminal.tsx:17-60` | Low | `SystemTerminal` combines typewriter timing, connection state, path navigation, and markup; the path-label table duplicates other path metadata. | Reuse shared path metadata and isolate the typewriter effect from terminal rendering. |
| 13 | `src/app/page.tsx:12-18`; `src/components/system/system-terminal.tsx:9-15`; `src/components/calendar/calendar-page.tsx:15-21`; `src/components/dungeons/dungeon-page.tsx:12-43` | Medium | Path names are independently declared in three label maps and again in dungeon metadata, so labels can drift across navigation, calendar, and dungeon views. | Define one typed path metadata source and consume it consistently; preserve each path's title, epithet, description, and rune. |
| 14 | `src/features/game-engine/index.ts:4-8`; `src/components/tasks/task-composer.tsx:8-12`; `src/components/game/game-context.tsx:215-220`; `src/lib/offline/database.test.ts:48-52` | Medium | Category XP values are duplicated in the engine, task-composer options, provider task creation, and a test assertion. | Derive task XP and displayed category rewards from `xpForCategory`/one shared category definition; have tests assert the public rule rather than restating it. |
| 15 | `src/app/page.tsx:72-83`; `src/components/dungeons/dungeon-page.tsx:186-197` | Low | The sync notice, retry button, syncing label, and dismiss action are duplicated. | Extract a shared sync-notice component and use it in both views without changing copy or controls. |
| 16 | `src/lib/sync/service.ts:41-53`; `src/lib/sync/service.ts:115-127` | Medium | Task upsert payload fields are mapped separately for queued writes and initial local-task seeding, risking inconsistent field updates. | Add a shared task-to-remote-payload mapper and pass user ID / timestamp differences explicitly. |
| 17 | `src/components/system/system-hud.tsx:70-76`; `src/features/game-engine/index.ts:167-170` | Low | The HUD independently calculates days in the current month even though the game engine already exposes `daysInMonth`. | Use `daysInMonth(game.today)` so monthly scaling has one implementation. |
| 18 | `src/app/paths/[path]/page.tsx:5-10` | Low | Route validation uses a type assertion in `PATHS.includes(path as PathKey)` and repeats the assertion when passing the validated value. | Add a small `isPathKey` type guard and narrow the route parameter without assertions. |
| 19 | `src/lib/offline/database.test.ts:10-18`; `src/lib/sync/service.test.ts:56-64`; `src/components/game/game-context.test.tsx:12-20` | Low | The same IndexedDB deletion/setup helper is copied in three test files. | Move the helper to a shared test utility and import it from the affected suites. |
| 20 | `src/lib/offline/database.ts:19-31` | Low | The `taskId`, `localDate`, and outbox `createdAt` IndexedDB indexes are created, but no production query reads through those indexes. | Remove unused indexes in a versioned IndexedDB upgrade, or retain them only alongside an indexed query that demonstrates their purpose. |
| 21 | `package.json:29` | Low | `@testing-library/user-event` is declared but not used by any test or application file. | Remove the unused development dependency and update the lockfile. |

## Notes

- The repeated CSS selectors around `src/app/globals.css:848-942` are responsive media-query overrides for existing base styles; they are intentional and should not be collapsed in a way that changes layout behavior.
- No application behavior or Supabase schema change is proposed by this review. Refactors should preserve existing tests and the minimum 94% statement-coverage requirement.
