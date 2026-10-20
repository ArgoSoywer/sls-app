import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PeriodBar } from "@/types/game";

const gameHarness = vi.hoisted(() => ({
  game: {
    dailyBar: { status: "Loser", xp: 300, upperBound: 300, progress: 100, overflow: 0 } as PeriodBar,
    weeklyBar: { status: "Average Guy", xp: 3_500, upperBound: 3_500, progress: 100, overflow: 0 } as PeriodBar,
    monthlyBar: { status: "Baddest Guy", xp: 20_000, upperBound: 31_000, progress: 75, overflow: 0 } as PeriodBar,
    now: new Date("2026-10-20T12:00:00.000Z"),
    timezone: "UTC",
    today: "2026-10-20",
    level: 42,
  },
}));

vi.mock("@/components/game/game-context", () => ({
  useGame: () => gameHarness.game,
  displayDate: () => "Tuesday, October 20, 2026",
}));
vi.mock("next/dynamic", () => ({
  default: () => () => <div data-testid="character" />,
}));

import { SystemHud } from "./system-hud";

describe("SystemHud", () => {
  it("renders all period totals and takes the primary status only from the monthly bar", () => {
    render(<SystemHud onSettings={() => undefined} />);
    expect(screen.getByRole("progressbar", { name: "Daily rank progress" })).toHaveAttribute("aria-valuemax", "300");
    expect(screen.getByRole("progressbar", { name: "Weekly rank progress" })).toHaveAttribute("aria-valuemax", "3500");
    expect(screen.getByRole("progressbar", { name: "Monthly rank progress" })).toHaveAttribute("aria-valuemax", "31000");
    expect(screen.getByText("Tuesday, October 20, 2026")).toBeInTheDocument();
    expect(screen.getByText("Baddest Guy", { selector: ".master-status" })).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByTestId("character")).toBeInTheDocument();
  });
});
