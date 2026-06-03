import React from 'react';
import { Check, Loader, Loader2, AlertCircle } from 'lucide-react';

const STEPS = [
  { id: 'parsing', label: 'Parse Text' },
  { id: 'chunking', label: 'Chunking' },
  { id: 'extracting', label: 'Extract Clauses' },
  { id: 'classifying', label: 'Classify' },
  { id: 'saving', label: 'Save Output' }
];

export default function ProgressStepper({ currentStep, progressValue, message }) {
  const getStepIndex = (stepId) => {
    return STEPS.findIndex(s => s.id === stepId);
  };

  const activeIndex = getStepIndex(currentStep);
  const isFailed = currentStep === 'failed';
  const isCompleted = currentStep === 'completed';

  return (
    <div className="w-full glass-panel rounded-2xl p-6 border border-slate-800">
      {/* Progress Value Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          {isFailed ? (
            <AlertCircle className="w-5 h-5 text-red-500 animate-pulse" />
          ) : isCompleted ? (
            <Check className="w-5 h-5 text-green-500" />
          ) : (
            <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
          )}
          <span className="font-semibold text-slate-200">
            {isFailed ? 'Processing Failed' : isCompleted ? 'Completed' : 'Processing Document'}
          </span>
        </div>
        <span className="text-sm font-semibold text-slate-400 bg-slate-900 px-2.5 py-1 rounded-full border border-slate-800">
          {progressValue}%
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden mb-6 border border-slate-800">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isFailed ? 'bg-red-500' : isCompleted ? 'bg-green-500' : 'bg-gradient-to-r from-blue-500 to-purple-500'
          }`}
          style={{ width: `${progressValue}%` }}
        />
      </div>

      {/* Steps List */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {STEPS.map((step, idx) => {
          const isDone = isCompleted || (!isFailed && activeIndex > idx);
          const isActive = !isCompleted && !isFailed && activeIndex === idx;
          
          return (
            <div key={step.id} className="flex flex-col items-center md:items-start text-center md:text-left">
              <div className="flex items-center space-x-2">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                    isDone 
                      ? 'bg-green-500/20 border border-green-500 text-green-400' 
                      : isActive 
                        ? 'bg-purple-500/20 border border-purple-500 text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.4)] animate-pulse' 
                        : 'bg-slate-900 border border-slate-800 text-slate-500'
                  }`}
                >
                  {isDone ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                </div>
                <span
                  className={`text-xs font-semibold ${
                    isActive ? 'text-purple-400 font-bold' : isDone ? 'text-green-400' : 'text-slate-500'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail message logs */}
      {message && (
        <div className="mt-5 p-3 bg-slate-900/60 border border-slate-850 rounded-xl text-xs font-mono text-slate-400 flex items-center justify-between">
          <span className="truncate">{message}</span>
          {!isFailed && !isCompleted && <span className="text-purple-400 text-[10px] uppercase font-bold animate-pulse">Running</span>}
        </div>
      )}
    </div>
  );
}
