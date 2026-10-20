"use client";

import { useEffect, useState } from "react";
import { useGame } from "@/components/game/game-context";

export function SettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { timezone, updateTimezone } = useGame();
  const [value, setValue] = useState(timezone);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setValue(timezone);
  }, [timezone]);

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
      </section>
    </div>
  );
}
