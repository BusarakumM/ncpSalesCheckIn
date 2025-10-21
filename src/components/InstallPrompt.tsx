"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice?: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault?.();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt as any);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt as any);
  }, []);

  if (!visible || !deferred) return null;

  async function onInstall() {
    try {
      await deferred.prompt();
      setVisible(false);
    } catch {
      setVisible(false);
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-4 z-[9999] mx-auto w-[92%] max-w-md rounded-2xl border border-black/10 bg-white shadow-lg">
      <div className="p-3 sm:p-4 flex items-center justify-between gap-3">
        <div className="text-sm sm:text-base font-medium text-gray-900">Install this app?</div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setVisible(false)}
            className="text-sm text-gray-600 hover:text-gray-800 px-3 py-1.5 rounded-full border border-black/10"
          >
            Later
          </button>
          <button
            onClick={onInstall}
            className="text-sm bg-[#E8CC5C] text-gray-900 hover:bg-[#e3c54a] px-4 py-1.5 rounded-full border border-black/20"
          >
            Install
          </button>
        </div>
      </div>
    </div>
  );
}

