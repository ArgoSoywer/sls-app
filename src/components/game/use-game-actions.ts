"use client";

import { useCallback, type Dispatch, type SetStateAction } from "react";
import { recordLocalCompletion, saveLocalTask, saveTimezone } from "@/lib/offline/database";
import { syncOutbox } from "@/lib/sync/service";
import { xpForCategory } from "@/features/game-engine";
import type { Completion, PathKey, Task, TaskCategory } from "@/types/game";

interface GameActionOptions {
  tasks: Task[];
  today: string;
  syncAvailable: boolean;
  isOnline: boolean;
  synchronize: () => Promise<void>;
  setTasks: Dispatch<SetStateAction<Task[]>>;
  setCompletions: Dispatch<SetStateAction<Completion[]>>;
  setTimezone: Dispatch<SetStateAction<string>>;
  setError: Dispatch<SetStateAction<string | null>>;
}

function reportSyncErrors(errors: string[], setError: GameActionOptions["setError"]): void {
  if (errors.length > 0) setError(`Sync needs attention: ${errors.join(" · ")}`);
}

export function useGameActions({
  tasks,
  today,
  syncAvailable,
  isOnline,
  synchronize,
  setTasks,
  setCompletions,
  setTimezone,
  setError,
}: GameActionOptions) {
  const saveTask = useCallback(async (input: {
    id?: string;
    path: PathKey;
    category: TaskCategory;
    title: string;
    description: string;
    scheduledDate?: string | null;
  }) => {
    const timestamp = new Date().toISOString();
    const previous = input.id ? tasks.find((task) => task.id === input.id) : undefined;
    const task: Task = {
      id: previous?.id ?? crypto.randomUUID(),
      path: input.path,
      category: previous?.category ?? input.category,
      title: input.title.trim(),
      description: input.description.trim(),
      xpValue: previous?.xpValue ?? xpForCategory(input.category),
      isActive: true,
      createdAt: previous?.createdAt ?? timestamp,
      updatedAt: timestamp,
      scheduledDate: input.scheduledDate === undefined
        ? previous?.scheduledDate ?? null
        : input.scheduledDate,
    };
    if (!task.title) throw new Error("Task title cannot be empty.");
    const errors = await saveLocalTask(
      task,
      syncAvailable,
      syncAvailable && isOnline ? syncOutbox : undefined,
    );
    setTasks((existing) => [task, ...existing.filter((item) => item.id !== task.id)]);
    reportSyncErrors(errors, setError);
  }, [isOnline, setError, setTasks, syncAvailable, tasks]);

  const completeTask = useCallback(async (taskId: string) => {
    const task = tasks.find((item) => item.id === taskId && item.isActive);
    if (!task) throw new Error("This task is no longer available.");
    const completion = await recordLocalCompletion(task, today, syncAvailable);
    setCompletions((existing) => [completion, ...existing]);
    if (syncAvailable && isOnline) await synchronize();
  }, [isOnline, setCompletions, synchronize, syncAvailable, tasks, today]);

  const archiveTask = useCallback(async (taskId: string) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) throw new Error("This task could not be found.");
    const archived = { ...task, isActive: false, updatedAt: new Date().toISOString() };
    const errors = await saveLocalTask(
      archived,
      syncAvailable,
      syncAvailable && isOnline ? syncOutbox : undefined,
    );
    setTasks((existing) => existing.map((item) => item.id === taskId ? archived : item));
    reportSyncErrors(errors, setError);
  }, [isOnline, setError, setTasks, syncAvailable, tasks]);

  const updateTimezone = useCallback(async (nextTimezone: string) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: nextTimezone });
    } catch {
      throw new Error(`"${nextTimezone}" is not a valid IANA timezone.`);
    }
    await saveTimezone(nextTimezone, syncAvailable);
    setTimezone(nextTimezone);
    if (syncAvailable && isOnline) await synchronize();
  }, [isOnline, setTimezone, synchronize, syncAvailable]);

  return { saveTask, completeTask, archiveTask, updateTimezone };
}
