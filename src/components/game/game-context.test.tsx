import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GameProvider, useGame } from "./game-context";
import {
  loadLocalSnapshot,
  recordLocalCompletion,
  replaceLocalTasks,
  saveTimezone,
} from "@/lib/offline/database";
import type { Task } from "@/types/game";

async function clearDatabase(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase("sls-offline");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Test database deletion was blocked."));
  });
}

const tasks: Task[] = [
  {
    id: "yesterday",
    path: "profession",
    category: "everyday",
    title: "Yesterday task",
    description: "",
    xpValue: 10,
    isActive: true,
    createdAt: "2026-10-19T00:00:00.000Z",
    updatedAt: "2026-10-19T00:00:00.000Z",
  },
  {
    id: "today",
    path: "profession",
    category: "everyday",
    title: "Today task",
    description: "",
    xpValue: 10,
    isActive: true,
    createdAt: "2026-10-20T00:00:00.000Z",
    updatedAt: "2026-10-20T00:00:00.000Z",
  },
  {
    id: "last-week",
    path: "profession",
    category: "planned",
    title: "Last week task",
    description: "",
    xpValue: 50,
    isActive: true,
    createdAt: "2026-10-13T00:00:00.000Z",
    updatedAt: "2026-10-13T00:00:00.000Z",
  },
  {
    id: "fresh",
    path: "profession",
    category: "everyday",
    title: "Fresh objective",
    description: "",
    xpValue: 10,
    isActive: true,
    createdAt: "2026-10-20T00:00:00.000Z",
    updatedAt: "2026-10-20T00:00:00.000Z",
  },
];

function Probe() {
  const game = useGame();
  const [actionError, setActionError] = useState("");
  return (
    <div>
      <output data-testid="date">{game.today}</output>
      <output data-testid="timezone">{game.timezone}</output>
      <output data-testid="lifetime">{game.lifetimeXp}</output>
      <output data-testid="level">{game.level}</output>
      <output data-testid="daily">{game.dailyBar.xp}</output>
      <output data-testid="weekly">{game.weeklyBar.xp}</output>
      <output data-testid="monthly">{game.monthlyBar.xp}</output>
      <output data-testid="ready">{String(game.isReady)}</output>
      <button onClick={() => void game.completeTask("fresh")}>Complete fresh</button>
      <button onClick={() => void game.updateTimezone("America/Los_Angeles")}>Change timezone</button>
      <button onClick={() => void game.updateTimezone("Not/A_Timezone").catch((error: Error) => setActionError(error.message))}>Set invalid timezone</button>
      {actionError && <output role="status">{actionError}</output>}
    </div>
  );
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  await clearDatabase();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
});

describe("GameProvider period and profile integration", () => {
  it("computes daily, Tuesday-weekly, monthly, and lifetime XP independently", async () => {
    vi.setSystemTime(new Date("2026-10-20T12:00:00.000Z"));
    await replaceLocalTasks(tasks);
    await saveTimezone("UTC");
    await recordLocalCompletion(tasks[0], "2026-10-19", false);
    await recordLocalCompletion(tasks[1], "2026-10-20", false);
    await recordLocalCompletion(tasks[2], "2026-10-19", false);

    render(<GameProvider><Probe /></GameProvider>);
    await waitFor(() => expect(screen.getByTestId("ready")).toHaveTextContent("true"));

    expect(screen.getByTestId("date")).toHaveTextContent("2026-10-20");
    expect(screen.getByTestId("daily")).toHaveTextContent("10");
    expect(screen.getByTestId("weekly")).toHaveTextContent("10");
    expect(screen.getByTestId("monthly")).toHaveTextContent("70");
    expect(screen.getByTestId("lifetime")).toHaveTextContent("70");
    expect(screen.getByTestId("level")).toHaveTextContent("0");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Complete fresh" }));
    });
    await waitFor(() => expect(screen.getByTestId("daily")).toHaveTextContent("20"));
    expect(screen.getByTestId("weekly")).toHaveTextContent("20");
    expect(screen.getByTestId("monthly")).toHaveTextContent("80");
    expect(screen.getByTestId("lifetime")).toHaveTextContent("80");
    expect((await loadLocalSnapshot()).completions).toHaveLength(4);
  });

  it("validates saved timezones and changes the active local calendar date", async () => {
    vi.setSystemTime(new Date("2026-10-20T02:00:00.000Z"));
    await replaceLocalTasks(tasks);
    await saveTimezone("UTC");

    render(<GameProvider><Probe /></GameProvider>);
    await waitFor(() => expect(screen.getByTestId("ready")).toHaveTextContent("true"));
    expect(screen.getByTestId("date")).toHaveTextContent("2026-10-20");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Change timezone" }));
    });
    await waitFor(() => expect(screen.getByTestId("timezone")).toHaveTextContent("America/Los_Angeles"));
    expect(screen.getByTestId("date")).toHaveTextContent("2026-10-19");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Set invalid timezone" }));
    });
    await waitFor(() => expect(screen.getByText('"Not/A_Timezone" is not a valid IANA timezone.')).toBeInTheDocument());
    expect(screen.getByTestId("timezone")).toHaveTextContent("America/Los_Angeles");
  });
});
