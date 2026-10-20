"use client";

import dynamic from "next/dynamic";
import { useGame, displayDate } from "@/components/game/game-context";
import type { PeriodBar } from "@/types/game";

const CharacterScene = dynamic(
  () => import("@/components/character/character-scene"),
  { ssr: false, loading: () => <div className="character-placeholder"><span>SUMMONING</span></div> },
);

function ProgressBar({
  label,
  icon,
  bar,
  scale,
}: {
  label: string;
  icon: string;
  bar: PeriodBar;
  scale: number;
}) {
  const limit = bar.upperBound;
  const value = Math.min(bar.xp, limit);
  const limitText = limit.toLocaleString();
  return (
    <div className={`hud-bar hud-bar-${label.toLowerCase()}`}>
      <div className="hud-bar-heading">
        <div className="hud-bar-label">
          <span className="hud-bar-icon" aria-hidden="true">{icon}</span>
          <span>{label}</span>
        </div>
        <span className="hud-bar-status">{bar.status}</span>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label={`${label} rank progress`}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.min(bar.xp, limit)}
        aria-valuetext={`${bar.xp.toLocaleString()} of ${limitText} XP, ${bar.status}`}
      >
        <div className="progress-fill" style={{ width: `${bar.progress}%` }} />
        <div className="progress-glint" />
      </div>
      <div className="hud-bar-foot">
        <span>{value.toLocaleString()} / {limitText} XP</span>
        {bar.overflow > 0 && <span className="overflow-xp">+{bar.overflow.toLocaleString()} overflow</span>}
        {bar.overflow === 0 && <span>{Math.round(bar.progress)}%</span>}
      </div>
      <span className="sr-only">Threshold scale x{scale}</span>
    </div>
  );
}

export function SystemHud({ onSettings }: { onSettings: () => void }) {
  const game = useGame();
  return (
    <header className="system-hud">
      <div className="hud-bars">
        <ProgressBar label="Daily" icon="◉" bar={game.dailyBar} scale={1} />
        <ProgressBar label="Weekly" icon="◈" bar={game.weeklyBar} scale={7} />
        <ProgressBar
          label="Monthly"
          icon="✧"
          bar={game.monthlyBar}
          scale={new Date(Date.UTC(Number(game.today.slice(0, 4)), Number(game.today.slice(5, 7)), 0)).getUTCDate()}
        />
      </div>

      <div className="player-panel">
        <div className="character-frame" aria-label="Idle 3D character portrait">
          <CharacterScene />
          <span className="character-corner character-corner-tl" />
          <span className="character-corner character-corner-br" />
        </div>
        <div className="player-readout" aria-label="Player details">
          <p className="player-date"><strong>{displayDate(game.now, game.timezone)}</strong></p>
          <p><span>STATUS</span><strong className="master-status">{game.monthlyBar.status}</strong></p>
          <p><span>LEVEL</span><strong>{game.level.toLocaleString()}{game.level >= 10_000 ? " · MAX" : ""}</strong></p>
        </div>
        <button className="settings-button" onClick={onSettings} aria-label="System settings">
          <span aria-hidden="true">⚙</span>
        </button>
      </div>
    </header>
  );
}
