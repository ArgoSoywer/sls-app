"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  dateKeyInTimezone,
  periodBar,
  levelForXp,
  displayDate,
  xpInPeriod,
  daysInMonth,
  xpForCategory,
} from "@/features/game-engine";
import {
  loadLocalSnapshot,
  mergeRemoteCompletions,
  recordLocalCompletion,
  replaceLocalTasks,
  saveLocalTask,
  saveTimezone,
} from "@/lib/offline/database";
import {
  loadRemoteCompletions,
  loadRemoteTasks,
  retryOutbox,
  syncOutbox,
  syncInitialTimezone,
} from "@/lib/sync/service";
import type { Completion, PathKey, PeriodBar, Task, TaskCategory } from "@/types/game";

interface GameContextValue {
  tasks: Task[];
  completions: Completion[];
  timezone: string;
  now: Date;
  today: string;
  lifetimeXp: number;
  level: number;
  dailyBar: PeriodBar;
  weeklyBar: PeriodBar;
  monthlyBar: PeriodBar;
  isOnline: boolean;
  isReady: boolean;
  isSyncing: boolean;
  syncAvailable: boolean;
  error: string | null;
  saveTask: (input: {
    id?: string;
    path: PathKey;
    category: TaskCategory;
    title: string;
    description: string;
    scheduledDate?: string | null;
  }) => Promise<void>;
  completeTask: (taskId: string) => Promise<void>;
  archiveTask: (taskId: string) => Promise<void>;
  updateTimezone: (timezone: string) => Promise<void>;
  retrySync: () => Promise<void>;
  clearError: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [timezone, setTimezone] = useState("UTC");
  const [now, setNow] = useState(() => new Date());
  const [isReady, setIsReady] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previousOnline = useRef(true);
  const syncAvailable = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  const refreshLocal = useCallback(async () => {
    const snapshot = await loadLocalSnapshot();
    setTasks(snapshot.tasks);
    setCompletions(snapshot.completions);
    setTimezone(snapshot.timezone);
  }, []);

  const synchronize = useCallback(async (retry = false) => {
    if (!syncAvailable || !navigator.onLine) return;
    setIsSyncing(true);
    try {
      const errors = retry ? await retryOutbox() : await syncOutbox();
      await refreshLocal();
      if (errors.length > 0) {
        setError(`Sync needs attention: ${errors.join(" · ")}`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Synchronization failed.");
    } finally {
      setIsSyncing(false);
    }
  }, [refreshLocal, syncAvailable]);

  useEffect(() => {
    let active = true;
    const init = async () => {
      try {
        const snapshot = await loadLocalSnapshot();
        if (!active) return;
        setTasks(snapshot.tasks);
        setCompletions(snapshot.completions);
        setTimezone(snapshot.timezone);
        setIsReady(true);

        if (syncAvailable && navigator.onLine) {
          try {
            const startupErrors = await syncOutbox();
            await syncInitialTimezone(snapshot.timezone);
            const remoteTasks = await loadRemoteTasks(snapshot.tasks);
            if (active && remoteTasks) {
              await replaceLocalTasks(remoteTasks);
            }
            const remoteCompletions = await loadRemoteCompletions();
            if (active) await mergeRemoteCompletions(remoteCompletions);
            const syncErrors = await syncOutbox();
            const allSyncErrors = [...startupErrors, ...syncErrors];
            if (active && allSyncErrors.length > 0) {
              setError(`Sync needs attention: ${allSyncErrors.join(" · ")}`);
            }
            if (active) await refreshLocal();
          } catch (cause) {
            if (active) {
              setError(cause instanceof Error ? cause.message : "Could not connect to Supabase.");
            }
          }
        }
      } catch (cause) {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Could not open local storage.");
          setIsReady(true);
        }
      }
    };
    void init();
    const updateOnline = () => setIsOnline(navigator.onLine);
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    const clock = window.setInterval(() => setNow(new Date()), 30_000);
    return () => {
      active = false;
      window.clearInterval(clock);
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, [refreshLocal, syncAvailable]);

  useEffect(() => {
    if (isOnline && !previousOnline.current && syncAvailable && isReady) {
      void synchronize();
    }
    previousOnline.current = isOnline;
  }, [isOnline, isReady, syncAvailable, synchronize]);

  const today = useMemo(() => {
    try {
      return dateKeyInTimezone(now, timezone);
    } catch {
      return dateKeyInTimezone(now, "UTC");
    }
  }, [now, timezone]);
  useEffect(() => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The saved timezone is invalid.");
    }
  }, [timezone]);
  const totalXp = useMemo(
    () => completions.reduce((total, completion) => total + completion.xp, 0),
    [completions],
  );
  const dailyXp = xpInPeriod(completions, today, "day");
  const weeklyXp = xpInPeriod(completions, today, "week");
  const monthlyXp = xpInPeriod(completions, today, "month");
  const dayCount = daysInMonth(today);
  const dailyBar = periodBar(dailyXp);
  const weeklyBar = periodBar(weeklyXp, 7);
  const monthlyBar = periodBar(monthlyXp, dayCount);

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
    const syncErrors = await saveLocalTask(
      task,
      syncAvailable,
      syncAvailable && isOnline ? syncOutbox : undefined,
    );
    setTasks((existing) => [task, ...existing.filter((item) => item.id !== task.id)]);
    if (syncErrors.length > 0) setError(`Sync needs attention: ${syncErrors.join(" · ")}`);
  }, [isOnline, syncAvailable, tasks]);

  const completeTask = useCallback(async (taskId: string) => {
    const task = tasks.find((item) => item.id === taskId && item.isActive);
    if (!task) throw new Error("This task is no longer available.");
    const completion = await recordLocalCompletion(task, today, syncAvailable);
    setCompletions((existing) => [completion, ...existing]);
    if (syncAvailable && isOnline) await synchronize();
  }, [isOnline, synchronize, syncAvailable, tasks, today]);

  const archiveTask = useCallback(async (taskId: string) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) throw new Error("This task could not be found.");
    const archived = { ...task, isActive: false, updatedAt: new Date().toISOString() };
    const syncErrors = await saveLocalTask(
      archived,
      syncAvailable,
      syncAvailable && isOnline ? syncOutbox : undefined,
    );
    setTasks((existing) => existing.map((item) => item.id === taskId ? archived : item));
    if (syncErrors.length > 0) setError(`Sync needs attention: ${syncErrors.join(" · ")}`);
  }, [isOnline, syncAvailable, tasks]);

  const updateTimezone = useCallback(async (nextTimezone: string) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: nextTimezone });
    } catch {
      throw new Error(`"${nextTimezone}" is not a valid IANA timezone.`);
    }
    await saveTimezone(nextTimezone, syncAvailable);
    setTimezone(nextTimezone);
    if (syncAvailable && isOnline) await synchronize();
  }, [isOnline, synchronize, syncAvailable]);

  const value: GameContextValue = {
    tasks,
    completions,
    timezone,
    now,
    today,
    lifetimeXp: totalXp,
    level: levelForXp(totalXp),
    dailyBar,
    weeklyBar,
    monthlyBar,
    isOnline,
    isReady,
    isSyncing,
    syncAvailable,
    error,
    saveTask,
    completeTask,
    archiveTask,
    updateTimezone,
    retrySync: () => synchronize(true),
    clearError: () => setError(null),
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const value = useContext(GameContext);
  if (!value) throw new Error("useGame must be used inside GameProvider.");
  return value;
}

export { displayDate };
