import React from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

export const HeaderBanner: React.FC = () => {
  return (
    <header className="border-b border-slate-200 bg-white">
      {/* Top Bar Contract: 3 clean zones */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-slate-900 text-white flex items-center justify-center font-bold text-sm tracking-wider">
            ACT
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 leading-tight">
              Asset Maintenance Priority Triage
            </h1>
            <p className="text-xs text-slate-500">
              Deterministic rule-based equipment evaluation & intervention ranking
            </p>
          </div>
        </div>

        {/* Zone 2: Navigation / Scope Indicators */}
        <div className="text-xs text-slate-500 hidden md:flex items-center gap-2">
          <span>Mechanical Reliability</span>
          <span aria-hidden="true">·</span>
          <span>ISO 10816 Telemetry</span>
          <span aria-hidden="true">·</span>
          <span>Zero Imputation</span>
        </div>

        {/* Zone 3: Mandatory Prototype Label */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold tracking-wide uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600" aria-hidden="true" />
            Prototype – sample data only
          </span>
        </div>
      </div>

      {/* Mandatory Regulatory & Review Banner */}
      <div className="bg-slate-900 text-slate-100 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-medium">
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong className="text-white font-semibold">Mandatory Protocol:</strong> A certified maintenance engineer must review this before scheduling equipment downtime or dispatching technicians.
            </span>
          </div>
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-400 shrink-0">
            <AlertTriangle className="w-3.5 h-3.5 text-slate-400" />
            <span>Rule-based checks only · No statistical estimates</span>
          </div>
        </div>
      </div>
    </header>
  );
};
