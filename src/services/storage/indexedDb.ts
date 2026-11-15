import { AppState, PersistedTimerState, SyncOperation } from "../../types/refocus";

const DB_NAME = "refocus_db_v2";
const DB_VERSION = 1;
const STORE_USER_STATES = "userStates";
const STORE_ACTIVE_TIMERS = "activeTimers";
const STORE_SYNC_QUEUE = "syncQueue";
const LEGACY_USER_PREFIX = "refocus_user_data_v1_";

interface StoredStateEnvelope {
  userId: string;
  state: AppState;
  lastSyncedAt: string | null;
  updatedAt: string;
}

// Memory fallback for environments without IndexedDB (e.g. Node unit tests)
const memoryStates = new Map<string, StoredStateEnvelope>();
const memoryTimers = new Map<string, PersistedTimerState>();
const memoryQueue = new Map<string, SyncOperation>();

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_USER_STATES)) {
        db.createObjectStore(STORE_USER_STATES, { keyPath: "userId" });
      }
      if (!db.objectStoreNames.contains(STORE_ACTIVE_TIMERS)) {
        db.createObjectStore(STORE_ACTIVE_TIMERS, { keyPath: "userId" });
      }
      if (!db.objectStoreNames.contains(STORE_SYNC_QUEUE)) {
        const queueStore = db.createObjectStore(STORE_SYNC_QUEUE, { keyPath: "id" });
        queueStore.createIndex("byUser", "userId", { unique: false });
        queueStore.createIndex("byCreatedAt", "createdAt", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbSaveUserState(
  userId: string,
  state: AppState,
  lastSyncedAt: string | null = null
): Promise<void> {
  if (!userId) return;
  const envelope: StoredStateEnvelope = {
    userId,
    state,
    lastSyncedAt,
    updatedAt: new Date().toISOString(),
  };

  if (!hasIndexedDb()) {
    memoryStates.set(userId, envelope);
    return;
  }

  try {
    const db = await openDb();
    const tx = db.transaction(STORE_USER_STATES, "readwrite");
    const store = tx.objectStore(STORE_USER_STATES);
    const existing = await idbRequest<StoredStateEnvelope | undefined>(store.get(userId));
    await idbRequest(
      store.put({
        ...envelope,
        lastSyncedAt: lastSyncedAt ?? existing?.lastSyncedAt ?? null,
      })
    );
  } catch {
    memoryStates.set(userId, envelope);
  }
}

export async function idbLoadUserState(userId: string): Promise<{
  state: AppState;
  lastSyncedAt: string | null;
} | null> {
  if (!userId) return null;

  if (!hasIndexedDb()) {
    const mem = memoryStates.get(userId);
    return mem ? { state: mem.state, lastSyncedAt: mem.lastSyncedAt } : null;
  }

  try {
    const db = await openDb();
    const tx = db.transaction(STORE_USER_STATES, "readonly");
    const env = await idbRequest<StoredStateEnvelope | undefined>(
      tx.objectStore(STORE_USER_STATES).get(userId)
    );
    if (env?.state) {
      return { state: env.state, lastSyncedAt: env.lastSyncedAt };
    }

    // Safe migration from legacy localStorage cache if IndexedDB record does not exist yet
    if (typeof localStorage !== "undefined") {
      const legacyRaw = localStorage.getItem(`${LEGACY_USER_PREFIX}${userId}`);
      if (legacyRaw) {
        const parsed = JSON.parse(legacyRaw) as AppState;
        const migrated: AppState = { ...parsed, isAuthenticated: true };
        await idbSaveUserState(userId, migrated, null);
        return { state: migrated, lastSyncedAt: null };
      }
    }
    return null;
  } catch {
    const mem = memoryStates.get(userId);
    return mem ? { state: mem.state, lastSyncedAt: mem.lastSyncedAt } : null;
  }
}

export async function idbRemoveUserState(userId: string): Promise<void> {
  if (!userId) return;
  memoryStates.delete(userId);
  memoryTimers.delete(userId);

  if (typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem(`${LEGACY_USER_PREFIX}${userId}`);
    } catch {
      // ignore
    }
  }

  if (!hasIndexedDb()) return;
  try {
    const db = await openDb();
    const tx = db.transaction([STORE_USER_STATES, STORE_ACTIVE_TIMERS], "readwrite");
    tx.objectStore(STORE_USER_STATES).delete(userId);
    tx.objectStore(STORE_ACTIVE_TIMERS).delete(userId);
  } catch {
    // ignore
  }
}

export async function idbSaveActiveTimer(timer: PersistedTimerState): Promise<void> {
  if (!timer.userId) return;
  if (!hasIndexedDb()) {
    memoryTimers.set(timer.userId, timer);
    return;
  }
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_ACTIVE_TIMERS, "readwrite");
    await idbRequest(tx.objectStore(STORE_ACTIVE_TIMERS).put(timer));
  } catch {
    memoryTimers.set(timer.userId, timer);
  }
}

export async function idbLoadActiveTimer(userId: string): Promise<PersistedTimerState | null> {
  if (!userId) return null;
  if (!hasIndexedDb()) {
    return memoryTimers.get(userId) || null;
  }
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_ACTIVE_TIMERS, "readonly");
    const res = await idbRequest<PersistedTimerState | undefined>(
      tx.objectStore(STORE_ACTIVE_TIMERS).get(userId)
    );
    return res || null;
  } catch {
    return memoryTimers.get(userId) || null;
  }
}

// --- Sync Queue Store ---

export async function idbEnqueueOperation(op: SyncOperation): Promise<void> {
  if (!op.userId || !op.id) return;
  if (!hasIndexedDb()) {
    memoryQueue.set(op.id, op);
    return;
  }
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_SYNC_QUEUE, "readwrite");
    await idbRequest(tx.objectStore(STORE_SYNC_QUEUE).put(op));
  } catch {
    memoryQueue.set(op.id, op);
  }
}

export async function idbListUserOperations(userId: string): Promise<SyncOperation[]> {
  if (!userId) return [];
  if (!hasIndexedDb()) {
    return Array.from(memoryQueue.values())
      .filter((op) => op.userId === userId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_SYNC_QUEUE, "readonly");
    const index = tx.objectStore(STORE_SYNC_QUEUE).index("byUser");
    const ops = await idbRequest<SyncOperation[]>(index.getAll(userId));
    return (ops || []).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } catch {
    return Array.from(memoryQueue.values())
      .filter((op) => op.userId === userId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
}

export async function idbUpdateOperation(op: SyncOperation): Promise<void> {
  if (!hasIndexedDb()) {
    memoryQueue.set(op.id, op);
    return;
  }
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_SYNC_QUEUE, "readwrite");
    await idbRequest(tx.objectStore(STORE_SYNC_QUEUE).put(op));
  } catch {
    memoryQueue.set(op.id, op);
  }
}

export async function idbRemoveOperations(opIds: string[]): Promise<void> {
  if (!opIds.length) return;
  for (const id of opIds) memoryQueue.delete(id);

  if (!hasIndexedDb()) return;
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_SYNC_QUEUE, "readwrite");
    const store = tx.objectStore(STORE_SYNC_QUEUE);
    for (const id of opIds) {
      store.delete(id);
    }
  } catch {
    // ignore
  }
}

export async function idbClearUserQueue(userId: string): Promise<void> {
  const ops = await idbListUserOperations(userId);
  await idbRemoveOperations(ops.map((o) => o.id));
}
