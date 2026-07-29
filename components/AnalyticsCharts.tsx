"use client";

import React, { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

type TimeFrame = 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';

const dummyData = {
  Daily: [
    { name: '6 AM', focus: 20, tasks: 1 },
    { name: '9 AM', focus: 45, tasks: 3 },
    { name: '12 PM', focus: 60, tasks: 4 },
    { name: '3 PM', focus: 30, tasks: 2 },
    { name: '6 PM', focus: 90, tasks: 6 },
    { name: '9 PM', focus: 15, tasks: 1 },
  ],
  Weekly: [
    { name: 'Mon', focus: 120, tasks: 5 },
    { name: 'Tue', focus: 180, tasks: 8 },
    { name: 'Wed', focus: 90, tasks: 3 },
    { name: 'Thu', focus: 210, tasks: 10 },
    { name: 'Fri', focus: 60, tasks: 2 },
    { name: 'Sat', focus: 240, tasks: 12 },
    { name: 'Sun', focus: 150, tasks: 7 },
  ],
  Monthly: [
    { name: 'Week 1', focus: 800, tasks: 35 },
    { name: 'Week 2', focus: 950, tasks: 42 },
    { name: 'Week 3', focus: 700, tasks: 28 },
    { name: 'Week 4', focus: 1100, tasks: 50 },
  ],
  Yearly: [
    { name: 'Jan', focus: 3000, tasks: 120 },
    { name: 'Feb', focus: 3200, tasks: 130 },
    { name: 'Mar', focus: 2800, tasks: 110 },
    { name: 'Apr', focus: 4000, tasks: 160 },
    { name: 'May', focus: 3500, tasks: 140 },
    { name: 'Jun', focus: 3800, tasks: 150 },
  ]
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-zinc-800/90 backdrop-blur-md border border-zinc-700/50 p-4 rounded-xl shadow-xl">
        <p className="text-zinc-300 font-semibold mb-3">{label}</p>
        <div className="flex flex-col gap-2">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-sm text-zinc-100 font-medium">
                {entry.name === 'focus' ? 'Focus Minutes' : 'Tasks Completed'}:
              </span>
              <span className="text-sm font-bold text-white ml-auto pl-4">
                {entry.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export default function AnalyticsCharts() {
  const [timeframe, setTimeframe] = useState<TimeFrame>('Weekly');

  const data = dummyData[timeframe];

  return (
    <div className="w-full bg-zinc-950 p-6 sm:p-8 rounded-[2.5rem] shadow-2xl border border-zinc-800/50 flex flex-col">
      {/* Segmented Control */}
      <div className="flex bg-zinc-900/80 p-1 rounded-full mb-8 max-w-md mx-auto border border-zinc-800">
        {(['Daily', 'Weekly', 'Monthly', 'Yearly'] as TimeFrame[]).map((tf) => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={`flex-1 py-2 px-4 rounded-full text-sm font-semibold transition-all duration-300 ${
              timeframe === tf
                ? 'bg-zinc-700 text-white shadow-md'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="w-full h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorFocus" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorTasks" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F97316" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#F97316" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="name" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#71717A', fontSize: 12 }} 
              dy={10}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#71717A', fontSize: 12 }} 
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#3F3F46', strokeWidth: 1, strokeDasharray: '4 4' }} />
            <Area 
              type="monotone" 
              dataKey="focus" 
              stroke="#3B82F6" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorFocus)" 
              activeDot={{ r: 6, fill: '#3B82F6', stroke: '#18181b', strokeWidth: 2 }}
            />
            <Area 
              type="monotone" 
              dataKey="tasks" 
              stroke="#F97316" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorTasks)" 
              activeDot={{ r: 6, fill: '#F97316', stroke: '#18181b', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
