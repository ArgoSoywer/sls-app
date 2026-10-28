"use client";

import { useEffect, useState } from "react";
import { linkOrCreateAccount, loadAccountEmail, signInToAccount } from "@/lib/supabase/account";

export function AccountSyncPanel({ syncAvailable }: { syncAvailable: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!syncAvailable) return;
    let active = true;
    void loadAccountEmail()
      .then((loadedEmail) => {
        if (active) setAccountEmail(loadedEmail);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not read account status.");
      });
    return () => { active = false; };
  }, [syncAvailable]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const result = await linkOrCreateAccount(email, password);
      setAccountEmail(result.email);
      setMessage(result.message);
      setPassword("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Account setup failed.");
    } finally {
      setBusy(false);
    }
  };

  const signIn = async () => {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      setAccountEmail(await signInToAccount(email, password));
      setMessage("Signed in. Reloading your shared task and XP data…");
      window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="settings-account">
      <span className="eyebrow">CROSS-BROWSER SYNC</span>
      <h3>{accountEmail ? "Account linked" : "Link your player profile"}</h3>
      <p className="form-help">
        {accountEmail
          ? `Signed-in profile: ${accountEmail}`
          : "Use the same email account on each browser to sync tasks and XP. Linking keeps this browser's profile."}
      </p>
      {!accountEmail && (
        <form onSubmit={(event) => void submit(event)}>
          <label htmlFor="account-email">Email</label>
          <input
            id="account-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <label htmlFor="account-password">Password <span>MINIMUM 8 CHARACTERS</span></label>
          <input
            id="account-password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {error && <p className="form-error" role="alert">{error}</p>}
          {message && <p className="form-success" role="status">{message}</p>}
          <div className="account-actions">
            <button className="primary-button" type="submit" disabled={busy || !syncAvailable}>
              {busy ? "WORKING…" : "LINK / CREATE ACCOUNT"}
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={busy || !syncAvailable || !email || !password}
              onClick={() => void signIn()}
            >
              SIGN IN
            </button>
          </div>
          {!syncAvailable && <p className="form-help">Supabase is not configured. Local-only mode is active.</p>}
        </form>
      )}
      {accountEmail && message && <p className="form-success" role="status">{message}</p>}
      {accountEmail && error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}
