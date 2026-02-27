import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// VAPID public key - this is safe to expose in client code
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

interface PushNotificationState {
  isSupported: boolean;
  permission: NotificationPermission | "unsupported";
  isSubscribed: boolean;
  isLoading: boolean;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    permission: "unsupported",
    isSubscribed: false,
    isLoading: true,
  });

  // Check if push notifications are supported
  const isSupported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

  // Check subscription status
  const checkSubscription = useCallback(async () => {
    if (!isSupported || !user) {
      setState((prev) => ({ ...prev, isLoading: false }));
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      setState({
        isSupported: true,
        permission: Notification.permission,
        isSubscribed: !!subscription,
        isLoading: false,
      });
    } catch (error) {
      console.error("Error checking subscription:", error);
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [user, isSupported]);

  // Register service worker on mount
  useEffect(() => {
    if (!isSupported) {
      setState({
        isSupported: false,
        permission: "unsupported",
        isSubscribed: false,
        isLoading: false,
      });
      return;
    }

    navigator.serviceWorker
      .register("/sw.js")
      .then(() => {
        checkSubscription();
      })
      .catch((error) => {
        console.error("Service worker registration failed:", error);
        setState((prev) => ({ ...prev, isLoading: false }));
      });
  }, [isSupported, checkSubscription]);

  // Subscribe to push notifications
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !user || !VAPID_PUBLIC_KEY) {
      console.error("Push notifications not supported or missing VAPID key");
      return false;
    }

    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState((prev) => ({ ...prev, permission, isLoading: false }));
        return false;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as BufferSource,
      });

      // Extract keys
      const p256dhKey = subscription.getKey("p256dh");
      const authKey = subscription.getKey("auth");
      
      if (!p256dhKey || !authKey) {
        throw new Error("Failed to get subscription keys");
      }
      
      const p256dh = btoa(String.fromCharCode(...Array.from(new Uint8Array(p256dhKey))));
      const auth = btoa(String.fromCharCode(...Array.from(new Uint8Array(authKey))));

      // Save to database
      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          endpoint: subscription.endpoint,
          p256dh,
          auth,
        },
        { onConflict: "user_id,endpoint" }
      );

      if (error) throw error;

      setState({
        isSupported: true,
        permission: "granted",
        isSubscribed: true,
        isLoading: false,
      });

      return true;
    } catch (error) {
      console.error("Error subscribing to push:", error);
      setState((prev) => ({ ...prev, isLoading: false }));
      return false;
    }
  }, [user, isSupported]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !user) return false;

    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe from browser
        await subscription.unsubscribe();

        // Remove from database
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("user_id", user.id)
          .eq("endpoint", subscription.endpoint);
      }

      setState({
        isSupported: true,
        permission: Notification.permission,
        isSubscribed: false,
        isLoading: false,
      });

      return true;
    } catch (error) {
      console.error("Error unsubscribing:", error);
      setState((prev) => ({ ...prev, isLoading: false }));
      return false;
    }
  }, [user, isSupported]);

  return {
    ...state,
    subscribe,
    unsubscribe,
  };
}
