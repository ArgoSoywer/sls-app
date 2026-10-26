import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authHarness = vi.hoisted(() => ({
  getSession: vi.fn(),
  updateUser: vi.fn(),
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  getClient: vi.fn(),
  updateTimezone: vi.fn(),
}));

vi.mock("@/components/game/game-context", () => ({
  useGame: () => ({
    timezone: "UTC",
    updateTimezone: authHarness.updateTimezone,
    syncAvailable: true,
  }),
}));
vi.mock("@/lib/supabase/client", () => ({
  getSupabaseClient: authHarness.getClient,
}));

import { SettingsPanel } from "./settings-panel";

beforeEach(() => {
  authHarness.getSession.mockResolvedValue({
    data: { session: { user: { is_anonymous: true, email: undefined } } },
    error: null,
  });
  authHarness.updateUser.mockResolvedValue({
    data: { user: { email: "player@example.com" } },
    error: null,
  });
  authHarness.signUp.mockResolvedValue({ error: null });
  authHarness.getClient.mockReturnValue({
    auth: {
      getSession: authHarness.getSession,
      updateUser: authHarness.updateUser,
      signUp: authHarness.signUp,
      signInWithPassword: authHarness.signInWithPassword,
    },
  });
});

describe("SettingsPanel account sync", () => {
  it("links the current anonymous profile to email/password without replacing its identity", async () => {
    render(<SettingsPanel open onClose={() => undefined} />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "player@example.com" } });
    fireEvent.change(screen.getByLabelText(/Password/), { target: { value: "secure-password" } });
    fireEvent.click(screen.getByRole("button", { name: "LINK / CREATE ACCOUNT" }));

    await waitFor(() => expect(authHarness.updateUser).toHaveBeenCalledWith({
      email: "player@example.com",
      password: "secure-password",
    }));
    expect(authHarness.signUp).not.toHaveBeenCalled();
    expect(await screen.findByRole("status"))
      .toHaveTextContent("Profile linked. Confirm the email if prompted");
  });

  it("creates an account if no current session exists", async () => {
    authHarness.getSession.mockResolvedValue({ data: { session: null }, error: null });
    render(<SettingsPanel open onClose={() => undefined} />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByLabelText(/Password/), { target: { value: "secure-password" } });
    fireEvent.click(screen.getByRole("button", { name: "LINK / CREATE ACCOUNT" }));

    await waitFor(() => expect(authHarness.signUp).toHaveBeenCalledWith({
      email: "new@example.com",
      password: "secure-password",
    }));
    expect(authHarness.updateUser).not.toHaveBeenCalled();
    expect(await screen.findByRole("status")).toHaveTextContent("Account created.");
  });

  it("displays Supabase account setup errors instead of silently failing", async () => {
    authHarness.updateUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Email already registered" },
    });
    render(<SettingsPanel open onClose={() => undefined} />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "used@example.com" } });
    fireEvent.change(screen.getByLabelText(/Password/), { target: { value: "secure-password" } });
    fireEvent.click(screen.getByRole("button", { name: "LINK / CREATE ACCOUNT" }));
    expect(await screen.findByRole("alert"))
      .toHaveTextContent("Could not link this local profile: Email already registered");
  });
});
