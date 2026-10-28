import { beforeEach, describe, expect, it, vi } from "vitest";

const authHarness = vi.hoisted(() => ({
  getSession: vi.fn(),
  updateUser: vi.fn(),
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  getClient: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseClient: authHarness.getClient,
}));

import { linkOrCreateAccount, loadAccountEmail, signInToAccount } from "./account";

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
  authHarness.signInWithPassword.mockResolvedValue({
    data: { user: { email: "player@example.com" } },
    error: null,
  });
  authHarness.getClient.mockReturnValue({
    auth: {
      getSession: authHarness.getSession,
      updateUser: authHarness.updateUser,
      signUp: authHarness.signUp,
      signInWithPassword: authHarness.signInWithPassword,
    },
  });
});

describe("Supabase account operations", () => {
  it("loads the current email and links anonymous identity in place", async () => {
    await expect(loadAccountEmail()).resolves.toBe("");
    await expect(linkOrCreateAccount(" player@example.com ", "secure-password"))
      .resolves.toMatchObject({
        email: "player@example.com",
        message: expect.stringContaining("Profile linked."),
      });

    expect(authHarness.updateUser).toHaveBeenCalledWith({
      email: "player@example.com",
      password: "secure-password",
    });
    expect(authHarness.signUp).not.toHaveBeenCalled();
  });

  it("creates a new account when the current identity is not anonymous", async () => {
    authHarness.getSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(linkOrCreateAccount("new@example.com", "secure-password"))
      .resolves.toMatchObject({
        email: "",
        message: expect.stringContaining("Account created."),
      });
    expect(authHarness.signUp).toHaveBeenCalledWith({
      email: "new@example.com",
      password: "secure-password",
    });
    expect(authHarness.updateUser).not.toHaveBeenCalled();
  });

  it("surfaces account creation, session loading, and sign-in errors", async () => {
    authHarness.getSession.mockResolvedValueOnce({
      data: { session: { user: { is_anonymous: true } } },
      error: { message: "Session unavailable" },
    });
    await expect(linkOrCreateAccount("player@example.com", "secure-password"))
      .rejects.toThrow("Could not read the current player session: Session unavailable");

    authHarness.getSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });
    authHarness.signUp.mockResolvedValueOnce({ error: { message: "Email already registered" } });
    await expect(linkOrCreateAccount("player@example.com", "secure-password"))
      .rejects.toThrow("Could not create the account: Email already registered");

    authHarness.signInWithPassword.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "Invalid login credentials" },
    });
    await expect(signInToAccount("player@example.com", "wrong-password"))
      .rejects.toThrow("Could not sign in: Invalid login credentials");
  });
});
