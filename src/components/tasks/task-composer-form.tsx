"use client";

import { CATEGORY_INFO, TASK_CATEGORY_ORDER, xpForCategory } from "@/features/game-engine";
import type { Task, TaskCategory } from "@/types/game";

const categories = TASK_CATEGORY_ORDER.map((value) => ({
  value,
  label: CATEGORY_INFO[value].label,
  xp: xpForCategory(value),
}));

export function TaskComposerForm({
  task,
  title,
  description,
  date,
  category,
  error,
  saving,
  onTitleChange,
  onDescriptionChange,
  onDateChange,
  onCategoryChange,
  onSubmit,
}: {
  task?: Task;
  title: string;
  description: string;
  date: string;
  category: TaskCategory;
  error: string;
  saving: boolean;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onCategoryChange: (value: TaskCategory) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit}>
      <label htmlFor="task-title">Task name</label>
      <input
        id="task-title"
        value={title}
        onChange={(event) => onTitleChange(event.target.value)}
        placeholder="Name the objective"
        maxLength={100}
        required
        autoFocus
      />
      <label htmlFor="task-description">Details <span>OPTIONAL</span></label>
      <textarea
        id="task-description"
        value={description}
        onChange={(event) => onDescriptionChange(event.target.value)}
        placeholder="Add a detail or reminder"
        rows={3}
        maxLength={400}
      />
      <label htmlFor="task-category">Category</label>
      <select
        id="task-category"
        value={category}
        disabled={Boolean(task)}
        onChange={(event) => onCategoryChange(event.target.value as TaskCategory)}
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
        onChange={(event) => onDateChange(event.target.value)}
      />
      {task && <p className="form-help">Task category and reward stay fixed after creation.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button" type="submit" disabled={saving}>
        {saving ? "SAVING…" : task ? "SAVE CHANGES" : "ADD TO PATH"}
      </button>
    </form>
  );
}
