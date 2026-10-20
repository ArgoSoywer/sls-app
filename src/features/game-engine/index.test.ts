import { describe, expect, it } from "vitest";
import {
  dateKeyInTimezone,
  daysInMonth,
  levelForXp,
  levelThreshold,
  periodBar,
  periodRange,
  xpForCategory,
  xpInPeriod,
  displayDate,
  MAX_LEVEL,
  statusForXp,
} from "./index";

describe("level curve", () => {
  it("matches known cumulative XP milestones", () => {
    expect(levelThreshold(1)).toBe(1_000);
    expect(levelThreshold(2)).toBe(2_001);
    expect(levelThreshold(10)).toBe(10_001);
    expect(levelThreshold(100)).toBe(100_050);
    expect(levelThreshold(1_000)).toBe(1_005_012);
    expect(levelThreshold(5_000)).toBe(5_127_084);
    expect(levelThreshold(MAX_LEVEL)).toBe(10_517_037);
  });

  it("never skips a level and resolves every level threshold exactly", () => {
    let previousThreshold = 0;
    for (let level = 1; level <= MAX_LEVEL; level += 1) {
      const threshold = levelThreshold(level);
      expect(threshold).toBeGreaterThan(previousThreshold);
      expect(levelForXp(threshold - 1)).toBe(level - 1);
      expect(levelForXp(threshold)).toBe(level);
      previousThreshold = threshold;
    }
  });

  it("caps the level at 10,000 and rejects invalid input", () => {
    expect(levelForXp(0)).toBe(0);
    expect(levelForXp(999)).toBe(0);
    expect(levelForXp(1_000)).toBe(1);
    expect(levelForXp(levelThreshold(MAX_LEVEL) + 1_000_000)).toBe(MAX_LEVEL);
    expect(() => levelThreshold(-1)).toThrow(RangeError);
    expect(() => levelThreshold(MAX_LEVEL + 1)).toThrow(RangeError);
    expect(() => levelThreshold(1.5)).toThrow(RangeError);
    expect(() => levelForXp(-1)).toThrow(RangeError);
    expect(() => levelForXp(Number.NaN)).toThrow(RangeError);
  });
});

