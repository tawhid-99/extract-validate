import React from 'react';
import { ShieldCheck, AlertTriangle, XCircle, Download, FileText, Info } from 'lucide-react';

const PARAMETER_MAPPING = {
  'Financial': 'Transaction Value ($), Payment Method',
  'Compliance': 'Certifications Held, Product Category',
  'Legal': 'Origin Country, Sanctions Status',
  'Technical': 'Product Category, Certifications Held',
  'Operational': 'Trade Type, Lead Time Available (Days)',
  'Documentation': 'Certifications Held, Payment Method'
};

export default function VerdictBanner({ 
  verdict, 
  score, 
  passed = 0, 
  warnings = 0, 
  failed = 0, 
  total = 0, 
  results = [], 
  onDownload 
}) {
  const currentVerdict = verdict?.toUpperCase() || 'NOT ELIGIBLE';

  if (currentVerdict === 'ELIGIBLE') {
    return (
      <div className="space-y-4">
        {/* Full Green Banner */}
        <div className="w-full rounded-2xl border border-green-500/30 bg-gradient-to-r from-green-500/10 via-emerald-500/5 to-slate-900 p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl backdrop-blur-md">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-slate-950/85 rounded-2xl border border-green-500/20">
              <ShieldCheck className="w-10 h-10 text-green-400 shrink-0" />
            </div>
            <div className="text-center md:text-left">
              <span className="text-[10px] font-bold text-green-400/80 uppercase tracking-widest block mb-0.5">
                Compliance Verdict
              </span>
              <h2 className="text-2xl font-extrabold tracking-tight text-green-400">
                ELIGIBLE — Meets all {total} required clauses
              </h2>
              <p className="text-sm text-slate-400 mt-1 max-w-xl font-normal leading-relaxed">
                The client requirements satisfy all compliance standards. Approval recommended.
              </p>
            </div>
          </div>

          <div className="flex flex-col items-center md:items-end justify-center gap-3 shrink-0">
            {/* Compliance Score as Secondary Info */}
            <div className="flex items-center space-x-2 bg-slate-950/50 border border-slate-800 px-4 py-1.5 rounded-xl">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Score:</span>
              <span className="text-sm font-bold text-green-400">{score}/100</span>
            </div>

            {onDownload && (
              <button
                onClick={onDownload}
                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-sm font-bold text-white shadow-lg shadow-green-950/30 transition transform hover:-translate-y-0.5 duration-150"
              >
                <Download className="w-4 h-4" />
                <span>Download Approval Report</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (currentVerdict === 'CONDITIONALLY ELIGIBLE') {
    const warnClauses = results.filter(r => r.status === 'WARN');

    return (
      <div className="space-y-4">
        {/* Full Yellow/Amber Banner */}
        <div className="w-full rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-slate-900 p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl backdrop-blur-md">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-slate-950/85 rounded-2xl border border-amber-500/20">
              <AlertTriangle className="w-10 h-10 text-amber-400 shrink-0" />
            </div>
            <div className="text-center md:text-left">
              <span className="text-[10px] font-bold text-amber-400/80 uppercase tracking-widest block mb-0.5">
                Compliance Verdict
              </span>
              <h2 className="text-2xl font-extrabold tracking-tight text-amber-400">
                CONDITIONALLY ELIGIBLE — {warnings} clause(s) require clarification
              </h2>
              <p className="text-sm text-slate-400 mt-1 max-w-xl font-normal leading-relaxed">
                Meets most clauses, but some details need clarification or additional documentation before clearance.
              </p>
            </div>
          </div>

          <div className="flex flex-col items-center md:items-end justify-center gap-3 shrink-0">
            <div className="flex items-center space-x-2 bg-slate-950/50 border border-slate-800 px-4 py-1.5 rounded-xl">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Score:</span>
              <span className="text-sm font-bold text-amber-400">{score}/100</span>
            </div>

            {onDownload && (
              <button
                onClick={onDownload}
                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-550 hover:to-yellow-550 text-sm font-bold text-white shadow-lg shadow-amber-950/30 transition transform hover:-translate-y-0.5 duration-150"
              >
                <Download className="w-4 h-4" />
                <span>Download Conditional Report</span>
              </button>
            )}
          </div>
        </div>

        {/* Warning Logs List */}
        {warnClauses.length > 0 && (
          <div className="bg-slate-950/40 border border-amber-500/20 rounded-2xl p-5 space-y-3">
            <h4 className="text-sm font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-2">
              <Info className="w-4 h-4" />
              <span>Pending Clarification Items</span>
            </h4>
            <div className="divide-y divide-slate-850">
              {warnClauses.map((c, idx) => (
                <div key={c.clause_id} className="py-3 first:pt-0 last:pb-0 flex flex-col md:flex-row justify-between gap-3 text-sm">
                  <div className="space-y-1">
                    <span className="font-mono font-bold text-slate-350 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-xs mr-2">
                      {c.clause_id}
                    </span>
                    <span className="text-slate-300 font-medium">
                      {c.raw_text || c.clause_text}
                    </span>
                  </div>
                  <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl px-3 py-2 text-xs text-amber-300 self-start md:self-center">
                    <span className="font-bold block uppercase tracking-wide text-[10px] text-amber-400/80 mb-0.5">Missing:</span>
                    {c.missing || 'Clarification needed'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // default to NOT ELIGIBLE
  const failClauses = results.filter(r => r.status === 'FAIL');

  return (
    <div className="space-y-4">
      {/* Full Red Banner */}
      <div className="w-full rounded-2xl border border-rose-500/30 bg-gradient-to-r from-rose-500/10 via-red-500/5 to-slate-900 p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl backdrop-blur-md">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-slate-950/85 rounded-2xl border border-rose-500/20">
            <XCircle className="w-10 h-10 text-rose-450 shrink-0" />
          </div>
          <div className="text-center md:text-left">
            <span className="text-[10px] font-bold text-rose-450 uppercase tracking-widest block mb-0.5">
              Compliance Verdict
            </span>
            <h2 className="text-2xl font-extrabold tracking-tight text-rose-450">
              NOT ELIGIBLE — Failed {failed} clause(s)
            </h2>
            <p className="text-sm text-slate-400 mt-1 max-w-xl font-normal leading-relaxed">
              One or more required compliance clauses failed. Transaction clearance denied.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center md:items-end justify-center gap-3 shrink-0">
          <div className="flex items-center space-x-2 bg-slate-950/50 border border-slate-800 px-4 py-1.5 rounded-xl">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Score:</span>
            <span className="text-sm font-bold text-rose-405">{score}/100</span>
          </div>

          {onDownload && (
            <button
              onClick={onDownload}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-650 hover:from-rose-550 hover:to-red-550 text-sm font-bold text-white shadow-lg shadow-rose-950/30 transition transform hover:-translate-y-0.5 duration-150"
            >
              <Download className="w-4 h-4" />
              <span>Download Rejection Report</span>
            </button>
          )}
        </div>
      </div>

      {/* Red Cards for Failed Clauses */}
      {failClauses.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-sm font-extrabold text-rose-450 uppercase tracking-wider flex items-center gap-2 px-1">
            <XCircle className="w-4 h-4 text-rose-450" />
            <span>Blocking Failure Details</span>
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {failClauses.map((c) => (
              <div 
                key={c.clause_id} 
                className="bg-slate-950/40 border border-rose-500/20 hover:border-rose-500/40 shadow-[0_4px_25px_rgba(244,63,94,0.05)] rounded-2xl p-5 space-y-3.5 transition duration-300"
              >
                {/* Header */}
                <div className="flex justify-between items-start gap-2 border-b border-slate-900 pb-2">
                  <div>
                    <span className="font-mono text-xs font-extrabold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded mr-2">
                      {c.clause_id}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      {c.category}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold bg-slate-900/60 border border-slate-850 px-2 py-0.5 rounded">
                    Relates to: <strong className="text-slate-200">{PARAMETER_MAPPING[c.category] || 'General Config'}</strong>
                  </span>
                </div>

                {/* Clause Rule */}
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">
                    Clause Rule Text
                  </span>
                  <p className="text-slate-350 text-xs font-normal leading-relaxed">
                    {c.raw_text || c.clause_text}
                  </p>
                </div>

                {/* Analysis */}
                <div className="space-y-1">
                  <span className="text-[10px] text-rose-400/80 uppercase font-bold tracking-wide">
                    Why it failed
                  </span>
                  <p className="text-slate-200 text-xs font-medium leading-relaxed">
                    {c.reason}
                  </p>
                </div>

                {/* Missing Details */}
                <div className="bg-rose-500/5 border border-rose-500/10 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-rose-400 block mb-0.5 uppercase tracking-wider">
                    What is missing
                  </span>
                  <p className="text-xs text-slate-200 leading-relaxed font-semibold">
                    {c.missing || 'Critical requirement criteria'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
