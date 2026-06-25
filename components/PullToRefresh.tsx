'use client';

import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { usePullToRefresh } from '../lib/hooks/usePullToRefresh';

export default function PullToRefresh({
  children,
  onRefresh,
}: {
  children: React.ReactNode;
  onRefresh: () => Promise<void>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Set the threshold for pull (e.g., 100px)
  const { pullDistance, isRefreshing, threshold } = usePullToRefresh(containerRef, onRefresh, 100);

  const isThresholdReached = pullDistance >= threshold;
  
  // Calculate progress bar for terminal UI: [=====     ]
  const progressPercent = Math.min((pullDistance / threshold) * 100, 100);
  const barsCount = Math.floor(progressPercent / 10);
  const progressBar = `[${'='.repeat(barsCount)}${' '.repeat(10 - barsCount)}]`;

  return (
    <div 
      ref={containerRef} 
      className="relative h-full w-full overflow-y-auto overflow-x-hidden hide-scrollbar overscroll-y-none"
    >
      <motion.div
        animate={{ y: isRefreshing ? threshold : pullDistance }}
        transition={{ type: 'spring', stiffness: 300, damping: 30, mass: 1 }}
        className="min-h-full relative w-full"
      >
        {/* Terminal UI Wrapper - Placed visually above the content */}
        <div 
          className="absolute left-0 w-full flex flex-col items-center justify-center bg-[#0A1128] border-b border-gray-800 pointer-events-none overflow-hidden"
          style={{ top: -threshold, height: threshold }}
        >
          <div className="w-full h-full p-4 font-mono text-sm shadow-xl flex flex-col items-center justify-center">
            {isRefreshing ? (
              <div className="text-orange-500 font-bold flex items-center">
                <span>&gt;_ EXECUTING DATA SYNC...</span>
                <span className="animate-pulse ml-1">_</span>
              </div>
            ) : isThresholdReached ? (
              <div className="text-green-500 font-bold">
                &gt;_ Connection secure. Release to sync.
              </div>
            ) : (
              <div className="text-orange-500">
                &gt;_ Establishing uplink... {progressBar}
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        {children}
      </motion.div>
    </div>
  );
}
