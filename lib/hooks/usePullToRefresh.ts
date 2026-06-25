import { useState, useEffect, RefObject } from 'react';

export function usePullToRefresh(
  containerRef: RefObject<HTMLElement | null>,
  onRefresh: () => Promise<void>,
  threshold: number = 100
) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let startY = 0;
    let currentY = 0;
    let isPulling = false;

    const handleTouchStart = (e: TouchEvent) => {
      // Only allow pull if we are at the absolute top of the container
      if (container.scrollTop <= 0) {
        startY = e.touches[0].clientY;
        isPulling = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling || isRefreshing) return;
      
      currentY = e.touches[0].clientY;
      const distance = currentY - startY;

      // Only track if pulling downwards and we are at the top
      if (distance > 0 && container.scrollTop <= 0) {
        // Prevent default native overscroll on browsers that support it
        if (e.cancelable) {
          e.preventDefault();
        }
        
        // Apply friction to the pull distance for a natural feel
        const visualDistance = Math.min(distance * 0.4, threshold + 50);
        setPullDistance(visualDistance);
      } else {
        setPullDistance(0);
      }
    };

    const handleTouchEnd = async () => {
      if (!isPulling) return;
      isPulling = false;
      
      if (pullDistance >= threshold && !isRefreshing) {
        setIsRefreshing(true);
        setPullDistance(threshold); // Lock at threshold while refreshing
        
        try {
          await onRefresh();
        } finally {
          setIsRefreshing(false);
          setPullDistance(0);
        }
      } else {
        // Did not reach threshold, snap back
        setPullDistance(0);
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    // Must be passive: false to allow e.preventDefault()
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [containerRef, onRefresh, isRefreshing, pullDistance, threshold]);

  return { pullDistance, isRefreshing, threshold };
}
