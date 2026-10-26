"use client";

import { useEffect, useState } from "react";
import { useGame } from "@/components/game/game-context";
import { getSupabaseClient } from "@/lib/supabase/client";

export function SettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { timezone, updateTimezone, syncAvailable } = useGame();
  const [value, setValue] = useState(timezone);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [accountError, setAccountError] = useState("");
  const [accountMessage, setAccountMessage] = useState("");
  const [accountBusy, setAccountBusy] = useState(false);

  useEffect(() => {
    setValue(timezone);
  }, [timezone]);

  useEffect(() => {
    if (!open || !syncAvailable) return;
    let active = true;
    const loadAccount = async () => {
      try {
        const client = getSupabaseClient();
        if (!client) return;
        const { data, error: sessionError } = await client.auth.getSession();
        if (sessionError) throw new Error(`Could not read account status: ${sessionError.message}`);
        if (active) setAccountEmail(data.session?.user.email ?? "");
      } catch (cause) {
        if (active) {
          setAccountError(cause instanceof Error ? cause.message : "Could not read account status.");
        }
      }
    };
    void loadAccount();
    return () => { active = false; };
  }, [open, syncAvailable]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSaved(false);
    try {
      await updateTimezone(value.trim());
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save timezone.");
    }
  };

  const submitAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAccountError("");
    setAccountMessage("");
    setAccountBusy(true);
    try {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error("Configure Supabase to enable account sync across browsers.");
      }
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw new Error(`Could not read the current player session: ${sessionError.message}`);

      if (sessionData.session?.user.is_anonymous) {
        const { data, error: updateError } = await client.auth.updateUser({
          email: email.trim(),
          password,
        });
        if (updateError) throw new Error(`Could not link this local profile: ${updateError.message}`);
        setAccountEmail(data.user.email ?? email.trim());
        setAccountMessage("Profile linked. Confirm the email if prompted, then sign in with this account on your other browsers.");
      } else {
        const { error: signUpError } = await client.auth.signUp({
          email: email.trim(),
          password,
        });
        if (signUpError) throw new Error(`Could not create the account: ${signUpError.message}`);
        setAccountMessage("Account created. Confirm your email, then sign in with this account on your other browsers.");
      }
      setPassword("");
    } catch (cause) {
      setAccountError(cause instanceof Error ? cause.message : "Account setup failed.");
    } finally {
      setAccountBusy(false);
    }
  };

  const signIn = async () => {
    setAccountError("");
    setAccountMessage("");
    setAccountBusy(true);
    try {
      const client = getSupabaseClient();
      if (!client) throw new Error("Configure Supabase to enable account sync across browsers.");
      const { data, error: signInError } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw new Error(`Could not sign in: ${signInError.message}`);
      setAccountEmail(data.user.email ?? email.trim());
      setAccountMessage("Signed in. Reloading your shared task and XP data…");
      window.location.reload();
    } catch (cause) {
      setAccountError(cause instanceof Error ? cause.message : "Sign-in failed.");
    } finally {
      setAccountBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="settings-panel modal-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <button className="modal-close" onClick={onClose} aria-label="Close settings">×</button>
        <span className="eyebrow">PLAYER CONFIGURATION</span>
        <h2 id="settings-title">System settings</h2>
        <p className="form-help">Calendar resets and period status use your saved IANA timezone.</p>
        <form onSubmit={(event) => void save(event)}>
          <label htmlFor="timezone">Timezone</label>
          <input
            id="timezone"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Europe/Istanbul"
            required
          />
          <p className="form-help">Detected on this device: {Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          {saved && <p className="form-success" role="status">Timezone saved.</p>}
          <button className="primary-button" type="submit">Save timezone</button>
        </form>
        <div className="settings-account">
          <span className="eyebrow">CROSS-BROWSER SYNC</span>
          <h3>{accountEmail ? "Account linked" : "Link your player profile"}</h3>
          <p className="form-help">
            {accountEmail
              ? `Signed-in profile: ${accountEmail}`
              : "Use the same email account on each browser to sync tasks and XP. Linking keeps this browser's profile."}
          </p>
          {!accountEmail && (
            <form onSubmit={(event) => void submitAccount(event)}>
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
              {accountError && <p className="form-error" role="alert">{accountError}</p>}
              {accountMessage && <p className="form-success" role="status">{accountMessage}</p>}
              <div className="account-actions">
                <button className="primary-button" type="submit" disabled={accountBusy || !syncAvailable}>
                  {accountBusy ? "WORKING…" : "LINK / CREATE ACCOUNT"}
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={accountBusy || !syncAvailable || !email || !password}
                  onClick={() => void signIn()}
                >
                  SIGN IN
                </button>
              </div>
              {!syncAvailable && (
                <p className="form-help">Supabase is not configured. Local-only mode is active.</p>
              )}
            </form>
          )}
          {accountEmail && accountMessage && <p className="form-success" role="status">{accountMessage}</p>}
          {accountEmail && accountError && <p className="form-error" role="alert">{accountError}</p>}
        </div>
      </section>
    </div>
  );
}
