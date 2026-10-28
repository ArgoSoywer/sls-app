"use client";

import { CATEGORY_INFO, displayDate, PATH_INFO } from "@/features/game-engine";
import type { PathKey, Task, TaskCategory } from "@/types/game";
import { PATHS } from "@/types/game";

export function CalendarDayPanel({
  activeDate,
  dayTasks,
  timezone,
  selectedPath,
  selectedCategory,
  onAddTask,
  onEditTask,
  onSelectPath,
  onSelectCategory,
}: {
  activeDate: string;
  dayTasks: Task[];
  timezone: string;
  selectedPath: PathKey;
  selectedCategory: TaskCategory;
  onAddTask: () => void;
  onEditTask: (task: Task) => void;
  onSelectPath: (path: PathKey) => void;
  onSelectCategory: (category: TaskCategory) => void;
}) {
  return (
    <aside className="calendar-day-panel" aria-label={`Tasks for ${activeDate}`}>
      <div className="calendar-selected-date">
        <span className="eyebrow">SELECTED DATE</span>
        <h2>{displayDate(new Date(`${activeDate}T12:00:00Z`), "UTC")}</h2>
        <span className="calendar-date-zone">{timezone}</span>
      </div>
      <div className="calendar-task-heading">
        <div>
          <span className="eyebrow">PLANNED OBJECTIVES</span>
          <p>{dayTasks.length} {dayTasks.length === 1 ? "task" : "tasks"} scheduled</p>
        </div>
        <button className="calendar-add-button" onClick={onAddTask} aria-label="Add task to selected date">+</button>
      </div>
      <div className="calendar-scheduled-list">
        {dayTasks.map((task) => (
          <article className="calendar-scheduled-task" key={task.id}>
            <span className={`calendar-task-marker marker-${task.category}`} aria-hidden="true" />
            <div>
              <h3>{task.title}</h3>
              {task.description && <p>{task.description}</p>}
              <span>{PATH_INFO[task.path].title} · {CATEGORY_INFO[task.category].singularLabel} · {task.xpValue} XP</span>
            </div>
            <button
              className="calendar-edit-button"
              aria-label={`Edit ${task.title}`}
              onClick={() => onEditTask(task)}
            >EDIT</button>
          </article>
        ))}
        {dayTasks.length === 0 && (
          <div className="calendar-empty-state">
            <span aria-hidden="true">◇</span>
            <p>No objectives scheduled for this date.</p>
            <button onClick={onAddTask}>Add an objective</button>
          </div>
        )}
      </div>
      <div className="calendar-create-row">
        <label htmlFor="calendar-path">ADD TO PATH</label>
        <select
          id="calendar-path"
          value={selectedPath}
          onChange={(event) => onSelectPath(event.target.value as PathKey)}
        >
          {PATHS.map((path) => <option key={path} value={path}>{PATH_INFO[path].title}</option>)}
        </select>
        <label htmlFor="calendar-category">CATEGORY</label>
        <select
          id="calendar-category"
          value={selectedCategory}
          onChange={(event) => onSelectCategory(event.target.value as TaskCategory)}
        >
          {(["everyday", "challenge", "planned"] as const).map((category) => (
            <option key={category} value={category}>{CATEGORY_INFO[category].singularLabel}</option>
          ))}
        </select>
        <button className="calendar-new-task-button" onClick={onAddTask}>
          CREATE TASK FOR THIS DATE
        </button>
      </div>
    </aside>
  );
}
