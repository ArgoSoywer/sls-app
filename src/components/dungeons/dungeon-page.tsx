"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "@/components/game/game-context";
import { SystemHud } from "@/components/system/system-hud";
import { SettingsPanel } from "@/components/system/settings-panel";
import { TaskComposer } from "@/components/tasks/task-composer";
import { CATEGORY_INFO, PATH_INFO, TASK_CATEGORY_ORDER, xpForCategory } from "@/features/game-engine";
import type { PathKey, Task, TaskCategory } from "@/types/game";

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
            <motion.section
              className={`task-category category-${category.value}`}
              key={category.value}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.07, duration: 0.35 }}
              aria-labelledby={`category-${category.value}`}
            >
              <div className="category-heading">
                <div>
                  <span className="category-index">0{index + 1} / OBJECTIVES</span>
                  <h2 id={`category-${category.value}`}>{category.label}</h2>
                  <p>{category.subtitle} · {category.xp} XP</p>
                </div>
                <button
                  className="add-task-button"
                  onClick={() => setComposer({ open: true, category: category.value })}
                  aria-label={`Add ${category.label.toLowerCase()} task`}
                >
                  <span>+</span> ADD
                </button>
              </div>
              <div className="task-list">
                <AnimatePresence initial={false}>
                  {list.map((task) => {
                    return (
                      <motion.article
                        key={task.id}
                        className="task-card"
                        layout
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, filter: "blur(12px) brightness(2.8)", x: 26, scale: 0.96 }}
                        transition={{ duration: 0.28 }}
                      >
                        <button
                          className="task-check"
                          aria-label={`Complete ${task.title}`}
                          onClick={() => void complete(task)}
                        >
                        </button>
                        <div className="task-copy">
                          <h3>{task.title}</h3>
                          {task.description && <p>{task.description}</p>}
                        </div>
                        <span className="task-xp">+{task.xpValue}<small> XP</small></span>
                        <div className="task-actions">
                          <button onClick={() => setComposer({ open: true, task })} aria-label={`Edit ${task.title}`}>EDIT</button>
                          <button onClick={() => void archive(task)} aria-label={`Archive ${task.title}`}>ARCHIVE</button>
                        </div>
                      </motion.article>
                    );
                  })}
                </AnimatePresence>
                {list.length === 0 && (
                  <div className="empty-category">
                    <span aria-hidden="true">◇</span>
                    <p>No directives in this category.</p>
                    <button onClick={() => setComposer({ open: true, category: category.value })}>Create the first</button>
                  </div>
                )}
              </div>
            </motion.section>
          );
        })}
      </section>

      {actionError && (
        <div className="action-error" role="alert">
          {actionError}
          <button onClick={() => setActionError("")} aria-label="Dismiss error">×</button>
        </div>
      )}
      {game.error && (
        <div className="sync-notice" role="status">
          <span>{game.error}</span>
          {game.syncAvailable && game.isOnline && (
            <button onClick={() => void game.retrySync()} disabled={game.isSyncing}>
              {game.isSyncing ? "SYNCING…" : "RETRY"}
            </button>
          )}
          <button className="notice-close" aria-label="Dismiss notification" onClick={game.clearError}>×</button>
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
    </main>
  );
}
