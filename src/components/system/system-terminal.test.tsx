import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const gameHarness = vi.hoisted(() => ({
  game: {
    monthlyBar: { status: "Hard-Working Guy" },
    level: 27,
  },
}));

vi.mock("@/components/game/game-context", () => ({
  useGame: () => gameHarness.game,
}));
vi.mock("framer-motion", () => ({
  useReducedMotion: () => true,
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) =>
    <a href={href} {...props}>{children}</a>,
}));

import { SystemTerminal } from "./system-terminal";

describe("SystemTerminal", () => {
  it("speaks the exact configured monthly-status welcome line and presents the five paths", () => {
    render(<SystemTerminal />);
    const message = "Welcome back to the SLS, Hard-Working Guy. Your current level: 27.\nWhich path are going to choose?";
    const typedLine = screen.getByText((_content, element) =>
      element?.tagName === "SPAN" && element.textContent === message,
    );
    expect(typedLine.textContent).toBe(message);
    expect(screen.getByRole("link", { name: /Profession/ })).toHaveAttribute("href", "/paths/profession");
    expect(screen.getByRole("link", { name: /Academics/ })).toHaveAttribute("href", "/paths/academics");
    expect(screen.getByRole("link", { name: /Survival/ })).toHaveAttribute("href", "/paths/survival");
    expect(screen.getByRole("link", { name: /Mentality/ })).toHaveAttribute("href", "/paths/mentality");
    expect(screen.getByRole("link", { name: /Family/ })).toHaveAttribute("href", "/paths/family");
  });
});
