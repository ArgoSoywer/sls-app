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

export async function syncOutbox(): Promise<string[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  const userId = await ensureAnonymousSession();
  const operations = (await getOutbox()).filter((operation) => operation.state === "pending");
  const errors: string[] = [];

  for (const operation of operations) {
    try {
      if (operation.kind === "task-upsert") {
        if (!operation.task) throw new Error("Queued task update is missing its task data.");
        const task = operation.task;
        const { error } = await client.from("tasks").upsert({
          id: task.id,
          user_id: userId,
          path: task.path,
          category: task.category,
          title: task.title,
          description: task.description,
          xp_value: task.xpValue,
          is_active: task.isActive,
          updated_at: task.updatedAt,
        });
        if (error) throw new Error(error.message);
      } else if (operation.kind === "completion") {
        if (!operation.completion) throw new Error("Queued completion is missing its completion data.");
        const { error } = await client.rpc("complete_task", {
          p_task_id: operation.completion.taskId,
          p_idempotency_key: operation.completion.idempotencyKey,
          p_local_date: operation.completion.localDate,
        });
        if (error) throw new Error(error.message);
      } else {
        if (!operation.timezone) throw new Error("Queued timezone update is missing its timezone.");
        const { error } = await client
          .from("users")
          .update({ timezone: operation.timezone })
          .eq("id", userId);
        if (error) throw new Error(error.message);
      }
      await acknowledgeOperation(operation);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown synchronization failure.";
      await markOperationFailed(operation, message);
      errors.push(message);
    }
  }
  return errors;
}

export async function loadRemoteTasks(localTasks: Task[]): Promise<Task[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const userId = await ensureAnonymousSession();

  const { data, error } = await client
    .from("tasks")
    .select("id,user_id,path,category,title,description,xp_value,is_active,created_at,updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Could not load tasks from Supabase: ${error.message}`);
  const remoteTasks = (data ?? []).map((row) =>
    fromRemoteTask(row as Parameters<typeof fromRemoteTask>[0]),
  );
  if (remoteTasks.length === 0) {
    for (const task of localTasks) {
      const { error: insertError } = await client.from("tasks").upsert({
        id: task.id,
        user_id: userId,
        path: task.path,
        category: task.category,
        title: task.title,
        description: task.description,
        xp_value: task.xpValue,
        is_active: task.isActive,
        created_at: task.createdAt,
        updated_at: task.updatedAt,
      });
      if (insertError) throw new Error(`Could not create starter task: ${insertError.message}`);
    }
    return localTasks;
  }

  const pendingOperations = await getOutbox();
  const pendingTasks = new Map(
    pendingOperations
      .filter((operation): operation is SyncOperation & { task: Task } =>
        operation.kind === "task-upsert" && Boolean(operation.task),
      )
      .map((operation) => [operation.task.id, operation.task]),
  );
  const merged = new Map(remoteTasks.map((task) => [task.id, task]));
  for (const [id, task] of pendingTasks) merged.set(id, task);
  return [...merged.values()];
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
