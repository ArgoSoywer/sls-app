"use client";

import type { SyncOperation, Task } from "@/types/game";
import {
  acknowledgeOperation,
  getOutbox,
  markOperationFailed,
  markOperationPending,
} from "@/lib/offline/database";
import {
  ensureAnonymousSession,
  fromRemoteTask,
  getSupabaseClient,
} from "@/lib/supabase/client";

type ActiveClient = NonNullable<ReturnType<typeof getSupabaseClient>>;

function isNetworkFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /failed to fetch|fetch failed|networkerror|network request failed|load failed/i.test(message);
}

function networkFailureMessage(): string {
  return "Supabase could not be reached after retrying. Check your connection, Supabase project URL, and API availability. Changes remain queued for retry.";
}

function taskPayload(task: Task, userId: string) {
  return {
    id: task.id,
    user_id: userId,
    path: task.path,
    category: task.category,
    title: task.title,
    description: task.description,
    xp_value: task.xpValue,
    is_active: task.isActive,
    scheduled_date: task.scheduledDate ?? null,
    updated_at: task.updatedAt,
  };
}

async function pushOperation(
  client: ActiveClient,
  userId: string,
  operation: SyncOperation,
): Promise<void> {
  if (operation.kind === "task-upsert") {
    if (!operation.task) throw new Error("Queued task update is missing its task data.");
    const { error } = await client.from("tasks").upsert(taskPayload(operation.task, userId));
    if (error) throw new Error(error.message);
    return;
  }

  if (operation.kind === "completion") {
    if (!operation.completion) throw new Error("Queued completion is missing its completion data.");
    const { error } = await client.rpc("complete_task", {
      p_task_id: operation.completion.taskId,
      p_idempotency_key: operation.completion.idempotencyKey,
      p_local_date: operation.completion.localDate,
    });
    if (error) throw new Error(error.message);
    return;
  }

  if (!operation.timezone) throw new Error("Queued timezone update is missing its timezone.");
  const { error } = await client
    .from("users")
    .update({ timezone: operation.timezone })
    .eq("id", userId);
  if (error) throw new Error(error.message);
}

async function pushPendingOperations(
  client: ActiveClient,
  userId: string,
  operations: SyncOperation[],
): Promise<string[]> {
  const errors: string[] = [];
  for (const operation of operations) {
    try {
      await pushOperation(client, userId, operation);
      await acknowledgeOperation(operation);
    } catch (error) {
      if (isNetworkFailure(error)) {
        await markOperationPending(operation);
        errors.push(networkFailureMessage());
        break;
      }
      const message = error instanceof Error ? error.message : "Unknown synchronization failure.";
      await markOperationFailed(operation, message);
      errors.push(message);
    }
  }
  return errors;
}

export async function syncOutbox(): Promise<string[]> {
  let client: ActiveClient | null;
  try {
    client = getSupabaseClient();
  } catch (error) {
    return [error instanceof Error ? error.message : "Could not initialize the Supabase client."];
  }
  if (!client) return [];

  let userId: string;
  try {
    userId = await ensureAnonymousSession();
  } catch (error) {
    if (isNetworkFailure(error)) return [networkFailureMessage()];
    return [error instanceof Error
      ? `Could not establish the Supabase player session: ${error.message}`
      : "Could not establish the Supabase player session."];
  }

  const operations = (await getOutbox()).filter((operation) => operation.state === "pending");
  return pushPendingOperations(client, userId, operations);
}

async function seedRemoteTasks(
  client: ActiveClient,
  userId: string,
  tasks: Task[],
): Promise<void> {
  for (const task of tasks) {
    const { error } = await client.from("tasks").upsert({
      ...taskPayload(task, userId),
      created_at: task.createdAt,
    });
    if (error) throw new Error(`Could not create starter task: ${error.message}`);
  }
}

async function mergePendingTasks(remoteTasks: Task[]): Promise<Task[]> {
  const pendingOperations = await getOutbox();
  const pendingTasks = pendingOperations.filter(
    (operation): operation is SyncOperation & { task: Task } =>
      operation.kind === "task-upsert" && Boolean(operation.task),
  );
  const merged = new Map(remoteTasks.map((task) => [task.id, task]));
  for (const { task } of pendingTasks) merged.set(task.id, task);
  return [...merged.values()];
}

export async function loadRemoteTasks(localTasks: Task[]): Promise<Task[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const userId = await ensureAnonymousSession();

  const { data, error } = await client
    .from("tasks")
    .select("id,user_id,path,category,title,description,xp_value,is_active,scheduled_date,created_at,updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Could not load tasks from Supabase: ${error.message}`);
  const remoteTasks = (data ?? []).map((row) =>
    fromRemoteTask(row as Parameters<typeof fromRemoteTask>[0]),
  );
  if (remoteTasks.length === 0) {
    await seedRemoteTasks(client, userId, localTasks);
    return localTasks;
  }

  return mergePendingTasks(remoteTasks);
}

export async function syncInitialTimezone(timezone: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  const userId = await ensureAnonymousSession();
  const { data, error } = await client
    .from("users")
    .select("timezone")
    .eq("id", userId)
    .single();
  if (error) throw new Error(`Could not load player timezone: ${error.message}`);
  if (data.timezone === "UTC" && timezone !== "UTC") {
    const { error: updateError } = await client
      .from("users")
      .update({ timezone })
      .eq("id", userId);
    if (updateError) throw new Error(`Could not save the detected timezone: ${updateError.message}`);
  }
}

export async function loadRemoteCompletions() {
  const client = getSupabaseClient();
  if (!client) return [];
  const userId = await ensureAnonymousSession();
  const { data, error } = await client
    .from("xp_logs")
    .select("id,task_id,task_category,xp_delta,local_date,idempotency_key,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load XP history from Supabase: ${error.message}`);
  return data ?? [];
}

export async function retryOutbox(): Promise<string[]> {
  const operations = await getOutbox();
  for (const operation of operations) {
    if (operation.state === "failed") await markOperationPending(operation);
  }
  return syncOutbox();
}
