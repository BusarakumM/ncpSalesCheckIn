"use client";

import { useEffect, useState } from "react";

type NetworkInformationLike = {
  effectiveType?: string;
  saveData?: boolean;
  addEventListener?: (type: "change", listener: () => void) => void;
  removeEventListener?: (type: "change", listener: () => void) => void;
  onchange?: (() => void) | null;
};

type NavigatorWithConnection = Navigator & {
  connection?: NetworkInformationLike;
  mozConnection?: NetworkInformationLike;
  webkitConnection?: NetworkInformationLike;
};

function getConnection(): NetworkInformationLike | undefined {
  if (typeof navigator === "undefined") return undefined;
  const nav = navigator as NavigatorWithConnection;
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
}

function getAdaptiveMediaPreference() {
  if (typeof window === "undefined") {
    return { enabled: false, constrained: true };
  }

  const mobileViewport = window.matchMedia("(max-width: 768px)").matches;
  const connection = getConnection();
  const effectiveType = String(connection?.effectiveType || "").toLowerCase();
  const saveData = connection?.saveData === true;
  const slowConnection = ["slow-2g", "2g", "3g"].includes(effectiveType);
  const constrained = mobileViewport || saveData || slowConnection;

  return {
    enabled: !constrained,
    constrained,
  };
}

export function useAdaptiveMediaToggle() {
  const [showMedia, setShowMedia] = useState(false);
  const [autoMode, setAutoMode] = useState(true);
  const [isConstrained, setIsConstrained] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const connection = getConnection();

    const syncPreference = () => {
      const preference = getAdaptiveMediaPreference();
      setIsConstrained(preference.constrained);
      if (autoMode) {
        setShowMedia(preference.enabled);
      }
    };

    syncPreference();

    const handleViewportChange = () => syncPreference();
    const handleConnectionChange = () => syncPreference();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleViewportChange);
    } else {
      mediaQuery.addListener(handleViewportChange);
    }

    if (connection?.addEventListener) {
      connection.addEventListener("change", handleConnectionChange);
    } else if (connection) {
      connection.onchange = handleConnectionChange;
    }

    return () => {
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", handleViewportChange);
      } else {
        mediaQuery.removeListener(handleViewportChange);
      }

      if (connection?.removeEventListener) {
        connection.removeEventListener("change", handleConnectionChange);
      } else if (connection && connection.onchange === handleConnectionChange) {
        connection.onchange = null;
      }
    };
  }, [autoMode]);

  function toggleShowMedia() {
    setAutoMode(false);
    setShowMedia((prev) => !prev);
  }

  return {
    autoMode,
    isConstrained,
    showMedia,
    toggleShowMedia,
  };
}
