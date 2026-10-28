"use client";

import { useEffect, type Dispatch, type SetStateAction } from "react";
import {
  loadLocalSnapshot,
  mergeRemoteCompletions,
  replaceLocalTasks,
} from "@/lib/offline/database";
import {
  loadRemoteCompletions,
  loadRemoteTasks,
  syncInitialTimezone,
  syncOutbox,
} from "@/lib/sync/service";
import type { Completion, Task } from "@/types/game";
import type { LocalSnapshot } from "@/lib/offline/database";

interface InitializationOptions {
  syncAvailable: boolean;
  refreshLocal: () => Promise<void>;
  setTasks: Dispatch<SetStateAction<Task[]>>;
  setCompletions: Dispatch<SetStateAction<Completion[]>>;
  setTimezone: Dispatch<SetStateAction<string>>;
  setIsReady: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
}

async function hydrateRemoteProfile(
  snapshot: LocalSnapshot,
  isActive: () => boolean,
  refreshLocal: () => Promise<void>,
  setCompletions: Dispatch<SetStateAction<Completion[]>>,
  setError: Dispatch<SetStateAction<string | null>>,
): Promise<void> {
  const startupErrors = await syncOutbox();
  await syncInitialTimezone(snapshot.timezone);
  const remoteTasks = await loadRemoteTasks(snapshot.tasks);
  if (isActive() && remoteTasks) {
    await replaceLocalTasks(remoteTasks);
  }

  const remoteCompletions = await loadRemoteCompletions();
  if (isActive()) await mergeRemoteCompletions(remoteCompletions);
  const syncErrors = await syncOutbox();
  const allErrors = [...startupErrors, ...syncErrors];
  if (isActive() && allErrors.length > 0) {
    setError(`Sync needs attention: ${allErrors.join(" · ")}`);
  }
  if (isActive()) await refreshLocal();
}

export function useGameInitialization({
  syncAvailable,
  refreshLocal,
  setTasks,
  setCompletions,
  setTimezone,
  setIsReady,
  setError,
}: InitializationOptions): void {
  useEffect(() => {
    let active = true;
    const initialize = async () => {
      let snapshot: LocalSnapshot;
      try {
        snapshot = await loadLocalSnapshot();
      } catch (cause) {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Could not open local storage.");
          setIsReady(true);
        }
        return;
      }

      if (!active) return;
      setTasks(snapshot.tasks);
      setCompletions(snapshot.completions);
      setTimezone(snapshot.timezone);
      setIsReady(true);
      if (!syncAvailable || !navigator.onLine) return;

      try {
        await hydrateRemoteProfile(
          snapshot,
          () => active,
          refreshLocal,
          setCompletions,
          setError,
        );
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Could not connect to Supabase.");
      }
    };

    void initialize();
    return () => { active = false; };
  }, [refreshLocal, setCompletions, setError, setIsReady, setTasks, setTimezone, syncAvailable]);
}