describe("status bars", () => {
  it.each([
    [0, "Loser"],
    [1, "Loser"],
    [299, "Loser"],
    [300, "Loser"],
    [301, "Average Guy"],
    [499, "Average Guy"],
    [500, "Average Guy"],
    [501, "Hard-Working Guy"],
    [749, "Hard-Working Guy"],
    [750, "Hard-Working Guy"],
    [751, "Baddest Guy"],
    [999, "Baddest Guy"],
    [1_000, "Baddest Guy"],
    [1_001, "Monster"],
  ])("maps daily total %i XP to %s", (xp, status) => {
    expect(statusForXp(xp)).toBe(status);
  });

  it.each([
    [2_100, "Loser"],
    [2_101, "Average Guy"],
    [3_500, "Average Guy"],
    [3_501, "Hard-Working Guy"],
    [5_250, "Hard-Working Guy"],
    [5_251, "Baddest Guy"],
    [7_000, "Baddest Guy"],
    [7_001, "Monster"],
  ])("maps weekly total %i XP to %s", (xp, status) => {
    expect(statusForXp(xp, 7)).toBe(status);
  });

  it.each([
    [8_400, "Loser"],
    [8_401, "Average Guy"],
    [14_000, "Average Guy"],
    [14_001, "Hard-Working Guy"],
    [21_000, "Hard-Working Guy"],
    [21_001, "Baddest Guy"],
    [28_000, "Baddest Guy"],
    [28_001, "Monster"],
  ])("maps February total %i XP to %s", (xp, status) => {
    expect(statusForXp(xp, 28)).toBe(status);
  });

  it("fills the current named band and exposes monster overflow", () => {
    expect(periodBar(0)).toMatchObject({ status: "Loser", lowerBound: 0, upperBound: 300, progress: 0 });
    expect(periodBar(300)).toMatchObject({ lowerBound: 0, upperBound: 300, progress: 100 });
    expect(periodBar(501).progress).toBeCloseTo(0.4);
    expect(periodBar(750)).toMatchObject({ status: "Hard-Working Guy", lowerBound: 500, upperBound: 750, progress: 100 });
    expect(periodBar(751)).toMatchObject({ status: "Baddest Guy", lowerBound: 750, upperBound: 1_000, progress: 0.4 });
    expect(periodBar(1_000)).toMatchObject({ status: "Baddest Guy", progress: 100 });
    expect(periodBar(1_050)).toMatchObject({ status: "Monster", progress: 100, overflow: 50 });
    expect(periodBar(3_500, 7)).toMatchObject({ status: "Average Guy", lowerBound: 2_100, upperBound: 3_500, progress: 100 });
    expect(periodBar(28_100, 28)).toMatchObject({ status: "Monster", overflow: 100, progress: 100 });
    expect(() => statusForXp(-1)).toThrow(RangeError);
    expect(() => statusForXp(0, 0)).toThrow(RangeError);
    expect(() => periodBar(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it("assigns all task categories their fixed XP awards", () => {
    expect(xpForCategory("everyday")).toBe(10);
    expect(xpForCategory("challenge")).toBe(30);
    expect(xpForCategory("planned")).toBe(50);
  });
});

describe("calendar periods", () => {
  it("uses Tuesday as weekly start for every day of the week", () => {
    const starts = [
      ["2026-10-19", "2026-10-13"],
      ["2026-10-20", "2026-10-20"],
      ["2026-10-21", "2026-10-20"],
      ["2026-10-22", "2026-10-20"],
      ["2026-10-23", "2026-10-20"],
      ["2026-10-24", "2026-10-20"],
      ["2026-10-25", "2026-10-20"],
      ["2026-10-26", "2026-10-20"],
      ["2026-10-27", "2026-10-27"],
    ];
    for (const [date, start] of starts) {
      const range = periodRange(date, "week");
      expect(range).toEqual({ start, end: range.start === "2026-10-13" ? "2026-10-20" : range.start === "2026-10-27" ? "2026-11-03" : "2026-10-27" });
    }
  });

  it("returns half-open local date ranges and calendar-month boundaries", () => {
    expect(periodRange("2026-10-20", "day")).toEqual({
      start: "2026-10-20",
      end: "2026-10-21",
    });
    expect(periodRange("2026-10-20", "week")).toEqual({
      start: "2026-10-20",
      end: "2026-10-27",
    });
    expect(periodRange("2026-10-19", "week")).toEqual({
      start: "2026-10-13",
      end: "2026-10-20",
    });
    expect(periodRange("2024-02-29", "month")).toEqual({
      start: "2024-02-01",
      end: "2024-03-01",
    });
    expect(periodRange("2026-12-31", "month")).toEqual({
      start: "2026-12-01",
      end: "2027-01-01",
    });
    expect(daysInMonth("2024-02-15")).toBe(29);
    expect(daysInMonth("2026-02-15")).toBe(28);
    expect(daysInMonth("2026-04-30")).toBe(30);
    expect(daysInMonth("2026-07-10")).toBe(31);
    expect(() => periodRange("2026-02-29", "day")).toThrow(RangeError);
    expect(() => daysInMonth("2026-13-01")).toThrow(RangeError);
  });

  it.each([
    ["2026-10-20T02:00:00Z", "America/Los_Angeles", "2026-10-19"],
    ["2026-10-20T02:00:00Z", "Asia/Tokyo", "2026-10-20"],
    ["2026-01-01T00:15:00Z", "America/Los_Angeles", "2025-12-31"],
    ["2024-03-10T09:59:00Z", "America/Los_Angeles", "2024-03-10"],
    ["2024-03-10T10:01:00Z", "America/Los_Angeles", "2024-03-10"],
  ])("calculates %s as %s in %s", (input, timezone, expected) => {
    expect(dateKeyInTimezone(new Date(input), timezone)).toBe(expected);
  });

  it("throws for invalid dates and timezones", () => {
    expect(() => dateKeyInTimezone(new Date("invalid"), "UTC")).toThrow();
    expect(() => dateKeyInTimezone(new Date(), "Not/A_Timezone")).toThrow(RangeError);
    expect(() => displayDate(new Date(), "Not/A_Timezone")).toThrow(RangeError);
  });

  it("calculates XP per independent period and retains lifetime history", () => {
    const completions = [
      { localDate: "2026-10-19", xp: 50 },
      { localDate: "2026-10-20", xp: 10 },
      { localDate: "2026-10-20", xp: 30 },
      { localDate: "2026-10-27", xp: 50 },
      { localDate: "2026-11-01", xp: 10 },
    ];
    expect(xpInPeriod(completions, "2026-10-20", "day")).toBe(40);
    expect(xpInPeriod(completions, "2026-10-20", "week")).toBe(40);
    expect(xpInPeriod(completions, "2026-10-20", "month")).toBe(140);
    expect(xpInPeriod(completions, "2026-10-27", "week")).toBe(60);
    expect(xpInPeriod(completions, "2026-11-01", "month")).toBe(10);
    expect(completions.reduce((total, item) => total + item.xp, 0)).toBe(150);
  });

  it("formats the supplied instant in the selected timezone", () => {
    expect(dateKeyInTimezone(new Date("2026-10-20T02:00:00Z"), "America/Los_Angeles"))
      .toBe("2026-10-19");
    expect(displayDate(new Date("2026-10-20T02:00:00Z"), "America/Los_Angeles"))
      .toContain("Monday, October 19, 2026");
  });
});
