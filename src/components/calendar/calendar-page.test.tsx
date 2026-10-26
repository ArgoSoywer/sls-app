import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Completion, Task } from "@/types/game";

const gameHarness = vi.hoisted(() => ({
  game: {
    today: "2026-10-20",
    timezone: "America/New_York",
    tasks: [] as Task[],
    completions: [] as Completion[],
  },
  composer: vi.fn(),
}));

vi.mock("@/components/game/game-context", () => ({
  useGame: () => gameHarness.game,
}));
vi.mock("@/components/tasks/task-composer", () => ({
  TaskComposer: (props: {
    open: boolean;
    scheduledDate: string;
    path: string;
    category: string;
    task?: Task;
  }) => {
    gameHarness.composer(props);
    return props.open
      ? <div role="dialog" aria-label="Task composer">
          <span>{props.scheduledDate}</span>
          <span>{props.path}</span>
          <span>{props.category}</span>
          {props.task && <span>{props.task.title}</span>}
        </div>
      : null;
  },
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) =>
    <a href={href} {...props}>{children}</a>,
}));

import { CalendarPage } from "./calendar-page";

const scheduledTask: Task = {
  id: "scheduled-1",
  path: "academics",
  category: "planned",
  title: "Submit the research notes",
  description: "Review citations first.",
  xpValue: 50,
  isActive: true,
  createdAt: "2026-10-20T00:00:00.000Z",
  updatedAt: "2026-10-20T00:00:00.000Z",
  scheduledDate: "2026-10-30",
};

describe("CalendarPage", () => {
  it("renders month navigation, selected day, and scheduled objectives", async () => {
    gameHarness.game.tasks = [scheduledTask];
    render(<CalendarPage />);

    expect(screen.getByRole("heading", { name: "October 2026" })).toBeInTheDocument();
    expect(screen.getByText("Tuesday, October 20, 2026", { selector: ".calendar-header-meta strong" })).toBeInTheDocument();
    const scheduledDay = screen.getByRole("button", {
      name: "Friday, October 30, 2026, 1 scheduled tasks",
    });
    fireEvent.click(scheduledDay);
    expect(await screen.findByText("Submit the research notes")).toBeInTheDocument();
    expect(screen.getByText("Academics · Planned · 50 XP")).toBeInTheDocument();
    expect(screen.getByText("Review citations first.")).toBeInTheDocument();
  });

  it("adds a task to the clicked date and edits an existing scheduled task", async () => {
    gameHarness.game.tasks = [scheduledTask];
    render(<CalendarPage />);
    fireEvent.click(screen.getByRole("button", {
      name: "Friday, October 30, 2026, 1 scheduled tasks",
    }));

    fireEvent.click(screen.getByRole("button", { name: "Add task to selected date" }));
    expect(screen.getByRole("dialog", { name: "Task composer" })).toHaveTextContent("2026-10-30");
    expect(screen.getByRole("dialog", { name: "Task composer" })).toHaveTextContent("profession");

    fireEvent.click(screen.getByRole("button", { name: "Edit Submit the research notes" }));
    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Task composer" })).toHaveTextContent("academics");
      expect(screen.getByRole("dialog", { name: "Task composer" })).toHaveTextContent("planned");
      expect(screen.getByRole("dialog", { name: "Task composer" })).toHaveTextContent("Submit the research notes");
    });
  });

  it("navigates months while retaining a selected date within the visible month", () => {
    gameHarness.game.tasks = [];
    render(<CalendarPage />);
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByRole("heading", { name: "November 2026" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sunday, November 1, 2026" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.getByRole("heading", { name: "October 2026" })).toBeInTheDocument();
  });
});
