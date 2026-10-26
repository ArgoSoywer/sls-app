import type { Completion, RemoteCompletionRow, SyncOperation, Task } from "@/types/game";
import { xpForCategory } from "@/features/game-engine";

const DATABASE_NAME = "sls-offline";
const DATABASE_VERSION = 2;
const TASK_STORE = "tasks";
const COMPLETION_STORE = "completions";
const METADATA_STORE = "metadata";
const OUTBOX_STORE = "outbox";

export interface LocalSnapshot {
  tasks: Task[];
  completions: Completion[];
  timezone: string;
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is unavailable in this browser."));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(TASK_STORE)) {
        database.createObjectStore(TASK_STORE, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(COMPLETION_STORE)) {
        const store = database.createObjectStore(COMPLETION_STORE, { keyPath: "id" });
        store.createIndex("taskId", "taskId");
        store.createIndex("localDate", "localDate");
      }
      if (!database.objectStoreNames.contains(METADATA_STORE)) {
        database.createObjectStore(METADATA_STORE, { keyPath: "key" });
      }
      if (!database.objectStoreNames.contains(OUTBOX_STORE)) {
        const store = database.createObjectStore(OUTBOX_STORE, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open local database."));
    request.onblocked = () => reject(new Error("The local database upgrade is blocked by another tab."));
  });
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Local database request failed."));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Local database transaction failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Local database transaction was aborted."));
  });
}

function makeId(): string {
  if (typeof crypto.randomUUID !== "function") {
    throw new Error("This browser does not support secure UUID generation.");
  }
  return crypto.randomUUID();
}

function sampleTasks(now: string): Task[] {
  const entries: Array<[Task["path"], Task["category"], string, string]> = [
    ["profession", "everyday", "Review today's priorities", "Choose one meaningful task to move forward."],
    ["profession", "challenge", "Ship a focused deliverable", "Complete and share one concrete piece of work."],
    ["academics", "everyday", "Read for twenty minutes", "A small daily session in the archive."],
    ["academics", "planned", "Complete a study module", "Set aside a focused block for a planned topic."],
    ["survival", "everyday", "Move your body", "A walk, workout, or deliberate stretch."],
    ["mentality", "everyday", "Write a short reflection", "Clear the mind and notice one thing learned."],
    ["family", "everyday", "Reach out to someone", "Make a little room for the people who matter."],
  ];
  return entries.map(([path, category, title, description]) => ({
    id: makeId(),
    path,
    category,
    title,
    description,
    xpValue: xpForCategory(category),
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }));
}

async function getAll<T>(database: IDBDatabase, storeName: string): Promise<T[]> {
  const transaction = database.transaction(storeName, "readonly");
  const result = await requestValue(transaction.objectStore(storeName).getAll()) as T[];
  await transactionDone(transaction);
  return result;
}

export async function loadLocalSnapshot(): Promise<LocalSnapshot> {
  const database = await openDatabase();
  const timezoneTransaction = database.transaction(METADATA_STORE, "readwrite");
  const metadata = timezoneTransaction.objectStore(METADATA_STORE);
  let timezone = await requestValue<{ key: string; value: string } | undefined>(metadata.get("timezone"))
    .then((value) => value?.value);
  if (!timezone) {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    metadata.put({ key: "timezone", value: timezone });
  }
  await transactionDone(timezoneTransaction);

  let tasks = await getAll<Task>(database, TASK_STORE);
  if (tasks.length === 0) {
    tasks = sampleTasks(new Date().toISOString());
    const transaction = database.transaction(TASK_STORE, "readwrite");
    for (const task of tasks) transaction.objectStore(TASK_STORE).put(task);
    await transactionDone(transaction);
  }
  const completions = await getAll<Completion>(database, COMPLETION_STORE);
  database.close();
  return { tasks, completions, timezone };
}

export async function replaceLocalTasks(tasks: Task[]): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(TASK_STORE, "readwrite");
  const store = transaction.objectStore(TASK_STORE);
  store.clear();
  for (const task of tasks) store.put(task);
  await transactionDone(transaction);
  database.close();
}

export async function mergeRemoteCompletions(rows: RemoteCompletionRow[]): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(COMPLETION_STORE, "readwrite");
  const store = transaction.objectStore(COMPLETION_STORE);
  const current = await requestValue(store.getAll()) as Completion[];
  const localByKey = new Map(current.map((completion) => [completion.idempotencyKey, completion]));
  for (const row of rows) {
    const local = localByKey.get(row.idempotency_key);
    if (local?.syncState === "pending" || local?.syncState === "failed") continue;
    store.put({
      id: row.idempotency_key,
      taskId: row.task_id,
      category: row.task_category,
      xp: row.xp_delta,
      localDate: row.local_date,
      idempotencyKey: row.idempotency_key,
      createdAt: row.created_at,
      syncState: "synced",
    } satisfies Completion);
  }
  await transactionDone(transaction);
  database.close();
}

