"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Flame, Clock, CheckCircle2, Target, Loader2 } from 'lucide-react';
import { useUserContext } from '@/lib/hooks/useUserContext';

interface RingData {
  label: string;
  color: string;
  progress: number; // 0 to 1
  radius: number;
  strokeWidth: number;
  icon: React.ReactNode;
  value: string;
}

const ActivityRings = ({ rings }: { rings: RingData[] }) => {
  const center = 150;

  return (
    <div className="relative w-[300px] h-[300px] flex items-center justify-center">
      <svg width="300" height="300" viewBox="0 0 300 300" className="transform -rotate-90">
        {rings.map((ring, index) => {
          const circumference = 2 * Math.PI * ring.radius;
          return (
            <g key={ring.label}>
              {/* Background Track */}
              <circle
                cx={center}
                cy={center}
                r={ring.radius}
                stroke={ring.color}
                strokeWidth={ring.strokeWidth}
                fill="none"
                opacity={0.2}
              />
              {/* Animated Progress Ring */}
              <motion.circle
                cx={center}
                cy={center}
                r={ring.radius}
                stroke={ring.color}
                strokeWidth={ring.strokeWidth}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: circumference * (1 - Math.min(ring.progress, 1)) }}
                transition={{ duration: 1.5, ease: "easeOut", delay: index * 0.2 }}
                style={{
                  filter: `drop-shadow(0 0 8px ${ring.color}80)`,
                }}
              />
            </g>
          );
        })}
      </svg>
      
      <div className="absolute flex flex-col items-center justify-center pointer-events-none">
        <Target className="w-8 h-8 text-zinc-600 opacity-50" />
      </div>
    </div>
  );
};

