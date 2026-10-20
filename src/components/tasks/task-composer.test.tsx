import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Task } from "@/types/game";

const gameHarness = vi.hoisted(() => ({
  saveTask: vi.fn(),
}));

vi.mock("@/components/game/game-context", () => ({
  useGame: () => ({ saveTask: gameHarness.saveTask }),
}));
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: new Proxy({}, { get: (_target, tag: string) => tag }),
}));

import { TaskComposer } from "./task-composer";

const plannedTask: Task = {
  id: "planned-1",
  path: "academics",
  category: "planned",
  title: "Read an advanced text",
  description: "Take notes.",
  xpValue: 50,
  isActive: true,
  createdAt: "2026-10-20T00:00:00.000Z",
  updatedAt: "2026-10-20T00:00:00.000Z",
};

describe("TaskComposer", () => {
  it("creates a task with its path, category, and entered content", async () => {
    const onClose = vi.fn();
    gameHarness.saveTask.mockResolvedValue(undefined);
    render(<TaskComposer path="survival" open onClose={onClose} category="challenge" />);

    fireEvent.change(screen.getByLabelText("Task name"), { target: { value: "Complete a long hike" } });
    fireEvent.change(screen.getByLabelText("Details OPTIONAL"), { target: { value: "Take water." } });
    fireEvent.click(screen.getByRole("button", { name: "ADD TO PATH" }));

    await waitFor(() => expect(gameHarness.saveTask).toHaveBeenCalledWith({
      path: "survival",
      category: "challenge",
      title: "Complete a long hike",
      description: "Take water.",
    }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps an existing task's category immutable while editing it", async () => {
    const onClose = vi.fn();
    gameHarness.saveTask.mockResolvedValue(undefined);
    render(<TaskComposer path="academics" open onClose={onClose} task={plannedTask} />);

    expect(screen.getByLabelText("Task name")).toHaveValue(plannedTask.title);
    expect(screen.getByLabelText("Category")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Task name"), { target: { value: "Read the revised text" } });
    fireEvent.click(screen.getByRole("button", { name: "SAVE CHANGES" }));

    await waitFor(() => expect(gameHarness.saveTask).toHaveBeenCalledWith({
      id: plannedTask.id,
      path: "academics",
      category: "planned",
      title: "Read the revised text",
      description: "Take notes.",
    }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps the editor open and surfaces save failures", async () => {
    const onClose = vi.fn();
    gameHarness.saveTask.mockRejectedValue(new Error("Local storage is unavailable."));
    render(<TaskComposer path="family" open onClose={onClose} />);
    fireEvent.change(screen.getByLabelText("Task name"), { target: { value: "Call home" } });
    fireEvent.click(screen.getByRole("button", { name: "ADD TO PATH" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Local storage is unavailable.");
    expect(onClose).not.toHaveBeenCalled();
  });
});
