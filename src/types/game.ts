export const PATHS = [
  "profession",
  "academics",
  "survival",
  "mentality",
  "family",
] as const;

export type PathKey = (typeof PATHS)[number];
export type TaskCategory = "everyday" | "challenge" | "planned";
export type StatusName =
  | "Loser"
  | "Average Guy"
  | "Hard-Working Guy"
  | "Baddest Guy"
  | "Monster";

export interface Task {
  id: string;
  userId?: string;
  path: PathKey;
  category: TaskCategory;
  title: string;
  description: string;
  xpValue: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Completion {
  id: string;
  taskId: string;
  category: TaskCategory;
  xp: number;
  localDate: string;
  idempotencyKey: string;
  createdAt: string;
  syncState: "local" | "pending" | "synced" | "failed";
  syncError?: string;
}

export interface RemoteCompletionRow {
  id: string;
  task_id: string;
  task_category: TaskCategory;
  xp_delta: number;
  local_date: string;
  idempotency_key: string;
  created_at: string;
}

export type SyncOperationKind = "task-upsert" | "completion" | "timezone-update";

export interface SyncOperation {
  id: string;
  kind: SyncOperationKind;
  createdAt: string;
  state: "pending" | "failed";
  error?: string;
  task?: Task;
  completion?: Completion;
  timezone?: string;
}

export interface PeriodBar {
  status: StatusName;
  xp: number;
  lowerBound: number;
  upperBound: number;
  progress: number;
  overflow: number;
}
