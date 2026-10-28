import type { PeriodBar, StatusName, TaskCategory } from "@/types/game";
import type { Completion } from "@/types/game";

export { CATEGORY_INFO, isPathKey, PATH_INFO, TASK_CATEGORY_ORDER } from "./metadata";

export const MAX_LEVEL = 10_000;
export const XP_BY_CATEGORY: Record<TaskCategory, number> = {
  everyday: 10,
  challenge: 30,
  planned: 50,
};

const DAILY_THRESHOLDS = [300, 500, 750, 1_000] as const;
const STATUS_NAMES: readonly StatusName[] = [
  "Looser",
  "Average Guy",
  "Hard-Working Guy",
  "Baddest Guy",
];
const LEVEL_GROWTH = 1.00001;

export function xpForCategory(category: TaskCategory): number {
  return XP_BY_CATEGORY[category];
}

export function levelThreshold(level: number): number {
  if (!Number.isInteger(level) || level < 0 || level > MAX_LEVEL) {
    throw new RangeError(`Level must be an integer from 0 to ${MAX_LEVEL}.`);
  }
  if (level === 0) return 0;
  if (level === 1) return 1_000;
  return Math.ceil(
    1_000 * (Math.pow(LEVEL_GROWTH, level) - 1) / (LEVEL_GROWTH - 1),
  );
}

export function levelForXp(totalXp: number): number {
  if (!Number.isFinite(totalXp) || totalXp < 0) {
    throw new RangeError("Total XP must be a finite non-negative number.");
  }
  let low = 0;
  let high = MAX_LEVEL;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (levelThreshold(middle) <= totalXp) low = middle;
    else high = middle - 1;
  }
  return low;
}

export function statusForXp(xp: number, scale = 1): StatusName {
  if (!Number.isFinite(xp) || xp < 0 || !Number.isFinite(scale) || scale <= 0) {
    throw new RangeError("XP must be non-negative and scale must be positive.");
  }
  for (let index = 0; index < DAILY_THRESHOLDS.length; index += 1) {
    if (xp <= DAILY_THRESHOLDS[index] * scale) return STATUS_NAMES[index];
  }
  return "Monster";
}

export function periodBar(xp: number, scale = 1): PeriodBar {
  const status = statusForXp(xp, scale);
  const statusIndex = STATUS_NAMES.indexOf(status);
  if (status === "Monster") {
    const threshold = DAILY_THRESHOLDS[DAILY_THRESHOLDS.length - 1] * scale;
    return {
      status,
      xp,
      lowerBound: threshold,
      upperBound: threshold,
      progress: 100,
      overflow: xp - threshold,
    };
  }

  const lowerBound = statusIndex === 0
    ? 0
    : DAILY_THRESHOLDS[statusIndex - 1] * scale;
  const upperBound = DAILY_THRESHOLDS[statusIndex] * scale;
  return {
    status,
    xp,
    lowerBound,
    upperBound,
    progress: Math.min(100, Math.max(0, ((xp - lowerBound) / (upperBound - lowerBound)) * 100)),
    overflow: 0,
  };
}

export function dateKeyInTimezone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  const year = value("year");
  const month = value("month");
  const day = value("day");
  if (!year || !month || !day) {
    throw new Error(`Unable to calculate calendar date for timezone "${timeZone}".`);
  }
  return `${year}-${month}-${day}`;
}

export type PeriodKind = "day" | "week" | "month";
export interface DateRange {
  start: string;
  end: string;
}

function shiftDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}

function parseDateKey(dateKey: string): [number, number, number] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new RangeError(`Invalid calendar date "${dateKey}".`);
  }
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    !year
    || month < 1
    || month > 12
    || date.getUTCFullYear() !== year
    || date.getUTCMonth() + 1 !== month
    || date.getUTCDate() !== day
  ) {
    throw new RangeError(`Invalid calendar date "${dateKey}".`);
  }
  return [year, month, day];
}

export function periodRange(dateKey: string, kind: PeriodKind): DateRange {
  const [year, month, day] = parseDateKey(dateKey);
  if (kind === "day") return { start: dateKey, end: shiftDateKey(dateKey, 1) };
  if (kind === "month") {
    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = new Date(Date.UTC(year, month, 1));
    const end = `${endDate.getUTCFullYear()}-${String(endDate.getUTCMonth() + 1).padStart(2, "0")}-01`;
    return { start, end };
  }
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const daysSinceTuesday = (weekday - 2 + 7) % 7;
  const start = shiftDateKey(dateKey, -daysSinceTuesday);
  return { start, end: shiftDateKey(start, 7) };
}

export function xpInPeriod(
  completions: readonly Pick<Completion, "localDate" | "xp">[],
  dateKey: string,
  kind: PeriodKind,
): number {
  const { start, end } = periodRange(dateKey, kind);
  return completions.reduce(
    (total, completion) =>
      completion.localDate >= start && completion.localDate < end
        ? total + completion.xp
        : total,
    0,
  );
}

export function daysInMonth(dateKey: string): number {
  const [year, month] = parseDateKey(dateKey);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function calendarMonthDays(dateKey: string): string[] {
  const [year, month] = parseDateKey(dateKey);
  const firstDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const mondayOffset = (firstDay + 6) % 7;
  const days = daysInMonth(dateKey);
  const cellCount = Math.ceil((mondayOffset + days) / 7) * 7;
  const firstCell = new Date(Date.UTC(year, month - 1, 1 - mondayOffset));
  return Array.from({ length: cellCount }, (_, index) => {
    const date = new Date(Date.UTC(
      firstCell.getUTCFullYear(),
      firstCell.getUTCMonth(),
      firstCell.getUTCDate() + index,
    ));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  });
}

export function addCalendarMonths(dateKey: string, offset: number): string {
  const [year, month] = parseDateKey(dateKey);
  if (!Number.isInteger(offset)) throw new RangeError("Month offset must be an integer.");
  const nextMonth = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${nextMonth.getUTCFullYear()}-${String(nextMonth.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export function displayDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone,
  }).format(date);
}
