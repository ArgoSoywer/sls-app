"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { Task, TaskCategory } from "@/types/game";

export interface DungeonCategory {
  value: TaskCategory;
  label: string;
  subtitle: string;
  xp: number;
}

function TaskCard({
  task,
  onComplete,
  onEdit,
  onArchive,
}: {
  task: Task;
  onComplete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onArchive: (task: Task) => void;
}) {
  return (
    <motion.article
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
        onClick={() => onComplete(task)}
      />
      <div className="task-copy">
        <h3>{task.title}</h3>
        {task.description && <p>{task.description}</p>}
      </div>
      <span className="task-xp">+{task.xpValue}<small> XP</small></span>
      <div className="task-actions">
        <button onClick={() => onEdit(task)} aria-label={`Edit ${task.title}`}>EDIT</button>
        <button onClick={() => onArchive(task)} aria-label={`Archive ${task.title}`}>ARCHIVE</button>
      </div>
    </motion.article>
  );
}

export function DungeonTaskCategory({
  category,
  index,
  tasks,
  onAdd,
  onComplete,
  onEdit,
  onArchive,
}: {
  category: DungeonCategory;
  index: number;
  tasks: Task[];
  onAdd: () => void;
  onComplete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onArchive: (task: Task) => void;
}) {
  return (
    <motion.section
      className={`task-category category-${category.value}`}
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
          onClick={onAdd}
          aria-label={`Add ${category.label.toLowerCase()} task`}
        >
          <span>+</span> ADD
        </button>
      </div>
      <div className="task-list">
        <AnimatePresence initial={false}>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onComplete={onComplete}
              onEdit={onEdit}
              onArchive={onArchive}
            />
          ))}
        </AnimatePresence>
        {tasks.length === 0 && (
          <div className="empty-category">
            <span aria-hidden="true">◇</span>
            <p>No directives in this category.</p>
            <button onClick={onAdd}>Create the first</button>
          </div>
        )}
      </div>
    </motion.section>
  );
}
