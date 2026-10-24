'use client';

import { Toaster } from 'sonner';
import { useTheme } from 'next-themes';

export function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      position="bottom-right"
      theme={resolvedTheme === 'ivory' ? 'light' : 'dark'}
      richColors
      closeButton
    />
  );
}
