"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  addCalendarMonths,
  calendarMonthDays,
  displayDate,
} from "@/features/game-engine";
import { useGame } from "@/components/game/game-context";
import { CalendarDayPanel } from "@/components/calendar/calendar-day-panel";
import { CalendarMonthBoard } from "@/components/calendar/calendar-month-board";
import { TaskComposer } from "@/components/tasks/task-composer";
import type { PathKey, Task, TaskCategory } from "@/types/game";

export function CalendarPage() {
  const game = useGame();
  const [visibleMonth, setVisibleMonth] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedPath, setSelectedPath] = useState<PathKey>("profession");
  const [selectedCategory, setSelectedCategory] = useState<TaskCategory>("everyday");
  const [editingTask, setEditingTask] = useState<Task | undefined>();
  const [composerOpen, setComposerOpen] = useState(false);
  const activeDate = selectedDate || game.today;
  const displayedMonth = visibleMonth || `${game.today.slice(0, 7)}-01`;

  useEffect(() => {
    if (!visibleMonth) setVisibleMonth(`${game.today.slice(0, 7)}-01`);
    if (!selectedDate) setSelectedDate(game.today);
  }, [game.today, selectedDate, visibleMonth]);

  const days = useMemo(() => calendarMonthDays(displayedMonth), [displayedMonth]);
  const tasksByDate = useMemo(() => {
    const index = new Map<string, Task[]>();
    for (const task of game.tasks) {
      if (!task.isActive || !task.scheduledDate) continue;
      const tasks = index.get(task.scheduledDate) ?? [];
      tasks.push(task);
      index.set(task.scheduledDate, tasks);
    }
    return index;
  }, [game.tasks]);
  const dayTasks = tasksByDate.get(activeDate) ?? [];

  const changeMonth = (offset: number) => {
    const nextMonth = addCalendarMonths(displayedMonth, offset);
    setVisibleMonth(nextMonth);
    if (!activeDate.startsWith(nextMonth.slice(0, 7))) setSelectedDate(nextMonth);
  };

  const addTask = () => {
    setEditingTask(undefined);
    setComposerOpen(true);
  };

  const editTask = (task: Task) => {
    setSelectedPath(task.path);
    setSelectedCategory(task.category);
    setEditingTask(task);
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
        <CalendarMonthBoard
          days={days}
          activeDate={activeDate}
          today={game.today}
          monthKey={displayedMonth.slice(0, 7)}
          visibleMonth={displayedMonth}
          tasksByDate={tasksByDate}
          onSelectDate={setSelectedDate}
          onChangeMonth={changeMonth}
          onToday={() => {
            setVisibleMonth(`${game.today.slice(0, 7)}-01`);
            setSelectedDate(game.today);
          }}
        />
        <CalendarDayPanel
          activeDate={activeDate}
          dayTasks={dayTasks}
          timezone={game.timezone}
          selectedPath={selectedPath}
          selectedCategory={selectedCategory}
          onAddTask={addTask}
          onEditTask={editTask}
          onSelectPath={setSelectedPath}
          onSelectCategory={setSelectedCategory}
        />
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
