import { useState, useCallback } from 'react';

export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 1500
) {
  const [isThrottled, setIsThrottled] = useState(false);

  const throttledFunction = useCallback(
    (...args: Parameters<T>) => {
      if (isThrottled) {
        return;
      }
      setIsThrottled(true);
      setTimeout(() => {
        setIsThrottled(false);
      }, delay);
      
      return callback(...args);
    },
    [callback, isThrottled, delay]
  );

  return { throttledFunction, isThrottled };
}
