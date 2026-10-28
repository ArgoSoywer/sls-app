"use client";

import {
  displayDate,
} from "@/features/game-engine";
import type { Task } from "@/types/game";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function monthTitle(dateKey: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${dateKey.slice(0, 7)}-01T12:00:00Z`));
}

function CalendarDay({
  date,
  activeDate,
  today,
  monthKey,
  tasks,
  onSelect,
}: {
  date: string;
  activeDate: string;
  today: string;
  monthKey: string;
  tasks: Task[];
  onSelect: (date: string) => void;
}) {
  const isCurrentMonth = date.slice(0, 7) === monthKey;
  return (
    <button
      type="button"
      className={[
        "calendar-day",
        isCurrentMonth ? "" : "calendar-day-outside",
        date === activeDate ? "calendar-day-selected" : "",
        date === today ? "calendar-day-today" : "",
      ].filter(Boolean).join(" ")}
      aria-label={`${displayDate(new Date(`${date}T12:00:00Z`), "UTC")}${tasks.length ? `, ${tasks.length} scheduled tasks` : ""}`}
      aria-pressed={date === activeDate}
      onClick={() => onSelect(date)}
    >
      <span className="calendar-day-number">{Number(date.slice(-2))}</span>
      {tasks.length > 0 && (
        <span className="calendar-task-count">
          <i aria-hidden="true" />
          {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
        </span>
      )}
    </button>
  );
}

export function CalendarMonthBoard({
  days,
  activeDate,
  today,
  monthKey,
  visibleMonth,
  tasksByDate,
  onSelectDate,
  onChangeMonth,
  onToday,
}: {
  days: string[];
  activeDate: string;
  today: string;
  monthKey: string;
  visibleMonth: string;
  tasksByDate: Map<string, Task[]>;
  onSelectDate: (date: string) => void;
  onChangeMonth: (offset: number) => void;
  onToday: () => void;
}) {
  return (
    <div className="calendar-board">
      <div className="calendar-month-heading">
        <button
          className="calendar-month-button"
          onClick={() => onChangeMonth(-1)}
          aria-label="Previous month"
        >←</button>
        <h2>{monthTitle(visibleMonth)}</h2>
        <button
          className="calendar-month-button"
          onClick={() => onChangeMonth(1)}
          aria-label="Next month"
        >→</button>
        <button className="calendar-today-button" onClick={onToday}>TODAY</button>
      </div>
      <div className="calendar-weekdays" aria-hidden="true">
        {WEEKDAYS.map((weekday) => <span key={weekday}>{weekday.slice(0, 3)}</span>)}
      </div>
      <div className="calendar-grid">
        {days.map((date) => (
          <CalendarDay
            key={date}
            date={date}
            activeDate={activeDate}
            today={today}
            monthKey={monthKey}
            tasks={tasksByDate.get(date) ?? []}
            onSelect={onSelectDate}
          />
        ))}
      </div>
      <div className="calendar-legend">
        <span><i className="legend-today" /> TODAY</span>
        <span><i className="legend-planned" /> SCHEDULED OBJECTIVES</span>
      </div>
    </div>
  );
}
