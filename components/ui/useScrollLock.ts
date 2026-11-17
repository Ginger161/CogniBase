'use client';

import { useEffect } from 'react';

// How many overlays currently want the page frozen. Two can be open at once (a sheet over the reader), so the
// page only unfreezes when the last one closes.
let locks = 0;

/**
 * Freezes the page behind an open sheet, dialog or full-screen view so only the overlay scrolls.
 * The app scrolls inside <main>, not the body, so the lock is a class on <html> that globals.css applies to both.
 */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    locks += 1;
    document.documentElement.classList.add('scroll-locked');
    return () => {
      locks -= 1;
      if (locks <= 0) {
        locks = 0;
        document.documentElement.classList.remove('scroll-locked');
      }
    };
  }, [active]);
}
