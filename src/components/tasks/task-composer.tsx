"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "@/components/game/game-context";
import { TaskComposerForm } from "@/components/tasks/task-composer-form";
import type { PathKey, Task, TaskCategory } from "@/types/game";

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
          <TaskComposerForm
            task={task}
            title={title}
            description={description}
            date={date}
            category={selectedCategory}
            error={error}
            saving={saving}
            onTitleChange={setTitle}
            onDescriptionChange={setDescription}
            onDateChange={setDate}
            onCategoryChange={setSelectedCategory}
            onSubmit={(event) => void submit(event)}
          />
        </motion.section>
      </motion.div>
    </AnimatePresence>
  );
}
