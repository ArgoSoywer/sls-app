"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useState } from "react";
import { SystemHud } from "@/components/system/system-hud";
import { SystemTerminal } from "@/components/system/system-terminal";
import { SettingsPanel } from "@/components/system/settings-panel";
import { useGame } from "@/components/game/game-context";
import { PATHS, type PathKey } from "@/types/game";

const pathNames: Record<PathKey, string> = {
  profession: "Profession",
  academics: "Academics",
  survival: "Survival",
  mentality: "Mentality",
  family: "Family",
};

export default function DashboardPage() {
  const game = useGame();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <main className="system-screen">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <SystemHud onSettings={() => setSettingsOpen(true)} />

      <section className="dashboard-stage" aria-label="System overview">
        <div className="stage-mark" aria-hidden="true">
          <span>PLAYER STATUS</span>
          <span className="stage-line" />
          <span>{game.level >= 10_000 ? "SYSTEM COMPLETE" : "AWAITING INPUT"}</span>
        </div>
        <div className="stage-rune rune-left" aria-hidden="true">ᚷ</div>
        <div className="stage-rune rune-right" aria-hidden="true">ᛟ</div>
        {game.level >= 10_000 && (
          <motion.div
            className="completion-banner"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <span className="eyebrow">THE SYSTEM HAS RECOGNIZED YOUR ASCENSION</span>
            <h1>GAME COMPLETED</h1>
            <p>You reached the final level. Your journey remains yours to continue.</p>
          </motion.div>
        )}
      </section>

      <SystemTerminal />

      <nav className="path-navigation" aria-label="Your paths">
        {PATHS.map((path, index) => (
          <Link href={`/paths/${path}`} className="path-link" key={path}>
            <span className="path-index">0{index + 1}</span>
            <span>{pathNames[path]}</span>
            <span className="path-arrow" aria-hidden="true">↗</span>
          </Link>
        ))}
      </nav>

      <div className="dashboard-footnote">
        <span>ONE PLAYER · FIVE PATHS · YOUR SYSTEM</span>
        <span>{game.isReady ? "LOCAL PROFILE READY" : "INITIALIZING SYSTEM"}</span>
      </div>

      {game.error && (
        <div className="sync-notice" role="status">
          <span>{game.error}</span>
          {game.syncAvailable && game.isOnline && (
            <button onClick={() => void game.retrySync()} disabled={game.isSyncing}>
              {game.isSyncing ? "SYNCING…" : "RETRY"}
            </button>
          )}
          <button className="notice-close" aria-label="Dismiss notification" onClick={game.clearError}>×</button>
        </div>
      )}
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </main>
  );
}
