"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useGame } from "@/components/game/game-context";
import { SystemHud } from "@/components/system/system-hud";
import { SettingsPanel } from "@/components/system/settings-panel";
import { SyncNotice } from "@/components/system/sync-notice";
import { TaskComposer } from "@/components/tasks/task-composer";
import { CATEGORY_INFO, PATH_INFO, TASK_CATEGORY_ORDER, xpForCategory } from "@/features/game-engine";
import type { PathKey, Task, TaskCategory } from "@/types/game";
import { DungeonTaskCategory } from "@/components/dungeons/dungeon-task-category";

const categories = TASK_CATEGORY_ORDER.map((value) => ({
  value,
  ...CATEGORY_INFO[value],
  xp: xpForCategory(value),
}));

export function DungeonPage({ path }: { path: PathKey }) {
  const game = useGame();
  const info = PATH_INFO[path];
  const [composer, setComposer] = useState<{ open: boolean; category?: TaskCategory; task?: Task }>({ open: false });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [actionError, setActionError] = useState("");
  const activeTasks = useMemo(
    () => game.tasks.filter((task) => task.path === path && task.isActive),
    [game.tasks, path],
  );
  const completed = useMemo(() => {
    const ids = new Set<string>();
    for (const completion of game.completions) {
      if (completion.category !== "everyday" || completion.localDate === game.today) ids.add(completion.taskId);
    }
    return ids;
  }, [game.completions, game.today]);

  const complete = async (task: Task) => {
    setActionError("");
    try {
      await game.completeTask(task.id);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Could not complete this task.");
    }
  };

  const archive = async (task: Task) => {
    setActionError("");
    try {
      await game.archiveTask(task.id);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Could not archive this task.");
    }
  };

  return (
    <main className={`dungeon-screen dungeon-${path}`}>
      <div className="dungeon-atmosphere" />
      <SystemHud onSettings={() => setSettingsOpen(true)} />
      <Link href="/" className="back-to-system"><span aria-hidden="true">←</span> SYSTEM OVERVIEW</Link>

      <section className="dungeon-hero">
        <div className="dungeon-rune" aria-hidden="true">{info.rune}</div>
        <div className="dungeon-title-block">
          <span className="eyebrow">{info.epithet}</span>
          <h1>{info.title}</h1>
          <p>{info.description}</p>
        </div>
        <div className="dungeon-metrics">
          <span>TODAY</span>
          <strong>{activeTasks.filter((task) => task.category === "everyday" && completed.has(task.id)).length}<i> / </i>{activeTasks.filter((task) => task.category === "everyday").length}</strong>
          <small>OBJECTIVES COMPLETE</small>
        </div>
      </section>

      <section className="task-categories" aria-label={`${info.title} task categories`}>
        {categories.map((category, index) => {
          const list = activeTasks.filter((task) =>
            task.category === category.value && !completed.has(task.id),
          );
          return (
            <DungeonTaskCategory
              key={category.value}
              category={category}
              index={index}
              tasks={list}
              onAdd={() => setComposer({ open: true, category: category.value })}
              onComplete={(task) => void complete(task)}
              onEdit={(task) => setComposer({ open: true, task })}
              onArchive={(task) => void archive(task)}
            />
          );
        })}
      </section>

      {actionError && (
        <div className="action-error" role="alert">
          {actionError}
          <button onClick={() => setActionError("")} aria-label="Dismiss error">×</button>
        </div>
      )}
      <footer className="dungeon-footer">
        <span>PROGRESS IS PERSONAL</span>
        <span>{game.lifetimeXp.toLocaleString()} LIFETIME XP · LEVEL {game.level.toLocaleString()}</span>
      </footer>
      <TaskComposer
        path={path}
        open={composer.open}
        category={composer.category}
        task={composer.task}
        onClose={() => setComposer({ open: false })}
      />
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <SyncNotice />
    </main>
  );
}
