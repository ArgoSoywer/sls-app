import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Completion, Task } from "@/types/game";

const gameHarness = vi.hoisted(() => ({
  game: {
    tasks: [] as Task[],
    completions: [] as Completion[],
    today: "2026-10-20",
    lifetimeXp: 10,
    level: 0,
    isSyncing: false,
    syncAvailable: false,
    isOnline: true,
    error: null,
    clearError: vi.fn(),
    retrySync: vi.fn(),
    completeTask: vi.fn(),
    archiveTask: vi.fn(),
  },
}));

vi.mock("@/components/game/game-context", () => ({
  useGame: () => gameHarness.game,
}));
vi.mock("@/components/system/system-hud", () => ({
  SystemHud: () => <div data-testid="system-hud" />,
}));
vi.mock("@/components/system/settings-panel", () => ({
  SettingsPanel: () => null,
}));
vi.mock("@/components/tasks/task-composer", () => ({
  TaskComposer: () => null,
}));
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: new Proxy({}, { get: (_target, tag: string) => tag }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) =>
    <a href={href} {...props}>{children}</a>,
}));

import { DungeonPage } from "./dungeon-page";

const taskList: Task[] = [
  {
    id: "daily-task",
    path: "academics",
    category: "everyday",
    title: "Read a chapter",
    description: "Take notes.",
    xpValue: 10,
    isActive: true,
    createdAt: "2026-10-20T00:00:00.000Z",
    updatedAt: "2026-10-20T00:00:00.000Z",
  },
  {
    id: "challenge-task",
    path: "academics",
    category: "challenge",
    title: "Write a research summary",
    description: "",
    xpValue: 30,
    isActive: true,
    createdAt: "2026-10-20T00:00:00.000Z",
    updatedAt: "2026-10-20T00:00:00.000Z",
  },
  {
    id: "other-path",
    path: "family",
    category: "everyday",
    title: "Call home",
    description: "",
    xpValue: 10,
    isActive: true,
    createdAt: "2026-10-20T00:00:00.000Z",
    updatedAt: "2026-10-20T00:00:00.000Z",
  },
];

describe("DungeonPage", () => {
  it("shows the path title and only that path's task categories", () => {
    gameHarness.game.tasks = taskList;
    gameHarness.game.completions = [];
    const { container } = render(<DungeonPage path="academics" />);
    expect(screen.getByRole("heading", { name: "Academics" })).toBeInTheDocument();
    expect(screen.getByText("THE ARCANE ARCHIVE")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Everyday" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Challenges" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Planned" })).toBeInTheDocument();
    expect(screen.getByText("Read a chapter")).toBeInTheDocument();
    expect(screen.getByText("Write a research summary")).toBeInTheDocument();
    expect(screen.queryByText("Call home")).not.toBeInTheDocument();
    expect(container.querySelector(".dungeon-academics")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /SYSTEM OVERVIEW/ })).toHaveAttribute("href", "/");
  });

  it("calls completion for an objective and hides it when the completion is reflected", () => {
    gameHarness.game.tasks = taskList;
    gameHarness.game.completions = [];
    const { rerender } = render(<DungeonPage path="academics" />);
    fireEvent.click(screen.getByRole("button", { name: "Complete Read a chapter" }));
    expect(gameHarness.game.completeTask).toHaveBeenCalledWith("daily-task");

    gameHarness.game.completions = [{
      id: "completion-id",
      taskId: "daily-task",
      category: "everyday",
      xp: 10,
      localDate: "2026-10-20",
      idempotencyKey: "completion-id",
      createdAt: "2026-10-20T12:00:00.000Z",
      syncState: "local",
    }];
    rerender(<DungeonPage path="academics" />);
    expect(screen.queryByText("Read a chapter")).not.toBeInTheDocument();
    expect(screen.getByText("Write a research summary")).toBeInTheDocument();
  });
});
