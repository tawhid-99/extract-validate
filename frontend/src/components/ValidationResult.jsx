import React from 'react';
import { CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';

const STATUS_STYLES = {
  PASS: {
    card: 'border-green-500/20 bg-green-500/5 hover:border-green-500/40 shadow-[0_4px_20px_-5px_rgba(34,197,94,0.05)]',
    badge: 'bg-green-500/10 border-green-500/30 text-green-400',
    text: 'text-green-400',
    icon: <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
  },
  WARN: {
    card: 'border-amber-500/20 bg-amber-500/5 hover:border-amber-500/40 shadow-[0_4px_20px_-5px_rgba(234,179,8,0.05)]',
    badge: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    text: 'text-amber-400',
    icon: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
  },
  FAIL: {
    card: 'border-rose-500/20 bg-rose-500/5 hover:border-rose-500/40 shadow-[0_4px_20px_-5px_rgba(244,63,94,0.05)]',
    badge: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
    text: 'text-rose-400',
    icon: <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
  }
};

export default function ValidationResult({ result }) {
  const { clause_id, status, category, raw_text, reason, missing } = result;
  const style = STATUS_STYLES[status] || STATUS_STYLES.WARN;

  return (
    <div className={`rounded-2xl border p-5 transition-all duration-300 backdrop-blur-md ${style.card}`}>
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {style.icon}
          <span className="font-mono text-sm font-bold text-slate-300">
            {clause_id}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold bg-slate-900/60 px-2 py-0.5 rounded border border-slate-800">
            {category}
          </span>
          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border tracking-wide ${style.badge}`}>
            {status}
          </span>
        </div>
      </div>

      {/* Clause Text */}
      <div className="mt-4 bg-slate-950/40 border border-slate-900/60 rounded-xl p-3.5">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
          Rule Condition
        </span>
        <p className="text-slate-350 text-sm leading-relaxed font-normal">
          {raw_text}
        </p>
      </div>

      {/* Analysis Result */}
      <div className="mt-3.5 flex items-start space-x-2.5">
        <div className="mt-0.5">
          <Info className={`w-4 h-4 ${style.text}`} />
        </div>
        <div>
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">
            Compliance Analysis
          </span>
          <p className="text-slate-200 text-sm font-medium leading-relaxed">
            {reason}
          </p>
        </div>
      </div>

      {/* Missing Information Block */}
      {status !== 'PASS' && missing && (
        <div className="mt-4 border-t border-slate-800/60 pt-3.5">
          <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-3">
            <span className="text-xs font-bold text-rose-400 block mb-1 uppercase tracking-wider">
              Missing Requirements:
            </span>
            <p className="text-xs text-slate-300 leading-relaxed font-normal">
              {missing}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
