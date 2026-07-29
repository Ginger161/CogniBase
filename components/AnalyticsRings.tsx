"use client";

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export interface RingMetrics {
  volumeProgress: number; // 0 to 1
  focusProgress: number;  // 0 to 1
  accuracyProgress: number; // 0 to 1
}

export default function AnalyticsRings({ metrics }: { metrics: RingMetrics }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const size = 320;
  const center = size / 2;
  const strokeWidth = 24;
  const gap = 4;

  const rings = [
    {
      label: 'Volume',
      color: '#F97316', // Orange
      progress: metrics.volumeProgress,
      radius: 120,
    },
    {
      label: 'Focus',
      color: '#3B82F6', // Blue
      progress: metrics.focusProgress,
      radius: 120 - strokeWidth - gap,
    },
    {
      label: 'Accuracy',
      color: '#22C55E', // Green
      progress: metrics.accuracyProgress,
      radius: 120 - (strokeWidth + gap) * 2,
    }
  ];

  return (
    <div className="relative flex items-center justify-center bg-zinc-950 p-8 rounded-[2.5rem] shadow-2xl border border-zinc-800/50" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
        {rings.map((ring, index) => {
          const circumference = 2 * Math.PI * ring.radius;
          return (
            <g key={ring.label}>
              {/* Empty Track */}
              <circle
                cx={center}
                cy={center}
                r={ring.radius}
                stroke="#27272a" // stroke-zinc-800 equivalent
                strokeWidth={strokeWidth}
                fill="none"
              />
              {/* Progress Ring */}
              <motion.circle
                cx={center}
                cy={center}
                r={ring.radius}
                stroke={ring.color}
                strokeWidth={strokeWidth}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: mounted ? circumference * (1 - Math.min(ring.progress, 1)) : circumference }}
                transition={{ duration: 1.5, ease: "easeOut", delay: index * 0.15 }}
                style={{
                  filter: mounted ? `drop-shadow(0 0 6px ${ring.color}80)` : 'none',
                }}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
