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
} from "@/features/game-engine";
import { loadLocalSnapshot } from "@/lib/offline/database";
import { retryOutbox, syncOutbox } from "@/lib/sync/service";
import type { Completion, PathKey, PeriodBar, Task, TaskCategory } from "@/types/game";
import { useGameActions } from "@/components/game/use-game-actions";
import { useGameInitialization } from "@/components/game/use-game-initialization";

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

  useGameInitialization({
    syncAvailable,
    refreshLocal,
    setTasks,
    setCompletions,
    setTimezone,
    setIsReady,
    setError,
  });

  useEffect(() => {
    const updateOnline = () => setIsOnline(navigator.onLine);
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    const clock = window.setInterval(() => setNow(new Date()), 30_000);
    return () => {
      window.clearInterval(clock);
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

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

  const { saveTask, completeTask, archiveTask, updateTimezone } = useGameActions({
    tasks,
    today,
    syncAvailable,
    isOnline,
    synchronize,
    setTasks,
    setCompletions,
    setTimezone,
    setError,
  });

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
