'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';

const OFFLINE_TOAST = 'network-status';

/** Tells people when the connection drops, so failed actions make sense, and when it comes back. */
export function NetworkStatus() {
  useEffect(() => {
    const goOffline = () => toast.error("You're offline. Some things won't work until you reconnect.", { id: OFFLINE_TOAST, duration: Infinity });
    const goOnline = () => toast.success('Back online.', { id: OFFLINE_TOAST, duration: 2500 });
    if (!navigator.onLine) goOffline();
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);
  return null;
}
