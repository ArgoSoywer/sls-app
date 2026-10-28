import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const accountHarness = vi.hoisted(() => ({
  loadAccountEmail: vi.fn(),
  linkOrCreateAccount: vi.fn(),
  signInToAccount: vi.fn(),
  updateTimezone: vi.fn(),
}));

vi.mock("@/components/game/game-context", () => ({
  useGame: () => ({
    timezone: "UTC",
    updateTimezone: accountHarness.updateTimezone,
    syncAvailable: true,
  }),
}));
vi.mock("@/lib/supabase/account", () => ({
  loadAccountEmail: accountHarness.loadAccountEmail,
  linkOrCreateAccount: accountHarness.linkOrCreateAccount,
  signInToAccount: accountHarness.signInToAccount,
}));

import { SettingsPanel } from "./settings-panel";

beforeEach(() => {
  accountHarness.loadAccountEmail.mockResolvedValue("");
  accountHarness.linkOrCreateAccount.mockResolvedValue({
    email: "player@example.com",
    message: "Profile linked. Confirm the email if prompted, then sign in with this account on your other browsers.",
  });
});

describe("SettingsPanel account sync", () => {
  it("submits account-link details and confirms that the profile remains linked", async () => {
    render(<SettingsPanel open onClose={() => undefined} />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "player@example.com" } });
    fireEvent.change(screen.getByLabelText(/Password/), { target: { value: "secure-password" } });
    fireEvent.click(screen.getByRole("button", { name: "LINK / CREATE ACCOUNT" }));

    await waitFor(() => expect(accountHarness.linkOrCreateAccount).toHaveBeenCalledWith(
      "player@example.com",
      "secure-password",
    ));
    expect(await screen.findByRole("status"))
      .toHaveTextContent("Profile linked. Confirm the email if prompted");
  });

  it("shows account-created confirmation when the service returns it", async () => {
    accountHarness.linkOrCreateAccount.mockResolvedValue({
      email: "",
      message: "Account created. Confirm your email, then sign in with this account on your other browsers.",
    });
    render(<SettingsPanel open onClose={() => undefined} />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByLabelText(/Password/), { target: { value: "secure-password" } });
    fireEvent.click(screen.getByRole("button", { name: "LINK / CREATE ACCOUNT" }));

    await waitFor(() => expect(accountHarness.linkOrCreateAccount).toHaveBeenCalledWith(
      "new@example.com",
      "secure-password",
    ));
    expect(await screen.findByRole("status")).toHaveTextContent("Account created.");
  });

  it("displays Supabase account setup errors instead of silently failing", async () => {
    accountHarness.linkOrCreateAccount.mockRejectedValue(
      new Error("Could not link this local profile: Email already registered"),
    );
    render(<SettingsPanel open onClose={() => undefined} />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "used@example.com" } });
    fireEvent.change(screen.getByLabelText(/Password/), { target: { value: "secure-password" } });
    fireEvent.click(screen.getByRole("button", { name: "LINK / CREATE ACCOUNT" }));
    expect(await screen.findByRole("alert"))
      .toHaveTextContent("Could not link this local profile: Email already registered");
  });
});
