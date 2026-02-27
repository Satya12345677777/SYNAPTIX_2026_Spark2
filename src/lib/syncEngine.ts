import { supabase } from "@/integrations/supabase/client";
import {
  getPendingTransactions,
  updateTransactionStatus,
  deleteTransaction,
  PendingTransaction,
} from "./offlineDb";

type SyncCallback = (
  status: "syncing" | "success" | "error",
  message?: string,
  count?: number
) => void;

let isSyncing = false;
let syncCallback: SyncCallback | null = null;

export function setSyncCallback(callback: SyncCallback | null) {
  syncCallback = callback;
}

export async function syncPendingTransactions(): Promise<{
  synced: number;
  failed: number;
}> {
  if (isSyncing) {
    console.log("Sync already in progress");
    return { synced: 0, failed: 0 };
  }

  isSyncing = true;
  let synced = 0;
  let failed = 0;

  try {
    const pending = await getPendingTransactions();

    if (pending.length === 0) {
      isSyncing = false;
      return { synced: 0, failed: 0 };
    }

    syncCallback?.("syncing", `Syncing ${pending.length} transactions...`, pending.length);

    for (const tx of pending) {
      try {
        // Mark as syncing
        await updateTransactionStatus(tx.id, "syncing");

        // Check for duplicate (double-spend prevention)
        const { data: existing } = await supabase
          .from("transactions")
          .select("id")
          .eq("transaction_hash", tx.hash)
          .maybeSingle();

        if (existing) {
          console.log(`Transaction ${tx.id} already synced, removing local copy`);
          await deleteTransaction(tx.id);
          synced++;
          continue;
        }

        // Process the transaction
        const { data, error } = await supabase.rpc("process_transaction", {
          _sender_id: tx.senderId,
          _receiver_id: tx.receiverId,
          _amount: tx.amount,
          _description: tx.description || null,
          _is_offline: true,
          _transaction_hash: tx.hash,
          _device_id: tx.deviceId,
        });

        if (error) {
          throw error;
        }

        // Success - remove from local storage
        await deleteTransaction(tx.id);
        synced++;
        console.log(`Transaction ${tx.id} synced successfully as ${data}`);
      } catch (error: unknown) {
        console.error(`Failed to sync transaction ${tx.id}:`, error);

        // Update retry count and mark as failed if too many retries
        await updateTransactionStatus(tx.id, tx.retryCount >= 2 ? "failed" : "pending", true);
        failed++;
      }
    }

    if (synced > 0) {
      syncCallback?.("success", `${synced} transaction${synced > 1 ? "s" : ""} synced!`, synced);
    }

    if (failed > 0) {
      syncCallback?.("error", `${failed} transaction${failed > 1 ? "s" : ""} failed to sync`, failed);
    }

    return { synced, failed };
  } finally {
    isSyncing = false;
  }
}

// Auto-sync when coming online
let onlineListener: (() => void) | null = null;

export function startAutoSync() {
  if (onlineListener) return;

  onlineListener = () => {
    console.log("Network online, triggering sync...");
    // Small delay to ensure stable connection
    setTimeout(() => {
      syncPendingTransactions();
    }, 1000);
  };

  window.addEventListener("online", onlineListener);

  // Also sync on startup if online
  if (navigator.onLine) {
    setTimeout(() => {
      syncPendingTransactions();
    }, 2000);
  }
}

export function stopAutoSync() {
  if (onlineListener) {
    window.removeEventListener("online", onlineListener);
    onlineListener = null;
  }
}
