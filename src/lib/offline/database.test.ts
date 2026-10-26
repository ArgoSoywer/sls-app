import { beforeEach, describe, expect, it } from "vitest";
import type { Task } from "@/types/game";
import {
  acknowledgeOperation,
  getOutbox,
  loadLocalSnapshot,
  markOperationFailed,
  markOperationPending,
  mergeRemoteCompletions,
  recordLocalCompletion,
  replaceLocalTasks,
  saveLocalTask,
  saveTimezone,
} from "./database";

async function clearDatabase(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase("sls-offline");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Test database deletion was blocked."));
  });
}

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-everyday",
    path: "profession",
    category: "everyday",
    title: "Review priorities",
    description: "",
    xpValue: 10,
    isActive: true,
    createdAt: "2026-10-20T00:00:00.000Z",
    updatedAt: "2026-10-20T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(clearDatabase);

describe("local IndexedDB profile", () => {
  it("initializes a timezone and starter tasks once, then reloads persisted values", async () => {
    const initial = await loadLocalSnapshot();
    expect(initial.timezone).toBeTruthy();
    expect(initial.tasks.length).toBeGreaterThan(0);
    expect(initial.tasks.every((entry) => entry.xpValue === (
      entry.category === "everyday" ? 10 : entry.category === "challenge" ? 30 : 50
    ))).toBe(true);

    await saveTimezone("Asia/Tokyo");
    const next = await loadLocalSnapshot();
    expect(next.timezone).toBe("Asia/Tokyo");
    expect(next.tasks.map((entry) => entry.id).sort()).toEqual(initial.tasks.map((entry) => entry.id).sort());
  });

  it("stores task changes locally and queues remote updates only when enabled", async () => {
    const one = task();
    await saveLocalTask(one, false);
    expect(await getOutbox()).toEqual([]);

    const two = task({ id: "task-two", category: "planned", xpValue: 50, title: "Plan the next step" });
    await saveLocalTask(two, true);
    const snapshot = await loadLocalSnapshot();
    expect(snapshot.tasks).toEqual(expect.arrayContaining([one, two]));
    expect(await getOutbox()).toMatchObject([
      { kind: "task-upsert", state: "pending", task: two },
    ]);
  });

  it("invokes immediate sync only after the task and outbox have committed", async () => {
    const scheduled = task({ id: "scheduled-task", scheduledDate: "2026-10-28" });
    let persistedBeforePush = false;
    const errors = await saveLocalTask(scheduled, true, async () => {
      const snapshot = await loadLocalSnapshot();
      persistedBeforePush = snapshot.tasks.some((item) => item.id === scheduled.id)
        && (await getOutbox()).some((operation) => operation.task?.id === scheduled.id);
      return [];
    });
    expect(errors).toEqual([]);
    expect(persistedBeforePush).toBe(true);
    expect((await loadLocalSnapshot()).tasks.find((item) => item.id === scheduled.id)?.scheduledDate)
      .toBe("2026-10-28");
  });

  it("replaces the task cache without leaving stale tasks", async () => {
    await saveLocalTask(task(), false);
    const replacement = task({ id: "replacement", title: "Fresh task" });
    await replaceLocalTasks([replacement]);
    expect((await loadLocalSnapshot()).tasks).toEqual([replacement]);
  });
});

describe("local XP completion records", () => {
  it("awards fixed XP and queues a stable idempotency key atomically", async () => {
    const planned = task({ id: "task-planned", category: "planned", xpValue: 999 });
    const completion = await recordLocalCompletion(planned, "2026-10-20", true);
    expect(completion).toMatchObject({
      taskId: planned.id,
      category: "planned",
      xp: 50,
      localDate: "2026-10-20",
      syncState: "pending",
      idempotencyKey: completion.id,
    });
    expect(completion.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(await getOutbox()).toMatchObject([
      { id: completion.id, kind: "completion", completion },
    ]);
    expect((await loadLocalSnapshot()).completions).toEqual([completion]);
  });

  it("allows Everyday once per date but allows it again on another date", async () => {
    const everyday = task();
    const first = await recordLocalCompletion(everyday, "2026-10-20", false);
    await expect(recordLocalCompletion(everyday, "2026-10-20", false))
      .rejects.toThrow("already been completed today");
    const nextDay = await recordLocalCompletion(everyday, "2026-10-21", false);
    expect(nextDay.id).not.toBe(first.id);
    expect((await loadLocalSnapshot()).completions).toHaveLength(2);
  });

  it.each(["challenge", "planned"] as const)("allows one %s completion only", async (category) => {
    const oneTime = task({
      id: `task-${category}`,
      category,
      xpValue: category === "challenge" ? 30 : 50,
    });
    await recordLocalCompletion(oneTime, "2026-10-20", false);
    await expect(recordLocalCompletion(oneTime, "2026-10-21", false))
      .rejects.toThrow("already been completed");
    expect((await loadLocalSnapshot()).completions).toHaveLength(1);
  });

  it("keeps offline XP pending through error/retry and marks it synced after acknowledgment", async () => {
    const completion = await recordLocalCompletion(task(), "2026-10-20", true);
    const [operation] = await getOutbox();
    await markOperationFailed(operation, "Temporary network error");
    expect((await loadLocalSnapshot()).completions[0]).toMatchObject({
      syncState: "failed",
      syncError: "Temporary network error",
    });
    const failedOperation = (await getOutbox())[0];
    await markOperationPending(failedOperation);
    await acknowledgeOperation(operation);
    expect(await getOutbox()).toEqual([]);
    expect((await loadLocalSnapshot()).completions[0]).toMatchObject({
      id: completion.id,
      syncState: "synced",
      syncError: undefined,
    });
  });

  it("merges server history idempotently without overwriting a pending local completion", async () => {
    const pending = await recordLocalCompletion(task(), "2026-10-20", true);
    const remote = {
      id: "server-log-id",
      task_id: "task-everyday",
      task_category: "everyday" as const,
      xp_delta: 10,
      local_date: "2026-10-20",
      idempotency_key: pending.idempotencyKey,
      created_at: pending.createdAt,
    };
    await mergeRemoteCompletions([remote]);
    expect((await loadLocalSnapshot()).completions).toMatchObject([
      { id: pending.id, syncState: "pending" },
    ]);

    await acknowledgeOperation((await getOutbox())[0]);
    await mergeRemoteCompletions([remote, { ...remote, idempotency_key: "remote-only-key" }]);
    await mergeRemoteCompletions([remote, { ...remote, idempotency_key: "remote-only-key" }]);
    const snapshot = await loadLocalSnapshot();
    expect(snapshot.completions).toHaveLength(2);
    expect(snapshot.completions.find((entry) => entry.idempotencyKey === "remote-only-key"))
      .toMatchObject({ syncState: "synced", xp: 10 });
  });
});
