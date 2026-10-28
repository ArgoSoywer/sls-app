import { PATHS, type PathKey, type TaskCategory } from "@/types/game";

export const PATH_INFO: Record<PathKey, {
  title: string;
  epithet: string;
  description: string;
  rune: string;
}> = {
  profession: {
    title: "Profession",
    epithet: "THE FORGE OF MASTERY",
    description: "Build your craft through deliberate work. Every focused action becomes part of your edge.",
    rune: "ᚠ",
  },
  academics: {
    title: "Academics",
    epithet: "THE ARCANE ARCHIVE",
    description: "Enter the quiet stacks. Gather knowledge, question what you find, and make it yours.",
    rune: "ᚨ",
  },
  survival: {
    title: "Survival",
    epithet: "THE UNTAMED FRONTIER",
    description: "Return to the elements. Strength, health, and resilience are earned one expedition at a time.",
    rune: "ᛉ",
  },
  mentality: {
    title: "Mentality",
    epithet: "THE INNER SANCTUM",
    description: "Train the unseen. Attention, patience, and self-command are powers of their own.",
    rune: "ᛞ",
  },
  family: {
    title: "Family",
    epithet: "THE ANCHORING FLAME",
    description: "Protect what matters. Presence and care are quests worthy of your strongest effort.",
    rune: "ᛟ",
  },
};

export const CATEGORY_INFO: Record<TaskCategory, {
  label: string;
  singularLabel: string;
  subtitle: string;
}> = {
  everyday: { label: "Everyday", singularLabel: "Everyday", subtitle: "RENEWED EACH DAY" },
  challenge: { label: "Challenges", singularLabel: "Challenge", subtitle: "ONE-TIME TRIALS" },
  planned: { label: "Planned", singularLabel: "Planned", subtitle: "YOUR NEXT MILESTONE" },
};

export const TASK_CATEGORY_ORDER: readonly TaskCategory[] = [
  "everyday",
  "challenge",
  "planned",
];

export function isPathKey(value: string): value is PathKey {
  return PATHS.some((path) => path === value);
}
