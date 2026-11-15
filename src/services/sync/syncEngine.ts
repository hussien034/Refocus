import {
  AppState,
  SyncConflict,
  SyncEntityType,
  SyncOperation,
  SyncOperationType,
  SyncStatusSnapshot,
} from "../../types/refocus";
import {
  idbEnqueueOperation,
  idbListUserOperations,
  idbRemoveOperations,
  idbSaveUserState,
  idbUpdateOperation,
} from "../storage/indexedDb";

type SyncListener = (snapshot: SyncStatusSnapshot) => void;

export interface SyncTransport {
  syncOperations(
    token: string,
    operations: SyncOperation[]
  ): Promise<{
    state: AppState;
    serverVersion: number;
    syncedAt: string;
    appliedOpIds: string[];
    conflicts: SyncConflict[];
  }>;
}

const defaultTransport: SyncTransport = {
  async syncOperations(token: string, operations: SyncOperation[]) {
    const res = await fetch("/api/user/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ operations }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const error = new Error(errData.error || `Sync failed (${res.status})`) as Error & {
        status?: number;
      };
      error.status = res.status;
      throw error;
    }
    return res.json();
  },
};

function isNavigatorOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return typeof navigator.onLine === "boolean" ? navigator.onLine : true;
}

export class OfflineSyncManager {
  private activeUserId: string | null = null;
  private activeToken: string | null = null;
  private syncingInFlight = false;
  private listeners = new Set<SyncListener>();
  private transport: SyncTransport;
  private snapshot: SyncStatusSnapshot;
  private onServerStateApplied?: (userId: string, state: AppState) => void;

  constructor(transport: SyncTransport = defaultTransport) {
    this.transport = transport;
    const isOnline = isNavigatorOnline();
    this.snapshot = {
      state: isOnline ? "online" : "offline",
      isOnline,
      pendingCount: 0,
      failedCount: 0,
      lastSyncedAt: null,
      lastError: null,
      conflicts: [],
    };
  }

