import { useState, useEffect, useCallback } from "react";

interface NetworkStatus {
  isOnline: boolean;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
}

interface NetworkInformationLike {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  addEventListener?: (type: "change", listener: () => void) => void;
  removeEventListener?: (type: "change", listener: () => void) => void;
}

type NavigatorWithConnection = Navigator & {
  connection?: NetworkInformationLike;
  mozConnection?: NetworkInformationLike;
  webkitConnection?: NetworkInformationLike;
};

function getNetworkConnection(nav: NavigatorWithConnection): NetworkInformationLike | undefined {
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
}

export function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: navigator.onLine,
  });

  const updateNetworkStatus = useCallback(() => {
    const nav = navigator as NavigatorWithConnection;
    const connection = getNetworkConnection(nav);

    setStatus({
      isOnline: navigator.onLine,
      effectiveType: connection?.effectiveType,
      downlink: connection?.downlink,
      rtt: connection?.rtt,
    });
  }, []);

  useEffect(() => {
    const nav = navigator as NavigatorWithConnection;
    const connection = getNetworkConnection(nav);

    updateNetworkStatus();

    window.addEventListener("online", updateNetworkStatus);
    window.addEventListener("offline", updateNetworkStatus);

    connection?.addEventListener?.("change", updateNetworkStatus);

    return () => {
      window.removeEventListener("online", updateNetworkStatus);
      window.removeEventListener("offline", updateNetworkStatus);
      connection?.removeEventListener?.("change", updateNetworkStatus);
    };
  }, [updateNetworkStatus]);

  return status;
}
