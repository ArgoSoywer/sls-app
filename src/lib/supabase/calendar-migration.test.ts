import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("calendar schema migration", () => {
  it("adds an optional scheduled date and user/date lookup without editing the initial schema", () => {
    const migration = readFileSync(resolve(
      process.cwd(),
      "supabase/migrations/202610260001_calendar_scheduled_date.sql",
    ), "utf8");
    const initialSchema = readFileSync(resolve(
      process.cwd(),
      "supabase/migrations/202610200001_initial_schema.sql",
    ), "utf8");

    expect(migration).toMatch(/alter table public\.tasks\s+add column if not exists scheduled_date date;/i);
    expect(migration).toMatch(/on public\.tasks \(user_id, scheduled_date\)/i);
    expect(migration).toMatch(/where scheduled_date is not null/i);
    expect(initialSchema).not.toMatch(/scheduled_date/i);
  });
});
