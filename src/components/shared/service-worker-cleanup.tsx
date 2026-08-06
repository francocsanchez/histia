"use client";

import { useEffect } from "react";

export function ServiceWorkerCleanup() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    void (async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      const staleRegistrations = registrations.filter((registration) => {
        const scriptUrl =
          registration.active?.scriptURL ??
          registration.waiting?.scriptURL ??
          registration.installing?.scriptURL ??
          "";

        return scriptUrl.endsWith("/recordatorios-sw.js");
      });

      await Promise.all(staleRegistrations.map((registration) => registration.unregister()));

      if ("caches" in window) {
        const cacheKeys = await caches.keys();
        const staleKeys = cacheKeys.filter((key) => key.includes("recordatorios"));

        await Promise.all(staleKeys.map((key) => caches.delete(key)));
      }
    })();
  }, []);

  return null;
}