export default function StudyAnalyticsDashboard() {
  const { context } = useUserContext();
  const [isLoading, setIsLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    today: { focusMinutes: 0, tasksCompleted: 0, averageAccuracy: 0 },
    weekDays: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
    streakData: [false, false, false, false, false, false, false],
    historicalFocusMinutes: [0, 0, 0, 0, 0, 0, 0],
    currentStreak: 0
  });

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch('/api/metrics');
        if (res.ok) {
          const data = await res.json();
          setMetrics(data);
        }
      } catch (err) {
        console.error("Failed to fetch metrics", err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchMetrics();
  }, []);

  const DAILY_GOAL_MINUTES = 120;
  const DAILY_GOAL_TASKS = 5;

  const ringsData: RingData[] = [
    {
      label: 'Tasks Completed',
      color: '#F97316', // Orange
      progress: metrics.today.tasksCompleted / DAILY_GOAL_TASKS,
      radius: 110,
      strokeWidth: 20,
      icon: <CheckCircle2 className="w-5 h-5 text-orange-500" />,
      value: `${metrics.today.tasksCompleted}/${DAILY_GOAL_TASKS}`
    },
    {
      label: 'Deep Work Minutes',
      color: '#3B82F6', // Blue
      progress: metrics.today.focusMinutes / DAILY_GOAL_MINUTES,
      radius: 80,
      strokeWidth: 20,
      icon: <Clock className="w-5 h-5 text-blue-500" />,
      value: `${metrics.today.focusMinutes} min`
    },
    {
      label: 'Knowledge Retention',
      color: '#22C55E', // Green
      progress: (metrics.today.averageAccuracy || 0) / 100,
      radius: 50,
      strokeWidth: 20,
      icon: <Target className="w-5 h-5 text-green-500" />,
      value: `${Math.round(metrics.today.averageAccuracy || 0)}%`
    }
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        <p className="text-zinc-500 mt-4 animate-pulse">Syncing Deep Work metrics...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-slate-100 flex flex-col items-center py-12 px-4 sm:px-6 font-sans">
      
      {/* Header */}
      <div className="w-full max-w-lg mb-10 text-center sm:text-left">
        <motion.h1 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-bold text-white tracking-tight"
        >
          Hello {context?.name || 'Student'}.
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-zinc-400 mt-2 text-sm sm:text-base"
        >
          Your daily deep work metrics.
        </motion.p>
      </div>

      {/* Rings Container */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/50 rounded-[2.5rem] p-8 shadow-2xl w-full max-w-lg flex flex-col items-center mb-8 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-zinc-800/20 to-transparent pointer-events-none" />
        
        <ActivityRings rings={ringsData} />

        {/* Legend / Metrics breakdown */}
        <div className="w-full mt-10 grid grid-cols-3 gap-2">
          {ringsData.map((ring, idx) => (
            <motion.div 
              key={ring.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + (idx * 0.1) }}
              className="flex flex-col items-center text-center p-3 rounded-2xl bg-zinc-800/30 border border-zinc-700/30"
            >
              <div className="mb-2">{ring.icon}</div>
              <span className="text-xl font-bold text-white tracking-tight">{ring.value}</span>
              <span className="text-[0.65rem] uppercase tracking-wider font-semibold text-zinc-500 mt-1">{ring.label}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Streak Engine */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="w-full max-w-lg bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/50 rounded-3xl p-6 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute right-0 top-0 w-32 h-32 bg-orange-500/10 rounded-full blur-[50px] pointer-events-none" />
        
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Consistency <Flame className="w-5 h-5 text-orange-500" />
            </h2>
            <p className="text-sm text-zinc-400">Keep the fire burning.</p>
          </div>
          <div className="text-right">
            <span className="text-3xl font-black text-white">{metrics.currentStreak}</span>
            <span className="text-zinc-500 font-semibold ml-1 uppercase text-xs">Days</span>
          </div>
        </div>

        <div className="flex justify-between items-center px-2">
          {metrics.weekDays.map((day, idx) => {
            const isActive = metrics.streakData[idx];
            return (
              <div key={idx} className="flex flex-col items-center gap-3">
                <span className="text-xs font-semibold text-zinc-500">{day}</span>
                <div className="relative">
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.8 + (idx * 0.05), type: "spring" }}
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                      isActive 
                        ? 'bg-orange-500/20 border-orange-500/50 text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.3)]' 
                        : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-600'
                    }`}
                  >
                    {isActive ? (
                      <Flame className="w-5 h-5 fill-orange-500/20" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-zinc-700" />
                    )}
                  </motion.div>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Historical Data (Bar Chart) */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="w-full max-w-lg bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/50 rounded-3xl p-6 shadow-2xl relative overflow-hidden mt-8 mb-12"
      >
        <div className="absolute right-0 top-0 w-32 h-32 bg-[#3B82F6]/10 rounded-full blur-[50px] pointer-events-none" />
        
        <div className="mb-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            Historical Data
          </h2>
          <p className="text-sm text-zinc-400">Deep Work Minutes (Last 7 Days)</p>
        </div>

        <div className="flex justify-between items-end h-40 mt-4 px-2">
          {metrics.weekDays.map((day, idx) => {
            const minutes = metrics.historicalFocusMinutes[idx] || 0;
            const maxMinutes = Math.max(...metrics.historicalFocusMinutes, 60); // min 60 to avoid /0
            const heightPercentage = Math.min((minutes / maxMinutes) * 100, 100);
            
            return (
              <div key={idx} className="flex flex-col items-center gap-3 w-8">
                <div className="relative w-full h-full flex items-end justify-center group cursor-pointer">
                  {/* Tooltip on hover */}
                  <div className="absolute -top-8 bg-zinc-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-lg">
                    {minutes} min
                  </div>
                  {/* Bar */}
                  <div className="w-full bg-zinc-800/50 rounded-t-md overflow-hidden relative" style={{ height: '100%' }}>
                    <motion.div 
                      initial={{ height: 0 }}
                      animate={{ height: `${heightPercentage}%` }}
                      transition={{ duration: 1, delay: 0.5 + (idx * 0.1), ease: "easeOut" }}
                      className="absolute bottom-0 w-full bg-[#3B82F6] rounded-t-md"
                    />
                  </div>
                </div>
                <span className="text-xs font-semibold text-zinc-500">{day}</span>
              </div>
            );
          })}
        </div>
      </motion.div>

    </div>
  );
}