  public setOnServerStateApplied(cb: (userId: string, state: AppState) => void) {
    this.onServerStateApplied = cb;
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getSnapshot(): SyncStatusSnapshot {
    return this.snapshot;
  }

  private emit(partial: Partial<SyncStatusSnapshot>) {
    this.snapshot = { ...this.snapshot, ...partial };
    for (const l of this.listeners) {
      l(this.snapshot);
    }
  }

  public async setSession(
    userId: string | null,
    token: string | null,
    lastSyncedAt: string | null = null
  ): Promise<void> {
    this.activeUserId = userId;
    this.activeToken = token;
    this.syncingInFlight = false;

    const isOnline = isNavigatorOnline();
    if (!userId || !token) {
      this.emit({
        state: isOnline ? "online" : "offline",
        isOnline,
        pendingCount: 0,
        failedCount: 0,
        lastSyncedAt: null,
        lastError: null,
        conflicts: [],
      });
      return;
    }

    const ops = await idbListUserOperations(userId);
    const failedCount = ops.filter((o) => o.status === "failed").length;
    this.emit({
      state: !isOnline ? "offline" : lastSyncedAt && ops.length === 0 ? "synced" : "online",
      isOnline,
      pendingCount: ops.length,
      failedCount,
      lastSyncedAt,
      lastError: null,
      conflicts: [],
    });
  }

  public async handleConnectivityChange(isOnline: boolean): Promise<void> {
    this.emit({
      isOnline,
      state: !isOnline
        ? "offline"
        : this.snapshot.pendingCount === 0 && this.snapshot.lastSyncedAt
          ? "synced"
          : "online",
    });

    if (isOnline && this.activeUserId && this.activeToken) {
      await this.flushQueue();
    }
  }

  public async enqueueOperation(params: {
    userId: string;
    entityType: SyncEntityType;
    operationType: SyncOperationType;
    entityId: string;
    payload: unknown;
    baseVersion?: number;
    latestState?: AppState;
  }): Promise<SyncOperation> {
    if (!this.activeUserId || params.userId !== this.activeUserId) {
      throw new Error("Cross-user operation enqueue rejected.");
    }

    const op: SyncOperation = {
      id: `op_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId: params.userId,
      entityType: params.entityType,
      operationType: params.operationType,
      entityId: params.entityId,
      payload: params.payload,
      createdAt: new Date().toISOString(),
      baseVersion: params.baseVersion,
      retryCount: 0,
      status: "pending",
    };

    if (params.latestState) {
      await idbSaveUserState(params.userId, params.latestState, this.snapshot.lastSyncedAt);
    }
    await idbEnqueueOperation(op);

    const ops = await idbListUserOperations(params.userId);
    const isOnline = isNavigatorOnline();
    this.emit({
      isOnline,
      pendingCount: ops.length,
      state: isOnline ? "online" : "offline",
    });

    if (isOnline && this.activeToken) {
      void this.flushQueue();
    }

    return op;
  }

  public async flushQueue(): Promise<{ ok: boolean; syncedCount: number }> {
    const userId = this.activeUserId;
    const token = this.activeToken;
    if (!userId || !token) {
      return { ok: false, syncedCount: 0 };
    }
    const isOnline = isNavigatorOnline();
    if (!isOnline) {
      this.emit({ state: "offline", isOnline: false });
      return { ok: false, syncedCount: 0 };
    }
    if (this.syncingInFlight) {
      return { ok: false, syncedCount: 0 };
    }

    const allOps = await idbListUserOperations(userId);
    // Strict security check: only process operations belonging strictly to the currently authenticated user
    const userOps = allOps.filter((op) => op.userId === userId);
    if (userOps.length === 0) {
      this.emit({
        state: this.snapshot.lastSyncedAt ? "synced" : "online",
        pendingCount: 0,
        failedCount: 0,
      });
      return { ok: true, syncedCount: 0 };
    }

    this.syncingInFlight = true;
    this.emit({ state: "syncing", lastError: null });

    try {
      const result = await this.transport.syncOperations(token, userOps);

      // Verify user hasn't logged out or switched accounts mid-request
      if (this.activeUserId !== userId || this.activeToken !== token) {
        return { ok: false, syncedCount: 0 };
      }

      if (result.appliedOpIds?.length) {
        await idbRemoveOperations(result.appliedOpIds);
      }

      // Mark any conflicting operations
      const conflictIds = new Set((result.conflicts || []).map((c) => c.operationId));
      for (const op of userOps) {
        if (conflictIds.has(op.id)) {
          await idbUpdateOperation({
            ...op,
            status: "conflict",
            retryCount: op.retryCount + 1,
          });
        }
      }

      const fullServerState: AppState = { ...result.state, isAuthenticated: true };
      await idbSaveUserState(userId, fullServerState, result.syncedAt);
      if (this.onServerStateApplied) {
        this.onServerStateApplied(userId, fullServerState);
      }

      const remainingOps = await idbListUserOperations(userId);
      const hasConflicts = (result.conflicts || []).length > 0;
      this.emit({
        state: hasConflicts ? "error" : remainingOps.length === 0 ? "synced" : "online",
        isOnline: true,
        pendingCount: remainingOps.length,
        failedCount: remainingOps.filter((o) => o.status === "failed" || o.status === "conflict").length,
        lastSyncedAt: result.syncedAt,
        lastError: hasConflicts ? "Sync conflict detected on one or more items." : null,
        conflicts: result.conflicts || [],
      });

      return { ok: !hasConflicts, syncedCount: result.appliedOpIds?.length || 0 };
    } catch (err) {
      if (this.activeUserId !== userId) {
        return { ok: false, syncedCount: 0 };
      }
      const message = err instanceof Error ? err.message : "Sync failed";
      const status = (err as { status?: number })?.status;
      for (const op of userOps) {
        await idbUpdateOperation({
          ...op,
          status: "failed",
          retryCount: op.retryCount + 1,
          errorMessage: message,
        });
      }
      const remainingOps = await idbListUserOperations(userId);
      const nowOnline = isNavigatorOnline();
      this.emit({
        state: !nowOnline ? "offline" : "error",
        isOnline: nowOnline,
        pendingCount: remainingOps.length,
        failedCount: remainingOps.length,
        lastError:
          status === 401
            ? "Session expired. Please sign in again to sync."
            : message,
      });
      return { ok: false, syncedCount: 0 };
    } finally {
      this.syncingInFlight = false;
    }
  }

  public async resolveConflictKeepServer(operationId: string): Promise<void> {
    await idbRemoveOperations([operationId]);
    if (this.activeUserId) {
      const remaining = await idbListUserOperations(this.activeUserId);
      const remainingConflicts = this.snapshot.conflicts.filter(
        (c) => c.operationId !== operationId
      );
      this.emit({
        pendingCount: remaining.length,
        failedCount: remaining.filter((o) => o.status === "failed" || o.status === "conflict").length,
        conflicts: remainingConflicts,
        state: remaining.length === 0 ? "synced" : "online",
        lastError: remainingConflicts.length === 0 ? null : this.snapshot.lastError,
      });
    }
  }
}

export const syncManager = new OfflineSyncManager();
