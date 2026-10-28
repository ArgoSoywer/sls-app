import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Task } from "@/types/game";
import { fromRemoteTask } from "@/lib/supabase/client";
import {
  getOutbox,
  loadLocalSnapshot,
  recordLocalCompletion,
  saveLocalTask,
  saveTimezone,
} from "@/lib/offline/database";
import { clearOfflineDatabase } from "@/test-utils/indexeddb";

const supabaseHarness = vi.hoisted(() => ({
  client: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
  getClient: vi.fn(),
  ensureSession: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseClient: supabaseHarness.getClient,
  ensureAnonymousSession: supabaseHarness.ensureSession,
  fromRemoteTask: (row: {
    id: string;
    user_id: string;
    path: Task["path"];
    category: Task["category"];
    title: string;
    description: string;
    xp_value: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    scheduled_date?: string | null;
  }) => ({
    id: row.id,
    userId: row.user_id,
    path: row.path,
    category: row.category,
    title: row.title,
    description: row.description,
    xpValue: row.xp_value,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    scheduledDate: row.scheduled_date ?? null,
  }),
}));

import {
  loadRemoteCompletions,
  loadRemoteTasks,
  retryOutbox,
  syncInitialTimezone,
  syncOutbox,
} from "./service";

const testTask: Task = {
  id: "task-sync",
  path: "academics",
  category: "challenge",
  title: "Finish a chapter",
  description: "Take notes as you go.",
  xpValue: 30,
  isActive: true,
  createdAt: "2026-10-20T00:00:00.000Z",
  updatedAt: "2026-10-20T00:00:00.000Z",
  scheduledDate: null,
};

beforeEach(async () => {
  await clearOfflineDatabase();
  supabaseHarness.getClient.mockReturnValue(supabaseHarness.client);
  supabaseHarness.ensureSession.mockResolvedValue("player-123");
  supabaseHarness.client.rpc.mockResolvedValue({ data: { duplicate: false }, error: null });
  supabaseHarness.client.from.mockImplementation((table: string) => {
    if (table === "tasks") {
      return { upsert: vi.fn().mockResolvedValue({ error: null }) };
    }
    if (table === "users") {
      return {
        update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
      };
    }
    throw new Error(`Unexpected Supabase table: ${table}`);
  });
});

