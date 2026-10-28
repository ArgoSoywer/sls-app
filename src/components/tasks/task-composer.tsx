"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "@/components/game/game-context";
import { CATEGORY_INFO, TASK_CATEGORY_ORDER, xpForCategory } from "@/features/game-engine";
import type { PathKey, Task, TaskCategory } from "@/types/game";

const categories = TASK_CATEGORY_ORDER.map((value) => ({
  value,
  label: CATEGORY_INFO[value].label,
  xp: xpForCategory(value),
}));

export function TaskComposer({
  path,
  open,
  onClose,
  task,
  category,
  scheduledDate,
}: {
  path: PathKey;
  open: boolean;
  onClose: () => void;
  task?: Task;
  category?: TaskCategory;
  scheduledDate?: string;
}) {
  const { saveTask } = useGame();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<TaskCategory>(category ?? "everyday");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");
    setDate(task?.scheduledDate ?? scheduledDate ?? "");
    setSelectedCategory(task?.category ?? category ?? "everyday");
    setError("");
  }, [category, scheduledDate, task, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open, saving]);

  if (!open) return null;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await saveTask({
        id: task?.id,
        path,
        category: selectedCategory,
        title,
        description,
        scheduledDate: date || null,
      });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this task.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget && !saving) onClose();
        }}
      >
        <motion.section
          className="task-composer modal-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="task-composer-title"
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ duration: 0.22 }}
        >
          <button className="modal-close" onClick={onClose} aria-label="Close task form" disabled={saving}>×</button>
          <span className="eyebrow">{task ? "AMEND YOUR DIRECTIVE" : "ISSUE A NEW DIRECTIVE"}</span>
          <h2 id="task-composer-title">{task ? "Edit task" : "Add task"}</h2>
          <form onSubmit={(event) => void submit(event)}>
            <label htmlFor="task-title">Task name</label>
            <input
              id="task-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Name the objective"
              maxLength={100}
              required
              autoFocus
            />
            <label htmlFor="task-description">Details <span>OPTIONAL</span></label>
            <textarea
              id="task-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Add a detail or reminder"
              rows={3}
              maxLength={400}
            />
            <label htmlFor="task-category">Category</label>
            <select
              id="task-category"
              value={selectedCategory}
              disabled={Boolean(task)}
              onChange={(event) => setSelectedCategory(event.target.value as TaskCategory)}
            >
              {categories.map((item) => (
                <option key={item.value} value={item.value}>{item.label} · {item.xp} XP</option>
              ))}
            </select>
            <label htmlFor="task-scheduled-date">Scheduled date <span>OPTIONAL</span></label>
            <input
              id="task-scheduled-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
            {task && <p className="form-help">Task category and reward stay fixed after creation.</p>}
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? "SAVING…" : task ? "SAVE CHANGES" : "ADD TO PATH"}
            </button>
          </form>
        </motion.section>
      </motion.div>
    </AnimatePresence>
  );
}
