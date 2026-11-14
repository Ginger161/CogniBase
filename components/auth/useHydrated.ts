import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * False while the page is server-rendered and until React has taken it over, true afterwards.
 * The auth forms arrive as HTML before their JavaScript does. A submit in that gap is handled by the browser itself
 * (the page reloads and the typed details are lost), so the submit buttons stay disabled until this is true.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
