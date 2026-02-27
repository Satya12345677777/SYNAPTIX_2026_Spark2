import { useEffect, useCallback, useState } from "react";
import { useAuth } from "./useAuth";
import { useNetworkStatus } from "./useNetworkStatus";
import {
  syncPendingTransactions,
  setSyncCallback,
  startAutoSync,
  stopAutoSync,
} from "@/lib/syncEngine";
import { getPendingTransactions } from "@/lib/offlineDb";
import { toast } from "@/hooks/use-toast";

export function useSyncEngine() {
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Update pending count
  const updatePendingCount = useCallback(async () => {
    const pending = await getPendingTransactions();
    setPendingCount(pending.length);
  }, []);

  // Manual sync trigger
  const triggerSync = useCallback(async () => {
    if (!isOnline) {
      toast({
        title: "You're offline",
        description: "Transactions will sync when you're back online.",
      });
      return;
    }

    setIsSyncing(true);
    const result = await syncPendingTransactions();
    setIsSyncing(false);
    await updatePendingCount();
    return result;
  }, [isOnline, updatePendingCount]);

  // Setup sync callback for notifications
  useEffect(() => {
    setSyncCallback((status, message, count) => {
      if (status === "syncing") {
        setIsSyncing(true);
      } else {
        setIsSyncing(false);
        updatePendingCount();

        if (status === "success" && message) {
          toast({
            title: "Sync Complete",
            description: message,
          });
        } else if (status === "error" && message) {
          toast({
            title: "Sync Issue",
            description: message,
            variant: "destructive",
          });
        }
      }
    });

    return () => {
      setSyncCallback(null);
    };
  }, [updatePendingCount]);

  // Start auto-sync when user is logged in
  useEffect(() => {
    if (user) {
      startAutoSync();
      updatePendingCount();
    }

    return () => {
      stopAutoSync();
    };
  }, [user, updatePendingCount]);

  // Update pending count when coming online
  useEffect(() => {
    if (isOnline) {
      updatePendingCount();
    }
  }, [isOnline, updatePendingCount]);

  return {
    isSyncing,
    pendingCount,
    triggerSync,
    updatePendingCount,
  };
}
