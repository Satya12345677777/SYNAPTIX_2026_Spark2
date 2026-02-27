import { openDB, DBSchema, IDBPDatabase } from "idb";

interface PendingTransaction {
  id: string;
  senderId: string;
  receiverId: string;
  receiverPhone?: string;
  amount: number;
  timestamp: number;
  status: "pending" | "syncing" | "failed";
  hash: string;
  retryCount: number;
  deviceId: string;
  description?: string;
}

export interface CachedRecipient {
  id: string;
  user_id: string;
  display_name: string | null;
  payment_id: string;
  cached_at: number;
}

interface OfflinePayDB extends DBSchema {
  pendingTransactions: {
    key: string;
    value: PendingTransaction;
    indexes: {
      "by-status": string;
      "by-timestamp": number;
      "by-sender": string;
    };
  };
  offlineSettings: {
    key: string;
    value: {
      key: string;
      value: unknown;
    };
  };
  cachedRecipients: {
    key: string;
    value: CachedRecipient;
    indexes: {
      "by-payment-id": string;
    };
  };
}

let dbInstance: IDBPDatabase<OfflinePayDB> | null = null;

async function getDB(): Promise<IDBPDatabase<OfflinePayDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<OfflinePayDB>("offlinepay-db", 2, {
    upgrade(db, oldVersion) {
      // Pending transactions store
      if (!db.objectStoreNames.contains("pendingTransactions")) {
        const txStore = db.createObjectStore("pendingTransactions", {
          keyPath: "id",
        });
        txStore.createIndex("by-status", "status");
        txStore.createIndex("by-timestamp", "timestamp");
        txStore.createIndex("by-sender", "senderId");
      }

      // Offline settings store
      if (!db.objectStoreNames.contains("offlineSettings")) {
        db.createObjectStore("offlineSettings", { keyPath: "key" });
      }

      // Cached recipients store (added in version 2)
      if (!db.objectStoreNames.contains("cachedRecipients")) {
        const recipientStore = db.createObjectStore("cachedRecipients", {
          keyPath: "id",
        });
        recipientStore.createIndex("by-payment-id", "payment_id");
      }
    },
  });

  return dbInstance;
}

// Generate a simple hash for transaction integrity
function generateHash(tx: Omit<PendingTransaction, "hash" | "id">): string {
  const data = `${tx.senderId}:${tx.receiverId}:${tx.amount}:${tx.timestamp}:${tx.deviceId}`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

// Get device ID (persistent across sessions)
function getDeviceId(): string {
  let deviceId = localStorage.getItem("offlinepay-device-id");
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem("offlinepay-device-id", deviceId);
  }
  return deviceId;
}

export async function addPendingTransaction(
  tx: Omit<PendingTransaction, "id" | "hash" | "status" | "retryCount" | "deviceId" | "timestamp">
): Promise<PendingTransaction> {
  const db = await getDB();
  const deviceId = getDeviceId();
  const timestamp = Date.now();
  
  const fullTx: Omit<PendingTransaction, "hash" | "id"> = {
    ...tx,
    timestamp,
    status: "pending",
    retryCount: 0,
    deviceId,
  };

  const hash = generateHash(fullTx);
  const id = `tx-${timestamp}-${hash.slice(0, 8)}`;

  const transaction: PendingTransaction = {
    ...fullTx,
    id,
    hash,
  };

  await db.put("pendingTransactions", transaction);
  return transaction;
}

export async function getPendingTransactions(): Promise<PendingTransaction[]> {
  const db = await getDB();
  return db.getAllFromIndex("pendingTransactions", "by-status", "pending");
}

export async function getAllOfflineTransactions(): Promise<PendingTransaction[]> {
  const db = await getDB();
  const all = await db.getAll("pendingTransactions");
  return all.sort((a, b) => b.timestamp - a.timestamp);
}

export async function updateTransactionStatus(
  id: string,
  status: PendingTransaction["status"],
  incrementRetry = false
): Promise<void> {
  const db = await getDB();
  const tx = await db.get("pendingTransactions", id);
  if (tx) {
    tx.status = status;
    if (incrementRetry) {
      tx.retryCount += 1;
    }
    await db.put("pendingTransactions", tx);
  }
}

export async function deleteTransaction(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("pendingTransactions", id);
}

export async function clearSyncedTransactions(): Promise<void> {
  const db = await getDB();
  const all = await db.getAll("pendingTransactions");
  const tx = db.transaction("pendingTransactions", "readwrite");
  
  for (const item of all) {
    if (item.status !== "pending" && item.status !== "syncing") {
      await tx.store.delete(item.id);
    }
  }
  
  await tx.done;
}

// Offline settings helpers
export async function setOfflineSetting<T>(key: string, value: T): Promise<void> {
  const db = await getDB();
  await db.put("offlineSettings", { key, value });
}

export async function getOfflineSetting<T>(key: string): Promise<T | null> {
  const db = await getDB();
  const setting = await db.get("offlineSettings", key);
  return (setting?.value as T | undefined) ?? null;
}

// Get today's offline transaction total for limit checking
export async function getTodayOfflineTotal(userId: string): Promise<number> {
  const db = await getDB();
  const transactions = await db.getAllFromIndex(
    "pendingTransactions",
    "by-sender",
    userId
  );
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStart = today.getTime();
  
  return transactions
    .filter((tx) => tx.timestamp >= todayStart && tx.status !== "failed")
    .reduce((sum, tx) => sum + tx.amount, 0);
}

// Cached recipients helpers
export async function cacheRecipient(recipient: Omit<CachedRecipient, "cached_at">): Promise<void> {
  const db = await getDB();
  await db.put("cachedRecipients", {
    ...recipient,
    cached_at: Date.now(),
  });
}

export async function getCachedRecipientByPaymentId(paymentId: string): Promise<CachedRecipient | null> {
  const db = await getDB();
  const results = await db.getAllFromIndex("cachedRecipients", "by-payment-id", paymentId);
  return results.length > 0 ? results[0] : null;
}

export async function getAllCachedRecipients(): Promise<CachedRecipient[]> {
  const db = await getDB();
  return db.getAll("cachedRecipients");
}

export type { PendingTransaction };
