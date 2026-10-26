"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  addCalendarMonths,
  calendarMonthDays,
  displayDate,
} from "@/features/game-engine";
import { useGame } from "@/components/game/game-context";
import { TaskComposer } from "@/components/tasks/task-composer";
import type { PathKey, Task, TaskCategory } from "@/types/game";
import { PATHS } from "@/types/game";

const PATH_LABELS: Record<PathKey, string> = {
  profession: "Profession",
  academics: "Academics",
  survival: "Survival",
  mentality: "Mentality",
  family: "Family",
};

const CATEGORY_LABELS: Record<TaskCategory, string> = {
  everyday: "Everyday",
  challenge: "Challenge",
  planned: "Planned",
};

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function monthTitle(dateKey: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${dateKey.slice(0, 7)}-01T12:00:00Z`));
}

function dayNumber(dateKey: string): number {
  return Number(dateKey.slice(-2));
}

export function CalendarPage() {
  const game = useGame();
  const [visibleMonth, setVisibleMonth] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedPath, setSelectedPath] = useState<PathKey>("profession");
  const [selectedCategory, setSelectedCategory] = useState<TaskCategory>("everyday");
  const [editingTask, setEditingTask] = useState<Task | undefined>();
  const [composerOpen, setComposerOpen] = useState(false);
  const activeDate = selectedDate || game.today;

  useEffect(() => {
    if (!visibleMonth) setVisibleMonth(`${game.today.slice(0, 7)}-01`);
    if (!selectedDate) setSelectedDate(game.today);
  }, [game.today, selectedDate, visibleMonth]);

  const days = useMemo(
    () => calendarMonthDays(visibleMonth || game.today),
    [game.today, visibleMonth],
  );
  const monthKey = (visibleMonth || game.today).slice(0, 7);
  const tasksByDate = useMemo(() => {
    const index = new Map<string, Task[]>();
    for (const task of game.tasks) {
      if (!task.isActive || !task.scheduledDate) continue;
      const matches = index.get(task.scheduledDate) ?? [];
      matches.push(task);
      index.set(task.scheduledDate, matches);
    }
    return index;
  }, [game.tasks]);
  const dayTasks = tasksByDate.get(activeDate) ?? [];

  const changeMonth = (offset: number) => {
    const nextMonth = addCalendarMonths(visibleMonth || game.today, offset);
    setVisibleMonth(nextMonth);
    if (!activeDate.startsWith(nextMonth.slice(0, 7))) setSelectedDate(nextMonth);
  };

  const addTask = () => {
    setEditingTask(undefined);
    setComposerOpen(true);
  };

  return (
    <main className="calendar-screen">
      <header className="calendar-header">
        <Link href="/" className="back-to-system"><span aria-hidden="true">←</span> SYSTEM OVERVIEW</Link>
        <div className="calendar-header-copy">
          <span className="eyebrow">TIME IS YOUR TERRAIN</span>
          <h1>Calendar</h1>
          <p>Choose a date to view its planned objectives or create a new one.</p>
        </div>
        <div className="calendar-header-meta">
          <span>LOCAL DATE</span>
          <strong>{displayDate(new Date(`${game.today}T12:00:00Z`), "UTC")}</strong>
          <small>{game.timezone}</small>
        </div>
      </header>

      <section className="calendar-layout" aria-label="Task calendar">
        <div className="calendar-board">
          <div className="calendar-month-heading">
            <button
              className="calendar-month-button"
              onClick={() => changeMonth(-1)}
              aria-label="Previous month"
            >←</button>
            <h2>{monthTitle(visibleMonth || game.today)}</h2>
            <button
              className="calendar-month-button"
              onClick={() => changeMonth(1)}
              aria-label="Next month"
            >→</button>
            <button
              className="calendar-today-button"
              onClick={() => {
                setVisibleMonth(`${game.today.slice(0, 7)}-01`);
                setSelectedDate(game.today);
              }}
            >TODAY</button>
          </div>
          <div className="calendar-weekdays" aria-hidden="true">
            {WEEKDAYS.map((weekday) => <span key={weekday}>{weekday.slice(0, 3)}</span>)}
          </div>
          <div className="calendar-grid">
            {days.map((date) => {
              const dateTasks = tasksByDate.get(date) ?? [];
              const isCurrentMonth = date.slice(0, 7) === monthKey;
              return (
                <button
                  type="button"
                  key={date}
                  className={[
                    "calendar-day",
                    isCurrentMonth ? "" : "calendar-day-outside",
                    date === activeDate ? "calendar-day-selected" : "",
                    date === game.today ? "calendar-day-today" : "",
                  ].filter(Boolean).join(" ")}
                  aria-label={`${displayDate(new Date(`${date}T12:00:00Z`), "UTC")}${dateTasks.length ? `, ${dateTasks.length} scheduled tasks` : ""}`}
                  aria-pressed={date === activeDate}
                  onClick={() => setSelectedDate(date)}
                >
                  <span className="calendar-day-number">{dayNumber(date)}</span>
                  {dateTasks.length > 0 && (
                    <span className="calendar-task-count">
                      <i aria-hidden="true" />
                      {dateTasks.length} {dateTasks.length === 1 ? "task" : "tasks"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="calendar-legend">
            <span><i className="legend-today" /> TODAY</span>
            <span><i className="legend-planned" /> SCHEDULED OBJECTIVES</span>
          </div>
        </div>

        <aside className="calendar-day-panel" aria-label={`Tasks for ${activeDate}`}>
          <div className="calendar-selected-date">
            <span className="eyebrow">SELECTED DATE</span>
            <h2>{displayDate(new Date(`${activeDate}T12:00:00Z`), "UTC")}</h2>
            <span className="calendar-date-zone">{game.timezone}</span>
          </div>
          <div className="calendar-task-heading">
            <div>
              <span className="eyebrow">PLANNED OBJECTIVES</span>
              <p>{dayTasks.length} {dayTasks.length === 1 ? "task" : "tasks"} scheduled</p>
            </div>
            <button className="calendar-add-button" onClick={addTask} aria-label="Add task to selected date">+</button>
          </div>
          <div className="calendar-scheduled-list">
            {dayTasks.map((task) => (
              <article className="calendar-scheduled-task" key={task.id}>
                <span className={`calendar-task-marker marker-${task.category}`} aria-hidden="true" />
                <div>
                  <h3>{task.title}</h3>
                  {task.description && <p>{task.description}</p>}
                  <span>{PATH_LABELS[task.path]} · {CATEGORY_LABELS[task.category]} · {task.xpValue} XP</span>
                </div>
                <button
                  className="calendar-edit-button"
                  aria-label={`Edit ${task.title}`}
                  onClick={() => {
                    setSelectedPath(task.path);
                    setSelectedCategory(task.category);
                    setEditingTask(task);
                    setComposerOpen(true);
                  }}
                >EDIT</button>
              </article>
            ))}
            {dayTasks.length === 0 && (
              <div className="calendar-empty-state">
                <span aria-hidden="true">◇</span>
                <p>No objectives scheduled for this date.</p>
                <button onClick={addTask}>Add an objective</button>
              </div>
            )}
          </div>
          <div className="calendar-create-row">
            <label htmlFor="calendar-path">ADD TO PATH</label>
            <select
              id="calendar-path"
              value={selectedPath}
              onChange={(event) => setSelectedPath(event.target.value as PathKey)}
            >
              {PATHS.map((path) => <option key={path} value={path}>{PATH_LABELS[path]}</option>)}
            </select>
            <label htmlFor="calendar-category">CATEGORY</label>
            <select
              id="calendar-category"
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value as TaskCategory)}
            >
              {(["everyday", "challenge", "planned"] as const).map((category) => (
                <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>
              ))}
            </select>
            <button className="calendar-new-task-button" onClick={() => setComposerOpen(true)}>
              CREATE TASK FOR THIS DATE
            </button>
          </div>
        </aside>
      </section>

      <TaskComposer
        path={selectedPath}
        category={selectedCategory}
        scheduledDate={activeDate}
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        task={editingTask}
      />
    </main>
  );
}
