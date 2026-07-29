"use client";

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Trophy } from 'lucide-react';

interface KnowledgeCheck {
  question: string;
  options: string[];
  correctAnswer: string;
}

interface Task {
  id: string;
  text: string;
  isCompleted: boolean;
  knowledgeCheck: KnowledgeCheck;
}

interface Phase {
  phaseTitle: string;
  tasks: Task[];
}

interface StrategyData {
  phases: Phase[];
}

interface StudyGuide {
  id: string;
  title: string;
  strategyData: StrategyData;
}

export default function StudyGuideInteractive({ initialGuide }: { initialGuide: StudyGuide }) {
  const [guide, setGuide] = useState<StudyGuide>(initialGuide);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [completedPhases, setCompletedPhases] = useState<string[]>([]);
  const [isCompletingPhase, setIsCompletingPhase] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const res = await fetch(`/api/study-guides/progress?guideId=${guide.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.completedPhases) setCompletedPhases(data.completedPhases);
        }
      } catch (err) {
        console.error("Failed to fetch progress", err);
      }
    };
    if (guide.id) fetchProgress();
  }, [guide.id]);

  const handleCompletePhase = async (phaseTitle: string) => {
    if (completedPhases.includes(phaseTitle)) return;
    
    setIsCompletingPhase(prev => ({ ...prev, [phaseTitle]: true }));
    try {
      const resProgress = await fetch('/api/study-guides/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guideId: guide.id, phaseId: phaseTitle })
      });
      
      if (!resProgress.ok) throw new Error("Failed to record progress");
      
      setCompletedPhases(prev => [...prev, phaseTitle]);
      
      fetch('/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'flashcard_review' })
      }).then(res => {
         if (res.ok) toast.success(`Phase "${phaseTitle}" Complete! +10 Focus Minutes`);
      }).catch(err => console.error("Gamification error", err));

    } catch (e) {
      toast.error("Failed to mark phase as complete.");
    } finally {
      setIsCompletingPhase(prev => ({ ...prev, [phaseTitle]: false }));
    }
  };

  // Calculate completion percentage
  let totalTasks = 0;
  let completedTasks = 0;
  
  if (guide?.strategyData?.phases) {
    guide.strategyData.phases.forEach((phase) => {
      phase.tasks.forEach((task) => {
        totalTasks++;
        if (task.isCompleted) completedTasks++;
      });
    });
  }

  const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const handleTaskClick = (taskId: string, isCompleted: boolean) => {
    if (isCompleted) return;
    setExpandedTaskId(expandedTaskId === taskId ? null : taskId);
  };

  const handleAnswerSelect = async (phaseIndex: number, taskIndex: number, task: Task, selectedOption: string) => {
    if (selectedOption !== task.knowledgeCheck.correctAnswer) {
      toast.error("Not quite! Try again.");
      return;
    }

    toast.success("Correct! Great job.");
    
    // Update local state
    const newGuide = { ...guide };
    newGuide.strategyData.phases[phaseIndex].tasks[taskIndex].isCompleted = true;
    setGuide(newGuide);
    setExpandedTaskId(null);

    // Save to database
    try {
      const res = await fetch('/api/documents/study-guide', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: guide.id,
          strategyData: newGuide.strategyData
        })
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to save progress.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to save progress. Please try again later.");
    }
  };

  const radius = 40;
  const stroke = 8;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (completionPercentage / 100) * circumference;

  if (!guide?.strategyData?.phases) {
    return <div className="text-gray-400 p-8 text-center">No strategy data available.</div>;
  }

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-8 pb-12">
      {/* Progress Header */}
      <div className="bg-[#111111] border border-gray-800 rounded-2xl p-6 flex items-center justify-between shadow-xl">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">{guide.title || 'Strategic Study Plan'}</h2>
          <p className="text-gray-400">Complete tasks and pass knowledge checks to advance.</p>
        </div>
        
        <div className="relative flex items-center justify-center w-24 h-24">
          <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
            {/* Background Ring */}
            <circle
              stroke="#27272A"
              fill="transparent"
              strokeWidth={stroke}
              r={normalizedRadius}
              cx={radius}
              cy={radius}
            />
            {/* Progress Ring */}
            <circle
              stroke="#EA580C"
              fill="transparent"
              strokeWidth={stroke}
              strokeDasharray={circumference + ' ' + circumference}
              style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.5s ease-in-out' }}
              strokeLinecap="round"
              r={normalizedRadius}
              cx={radius}
              cy={radius}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold text-white">{completionPercentage}%</span>
          </div>
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-8">
        {guide.strategyData.phases.map((phase, pIndex) => {
          const isPhaseCompleted = completedPhases.includes(phase.phaseTitle);
          return (
          <div key={pIndex} className="space-y-4 relative">
            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
              <h3 className="text-xl font-semibold text-gray-200 flex items-center gap-2">
                {isPhaseCompleted && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                {phase.phaseTitle}
              </h3>
              {!isPhaseCompleted && (
                <button 
                  onClick={() => handleCompletePhase(phase.phaseTitle)}
                  disabled={isCompletingPhase[phase.phaseTitle]}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-orange-600/20 text-orange-500 hover:bg-orange-600/30 rounded-lg transition-colors disabled:opacity-50"
                >
                  <Trophy className="w-3.5 h-3.5" />
                  {isCompletingPhase[phase.phaseTitle] ? 'Saving...' : 'Mark Phase Complete'}
                </button>
              )}
            </div>
            
            <div className="space-y-3">
              {phase.tasks.map((task, tIndex) => {
                const isExpanded = expandedTaskId === task.id;
                
                return (
                  <div 
                    key={task.id} 
                    className={`bg-gray-900 border rounded-xl overflow-hidden transition-all duration-300 ${
                      task.isCompleted 
                        ? 'border-gray-800 opacity-60' 
                        : isExpanded 
                          ? 'border-[#EA580C] shadow-[0_0_15px_rgba(234,88,12,0.15)]' 
                          : 'border-gray-700 hover:border-gray-600 cursor-pointer'
                    }`}
                  >
                    {/* Task Row */}
                    <div 
                      onClick={() => handleTaskClick(task.id, task.isCompleted)}
                      className="p-4 flex items-center gap-4"
                    >
                      <div className="flex-shrink-0">
                        {task.isCompleted ? (
                          <CheckCircle2 className="w-6 h-6 text-[#EA580C]" />
                        ) : (
                          <Circle className="w-6 h-6 text-gray-500" />
                        )}
                      </div>
                      <div className={`flex-1 font-medium transition-colors duration-300 ${task.isCompleted ? 'text-slate-500 line-through' : 'text-gray-200'}`}>
                        {task.text}
                      </div>
                      {!task.isCompleted && (
                        <div className="text-gray-500">
                          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </div>
                      )}
                    </div>

                    {/* Knowledge Check Expansion */}
                    {!task.isCompleted && isExpanded && (
                      <div className="p-4 pt-0 bg-gray-900 border-t border-gray-800/50">
                        <div className="mt-4 mb-4">
                          <p className="text-sm font-semibold text-blue-400 mb-3 uppercase tracking-wider">Knowledge Check</p>
                          <p className="text-gray-200">{task.knowledgeCheck.question}</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {task.knowledgeCheck.options.map((option, oIndex) => (
                            <button
                              key={oIndex}
                              onClick={() => handleAnswerSelect(pIndex, tIndex, task, option)}
                              className="text-left p-3 rounded-lg border border-gray-700 bg-gray-800 hover:bg-gray-700 hover:border-gray-500 text-gray-300 text-sm transition-all"
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )})}
      </div>
    </div>
  );
}