export async function saveLocalTask(
  task: Task,
  queueRemote: boolean,
  syncImmediately?: () => Promise<string[]>,
): Promise<string[]> {
  const database = await openDatabase();
  const stores = queueRemote ? [TASK_STORE, OUTBOX_STORE] : [TASK_STORE];
  const transaction = database.transaction(stores, "readwrite");
  transaction.objectStore(TASK_STORE).put(task);
  if (queueRemote) {
    const operation: SyncOperation = {
      id: makeId(),
      kind: "task-upsert",
      createdAt: new Date().toISOString(),
      state: "pending",
      task,
    };
    transaction.objectStore(OUTBOX_STORE).put(operation);
  }
  await transactionDone(transaction);
  database.close();
  if (queueRemote && syncImmediately) return syncImmediately();
  return [];
}

export async function saveTimezone(timezone: string, queueRemote = false): Promise<void> {
  const database = await openDatabase();
  const stores = queueRemote ? [METADATA_STORE, OUTBOX_STORE] : [METADATA_STORE];
  const transaction = database.transaction(stores, "readwrite");
  transaction.objectStore(METADATA_STORE).put({ key: "timezone", value: timezone });
  if (queueRemote) {
    const operation: SyncOperation = {
      id: makeId(),
      kind: "timezone-update",
      createdAt: new Date().toISOString(),
      state: "pending",
      timezone,
    };
    transaction.objectStore(OUTBOX_STORE).put(operation);
  }
  await transactionDone(transaction);
  database.close();
}

export async function recordLocalCompletion(
  task: Task,
  localDate: string,
  remoteEnabled: boolean,
): Promise<Completion> {
  const database = await openDatabase();
  const stores = remoteEnabled
    ? [COMPLETION_STORE, OUTBOX_STORE]
    : [COMPLETION_STORE];
  const transaction = database.transaction(stores, "readwrite");
  const completionStore = transaction.objectStore(COMPLETION_STORE);
  const existing = await requestValue(completionStore.getAll()) as Completion[];
  const alreadyDone = existing.some((completion) =>
    completion.taskId === task.id
      && (task.category !== "everyday" || completion.localDate === localDate),
  );
  if (alreadyDone) {
    transaction.abort();
    database.close();
    throw new Error(task.category === "everyday"
      ? "This Everyday task has already been completed today."
      : "This task has already been completed.");
  }

  const idempotencyKey = makeId();
  const completion: Completion = {
    id: idempotencyKey,
    taskId: task.id,
    category: task.category,
    xp: xpForCategory(task.category),
    localDate,
    idempotencyKey,
    createdAt: new Date().toISOString(),
    syncState: remoteEnabled ? "pending" : "local",
  };
  completionStore.add(completion);
  if (remoteEnabled) {
    const operation: SyncOperation = {
      id: idempotencyKey,
      kind: "completion",
      createdAt: completion.createdAt,
      state: "pending",
      completion,
    };
    transaction.objectStore(OUTBOX_STORE).put(operation);
  }
  await transactionDone(transaction);
  database.close();
  return completion;
}

export async function getOutbox(): Promise<SyncOperation[]> {
  const database = await openDatabase();
  const operations = await getAll<SyncOperation>(database, OUTBOX_STORE);
  database.close();
  return operations.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function markOperationFailed(operation: SyncOperation, message: string): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction([OUTBOX_STORE, COMPLETION_STORE], "readwrite");
  transaction.objectStore(OUTBOX_STORE).put({ ...operation, state: "failed", error: message });
  if (operation.completion) {
    const completion = await requestValue<Completion | undefined>(
      transaction.objectStore(COMPLETION_STORE).get(operation.completion.id),
    );
    if (completion) {
      transaction.objectStore(COMPLETION_STORE).put({
        ...completion,
        syncState: "failed",
        syncError: message,
      });
    }
  }
  await transactionDone(transaction);
  database.close();
}

export async function markOperationPending(operation: SyncOperation): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction([OUTBOX_STORE, COMPLETION_STORE], "readwrite");
  transaction.objectStore(OUTBOX_STORE).put({ ...operation, state: "pending", error: undefined });
  if (operation.completion) {
    const completion = await requestValue<Completion | undefined>(
      transaction.objectStore(COMPLETION_STORE).get(operation.completion.id),
    );
    if (completion) {
      transaction.objectStore(COMPLETION_STORE).put({
        ...completion,
        syncState: "pending",
        syncError: undefined,
      });
    }
  }
  await transactionDone(transaction);
  database.close();
}

export async function acknowledgeOperation(operation: SyncOperation): Promise<void> {
  const database = await openDatabase();
  const stores = operation.completion
    ? [OUTBOX_STORE, COMPLETION_STORE]
    : [OUTBOX_STORE];
  const transaction = database.transaction(stores, "readwrite");
  transaction.objectStore(OUTBOX_STORE).delete(operation.id);
  if (operation.completion) {
    const completion = await requestValue<Completion | undefined>(
      transaction.objectStore(COMPLETION_STORE).get(operation.completion.id),
    );
    if (completion) {
      transaction.objectStore(COMPLETION_STORE).put({ ...completion, syncState: "synced" });
    }
  }
  await transactionDone(transaction);
  database.close();
}