describe("outbox synchronization", () => {
  it("leaves queued operations untouched when Supabase is not configured", async () => {
    supabaseHarness.getClient.mockReturnValue(null);
    await saveLocalTask(testTask, true);
    expect(await syncOutbox()).toEqual([]);
    expect(supabaseHarness.ensureSession).not.toHaveBeenCalled();
    expect(await getOutbox()).toHaveLength(1);
  });

  it("syncs task, completion, and timezone writes and acknowledges them", async () => {
    await saveLocalTask(testTask, true);
    const completion = await recordLocalCompletion(testTask, "2026-10-20", true);
    await saveTimezone("Asia/Tokyo", true);

    expect(await syncOutbox()).toEqual([]);
    expect(supabaseHarness.ensureSession).toHaveBeenCalledOnce();
    expect(supabaseHarness.client.from).toHaveBeenCalledWith("tasks");
    expect(supabaseHarness.client.rpc).toHaveBeenCalledWith("complete_task", {
      p_task_id: testTask.id,
      p_idempotency_key: completion.idempotencyKey,
      p_local_date: "2026-10-20",
    });
    expect(supabaseHarness.client.from).toHaveBeenCalledWith("users");
    expect(await getOutbox()).toEqual([]);
    expect((await loadLocalSnapshot()).completions[0]).toMatchObject({
      id: completion.id,
      syncState: "synced",
    });
  });

  it("pushes a locally saved task immediately when online sync is requested", async () => {
    const errors = await saveLocalTask(testTask, true, syncOutbox);
    expect(errors).toEqual([]);
    expect(supabaseHarness.client.from).toHaveBeenCalledWith("tasks");
    expect(await getOutbox()).toEqual([]);
  });

  it("keeps fetch failures queued and returns a useful retry message", async () => {
    await saveLocalTask(testTask, true);
    supabaseHarness.client.from.mockImplementation(() => ({
      upsert: vi.fn().mockResolvedValue({
        error: { message: "TypeError: Failed to fetch" },
      }),
    }));
    await expect(syncOutbox()).resolves.toEqual([
      expect.stringContaining("Supabase could not be reached after retrying"),
    ]);
    expect(await getOutbox()).toMatchObject([{ state: "pending", task: testTask }]);
  });

  it("surfaces authentication session failures without hiding queued tasks", async () => {
    await saveLocalTask(testTask, true);
    supabaseHarness.ensureSession.mockRejectedValueOnce(new Error("Anonymous sign-in is disabled"));
    await expect(syncOutbox()).resolves.toEqual([
      "Could not establish the Supabase player session: Anonymous sign-in is disabled",
    ]);
    expect(await getOutbox()).toMatchObject([{ state: "pending", task: testTask }]);
  });

  describe("remote data hydration", () => {
    it("maps remote task rows and overlays unsynced local edits", async () => {
      const remoteTask = {
        id: testTask.id,
        user_id: "player-123",
        path: "academics" as const,
        category: "challenge" as const,
        title: "Old remote title",
        description: "Old remote description",
        xp_value: 30,
        is_active: true,
        scheduled_date: "2026-10-30",
        created_at: testTask.createdAt,
        updated_at: testTask.updatedAt,
      };
      const builder = {
        select: vi.fn(),
        eq: vi.fn(),
        order: vi.fn().mockResolvedValue({ data: [remoteTask], error: null }),
        upsert: vi.fn().mockResolvedValue({ error: null }),
      };
      builder.select.mockReturnValue(builder);
      builder.eq.mockReturnValue(builder);
      supabaseHarness.client.from.mockReturnValue(builder);
      const localEdit = { ...testTask, title: "Edited while offline" };
      await saveLocalTask(localEdit, true);

      expect(await loadRemoteTasks([testTask])).toEqual([localEdit]);
      expect(fromRemoteTask(remoteTask).scheduledDate).toBe("2026-10-30");
      expect(supabaseHarness.client.from).toHaveBeenCalledWith("tasks");
      expect(builder.eq).toHaveBeenCalledWith("user_id", "player-123");
    });

    it("seeds Supabase with local tasks when the remote profile has none", async () => {
      const builder = {
        select: vi.fn(),
        eq: vi.fn(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
        upsert: vi.fn().mockResolvedValue({ error: null }),
      };
      builder.select.mockReturnValue(builder);
      builder.eq.mockReturnValue(builder);
      supabaseHarness.client.from.mockReturnValue(builder);

      expect(await loadRemoteTasks([testTask])).toEqual([testTask]);
      expect(builder.upsert).toHaveBeenCalledWith(expect.objectContaining({
        id: testTask.id,
        user_id: "player-123",
        xp_value: 30,
      }));
    });

    it("surfaces task query failures instead of treating them as an empty account", async () => {
      const builder = {
        select: vi.fn(),
        eq: vi.fn(),
        order: vi.fn().mockResolvedValue({ data: null, error: { message: "Read denied" } }),
        upsert: vi.fn(),
      };
      builder.select.mockReturnValue(builder);
      builder.eq.mockReturnValue(builder);
      supabaseHarness.client.from.mockReturnValue(builder);

      await expect(loadRemoteTasks([])).rejects.toThrow("Could not load tasks from Supabase: Read denied");
    });

    it("loads server XP history and copies the detected timezone to a new UTC profile", async () => {
      const log = {
        id: "log-id",
        task_id: testTask.id,
        task_category: "challenge" as const,
        xp_delta: 30,
        local_date: "2026-10-20",
        idempotency_key: "8b2197de-1392-40bd-9f5e-9b51a3a0f14b",
        created_at: "2026-10-20T12:00:00.000Z",
      };
      const historyBuilder = {
        select: vi.fn(),
        eq: vi.fn(),
        order: vi.fn().mockResolvedValue({ data: [log], error: null }),
      };
      historyBuilder.select.mockReturnValue(historyBuilder);
      historyBuilder.eq.mockReturnValue(historyBuilder);
      supabaseHarness.client.from.mockReturnValue(historyBuilder);
      expect(await loadRemoteCompletions()).toEqual([log]);

      const profileBuilder = {
        select: vi.fn(),
        eq: vi.fn(),
        single: vi.fn().mockResolvedValue({ data: { timezone: "UTC" }, error: null }),
        update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
      };
      profileBuilder.select.mockReturnValue(profileBuilder);
      profileBuilder.eq.mockReturnValue(profileBuilder);
      supabaseHarness.client.from.mockReturnValue(profileBuilder);
      await syncInitialTimezone("Asia/Tokyo");
      expect(profileBuilder.update).toHaveBeenCalledWith({ timezone: "Asia/Tokyo" });
    });

    it("does not overwrite a chosen profile timezone and reports history failures", async () => {
      const profileBuilder = {
        select: vi.fn(),
        eq: vi.fn(),
        single: vi.fn().mockResolvedValue({ data: { timezone: "Europe/Istanbul" }, error: null }),
        update: vi.fn(),
      };
      profileBuilder.select.mockReturnValue(profileBuilder);
      profileBuilder.eq.mockReturnValue(profileBuilder);
      supabaseHarness.client.from.mockReturnValue(profileBuilder);
      await syncInitialTimezone("Asia/Tokyo");
      expect(profileBuilder.update).not.toHaveBeenCalled();

      const historyBuilder = {
        select: vi.fn(),
        eq: vi.fn(),
        order: vi.fn().mockResolvedValue({ data: null, error: { message: "History denied" } }),
      };
      historyBuilder.select.mockReturnValue(historyBuilder);
      historyBuilder.eq.mockReturnValue(historyBuilder);
      supabaseHarness.client.from.mockReturnValue(historyBuilder);
      await expect(loadRemoteCompletions()).rejects.toThrow("Could not load XP history from Supabase: History denied");
    });

    it("skips optional server hydration when Supabase is not configured", async () => {
      supabaseHarness.getClient.mockReturnValue(null);
      expect(await loadRemoteTasks([testTask])).toBeNull();
      expect(await loadRemoteCompletions()).toEqual([]);
      await expect(syncInitialTimezone("UTC")).resolves.toBeUndefined();
    });
  });

  it("surfaces RPC failure, retains the completion, and retries with the same key", async () => {
    const completion = await recordLocalCompletion(testTask, "2026-10-20", true);
    supabaseHarness.client.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "Temporary server outage" },
    });

    expect(await syncOutbox()).toEqual(["Temporary server outage"]);
    expect((await getOutbox())[0]).toMatchObject({ state: "failed", error: "Temporary server outage" });
    expect((await loadLocalSnapshot()).completions[0]).toMatchObject({
      syncState: "failed",
      syncError: "Temporary server outage",
    });

    expect(await retryOutbox()).toEqual([]);
    expect(supabaseHarness.client.rpc).toHaveBeenNthCalledWith(2, "complete_task", {
      p_task_id: testTask.id,
      p_idempotency_key: completion.idempotencyKey,
      p_local_date: "2026-10-20",
    });
    expect(await getOutbox()).toEqual([]);
    expect((await loadLocalSnapshot()).completions[0]).toMatchObject({ syncState: "synced" });
  });

  it("continues syncing after a failure and retains only the operation that needs retry", async () => {
    const first = { ...testTask, id: "first" };
    const second = { ...testTask, id: "second" };
    await saveLocalTask(first, true);
    await saveLocalTask(second, true);
    let rejectFirstAttempt = true;
    supabaseHarness.client.from.mockImplementation(() => ({
      upsert: vi.fn((payload: { id: string }) => {
        if (payload.id === "first" && rejectFirstAttempt) {
          rejectFirstAttempt = false;
          return Promise.resolve({ error: { message: "First task rejected" } });
        }
        return Promise.resolve({ error: null });
      }),
    }));

    expect(await syncOutbox()).toEqual(["First task rejected"]);
    expect(await getOutbox()).toMatchObject([
      { id: expect.any(String), state: "failed", task: first },
    ]);
    expect(supabaseHarness.client.from).toHaveBeenCalledTimes(2);
    expect(await retryOutbox()).toEqual([]);
    expect(await getOutbox()).toEqual([]);
  });
});
