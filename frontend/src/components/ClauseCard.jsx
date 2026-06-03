import React from 'react';
import { Bookmark, HelpCircle } from 'lucide-react';

const CATEGORY_STYLES = {
  Financial: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400' },
  Compliance: { bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', text: 'text-indigo-400' },
  Operational: { bg: 'bg-sky-500/10', border: 'border-sky-500/20', text: 'text-sky-400' },
  Legal: { bg: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-400' },
  Documentation: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400' },
  Technical: { bg: 'bg-teal-500/10', border: 'border-teal-500/20', text: 'text-teal-400' }
};

export default function ClauseCard({ clause }) {
  const { clause_id, category, confidence, raw_text, source_hint, reasoning } = clause;
  const style = CATEGORY_STYLES[category] || { bg: 'bg-slate-500/10', border: 'border-slate-500/20', text: 'text-slate-400' };

  return (
    <div className="rounded-2xl border p-5 glass-panel glass-panel-hover flex flex-col justify-between h-full space-y-4">
      <div>
        {/* Card Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2">
            <Bookmark className={`w-4 h-4 ${style.text}`} />
            <span className="font-mono text-sm font-semibold text-slate-350">
              {clause_id}
            </span>
          </div>
          <span className={`text-[11px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-full border ${style.bg} ${style.border} ${style.text}`}>
            {category}
          </span>
        </div>

        {/* Rule Text */}
        <div className="mt-3.5">
          <p className="text-slate-200 text-sm leading-relaxed font-normal line-clamp-4 hover:line-clamp-none transition-all duration-300">
            {raw_text}
          </p>
        </div>
      </div>

      {/* Footer Metrics */}
      <div className="border-t border-slate-800/60 pt-3 flex flex-col space-y-2 mt-auto">
        {/* Source Hint */}
        {source_hint && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Source hint:</span>
            <span className="text-slate-400 font-medium truncate max-w-[200px]" title={source_hint}>
              {source_hint}
            </span>
          </div>
        )}

        {/* Confidence */}
        <div className="flex flex-col space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Classification Confidence:</span>
            <span className={`font-semibold ${style.text}`}>
              {(confidence * 100).toFixed(0)}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-850">
            <div 
              className={`h-full rounded-full ${
                confidence >= 0.8 ? 'bg-green-500' : confidence >= 0.5 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${confidence * 100}%` }}
            />
          </div>
        </div>

        {/* Reasoning */}
        {reasoning && (
          <div className="text-[11px] text-slate-500 italic bg-slate-900/40 p-2 rounded-lg border border-slate-850/60 mt-1">
            <span className="font-semibold text-slate-400 not-italic">Reason: </span>
            {reasoning}
          </div>
        )}
      </div>
    </div>
  );
}
