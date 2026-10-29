'use client';

import { useEffect } from 'react';

/** Registers the service worker (production only, so development is never served stale files). */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* offline support is an extra; the app works without it */
    });
  }, []);
  return null;
}
