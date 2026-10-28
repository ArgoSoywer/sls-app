"use client";

import { useGame } from "@/components/game/game-context";

export function SyncNotice() {
  const game = useGame();
  if (!game.error) return null;

  return (
    <div className="sync-notice" role="status">
      <span>{game.error}</span>
      {game.syncAvailable && game.isOnline && (
        <button onClick={() => void game.retrySync()} disabled={game.isSyncing}>
          {game.isSyncing ? "SYNCING…" : "RETRY"}
        </button>
      )}
      <button className="notice-close" aria-label="Dismiss notification" onClick={game.clearError}>×</button>
    </div>
  );
}
