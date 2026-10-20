"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { useGame } from "@/components/game/game-context";
import { PATHS, type PathKey } from "@/types/game";

const pathNames: Record<PathKey, string> = {
  profession: "Profession",
  academics: "Academics",
  survival: "Survival",
  mentality: "Mentality",
  family: "Family",
};

export function SystemTerminal() {
  const { monthlyBar, level } = useGame();
  const reducedMotion = useReducedMotion();
  const message = `Welcome back to the SLS, ${monthlyBar.status}. Your current level: ${level}. Which path are going to choose?`;
  const [shown, setShown] = useState("");

  useEffect(() => {
    setShown("");
    if (reducedMotion) {
      setShown(message);
      return;
    }
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setShown(message.slice(0, index));
      if (index >= message.length) window.clearInterval(timer);
    }, 21);
    return () => window.clearInterval(timer);
  }, [message, reducedMotion]);

  return (
    <section className="system-terminal" aria-label="System terminal">
      <div className="terminal-topline">
        <span><i className="terminal-dot" /> SYSTEM TERMINAL</span>
        <span>CONNECTION: {typeof navigator === "undefined" || navigator.onLine ? "STABLE" : "OFFLINE"}</span>
      </div>
      <div className="terminal-copy" aria-live="polite">
        <span className="terminal-prompt">›</span>
        <span>{shown}</span>
        {shown.length < message.length && <span className="terminal-caret" aria-hidden="true" />}
      </div>
      <div className="terminal-paths" aria-label="Choose a path">
        {PATHS.map((path, index) => (
          <Link key={path} href={`/paths/${path}`} className="terminal-path">
            <span>0{index + 1}</span>
            {pathNames[path]}
            <span className="terminal-path-chevron">›</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
