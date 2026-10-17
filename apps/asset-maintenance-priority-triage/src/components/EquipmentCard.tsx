import React, { useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, Clock, HelpCircle, Layers, ShieldAlert, Thermometer, Zap } from 'lucide-react';
import { EquipmentEvaluation } from '../types/equipment';

interface EquipmentCardProps {
  evaluation: EquipmentEvaluation;
}

export const EquipmentCard: React.FC<EquipmentCardProps> = ({ evaluation }) => {
  const [expanded, setExpanded] = useState(false);
  const { record, rank, rankLabel, rankSeverity, statusSummary, missingFields, isIncomplete, needsChecking, uncertaintyReason, ruleChecks } = evaluation;

  // Visual accents based on severity
  const rankColors = {
    critical: {
      badgeBg: 'bg-red-100 text-red-900 border-red-300',
      borderAccent: 'border-red-200 hover:border-red-400',
      headerBg: 'bg-red-50/40',
      iconColor: 'text-red-700',
    },
    high: {
      badgeBg: 'bg-amber-100 text-amber-900 border-amber-300',
      borderAccent: 'border-amber-200 hover:border-amber-400',
      headerBg: 'bg-amber-50/30',
      iconColor: 'text-amber-700',
    },
    routine: {
      badgeBg: 'bg-blue-50 text-blue-900 border-blue-200',
      borderAccent: 'border-slate-200 hover:border-blue-300',
      headerBg: 'bg-blue-50/20',
      iconColor: 'text-blue-700',
    },
    nominal: {
      badgeBg: 'bg-slate-100 text-slate-800 border-slate-200',
      borderAccent: 'border-slate-200 hover:border-slate-300',
      headerBg: 'bg-slate-50/50',
      iconColor: 'text-emerald-700',
    },
    incomplete: {
      badgeBg: 'bg-purple-100 text-purple-900 border-purple-300',
      borderAccent: 'border-purple-200 hover:border-purple-400',
      headerBg: 'bg-purple-50/30',
      iconColor: 'text-purple-700',
    },
  }[rankSeverity];

  return (
    <div
      className={`bg-white rounded-lg border ${rankColors.borderAccent} transition-all duration-150 shadow-xs flex flex-col justify-between`}
    >
      <div>
        {/* Card Header */}
        <div className={`p-4 border-b border-slate-100 ${rankColors.headerBg} rounded-t-lg`}>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 font-mono">
                <span className="font-bold text-slate-900 text-sm tracking-tight">{record.tag}</span>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <span>{record.id}</span>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <span>Inspected {record.inspectionDate ?? 'N/A'}</span>
              </div>
              <h3 className="text-base font-semibold text-slate-900 leading-snug">
                {record.name}
              </h3>
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <Layers className="w-3 h-3 text-slate-400 shrink-0" />
                <span>{record.subsystem}</span>
              </p>
            </div>

            {/* Rank Identifier */}
            <div className="shrink-0 text-right">
              <span
                className={`inline-block px-2.5 py-1 text-xs font-bold border rounded ${rankColors.badgeBg} tabular-nums`}
              >
                {typeof rank === 'number' ? `Priority Rank #${rank}` : 'Rank Deferred'}
              </span>
              <div className="text-[11px] font-medium text-slate-600 mt-1">
                {rankLabel.split('–')[1]?.trim() ?? rankLabel}
              </div>
            </div>
          </div>
        </div>

        {/* Telemetry Metrics Grid */}
        <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs border-b border-slate-100 bg-white">
          {/* Vibration */}
          <div className="p-2.5 rounded bg-slate-50 border border-slate-100 space-y-1">
            <div className="text-slate-500 flex items-center justify-between">
              <span>Vibration RMS</span>
              <Zap className="w-3 h-3 text-slate-400" />
            </div>
            <div className="text-sm font-bold font-mono tabular-nums text-slate-900">
              {record.vibrationRms !== undefined ? `${record.vibrationRms.toFixed(1)} mm/s` : (
                <span className="text-purple-700 italic font-normal text-xs">Missing</span>
              )}
            </div>
            <div className="text-[10px] text-slate-400">
              {record.vibrationRms !== undefined ? (record.vibrationRms > 4.5 ? 'Critical breach' : record.vibrationRms >= 2.8 ? 'Alert zone' : 'Nominal') : 'Not recorded'}
            </div>
          </div>

          {/* Thermal Delta */}
          <div className="p-2.5 rounded bg-slate-50 border border-slate-100 space-y-1">
            <div className="text-slate-500 flex items-center justify-between">
              <span>Bearing Temp Δ</span>
              <Thermometer className="w-3 h-3 text-slate-400" />
            </div>
            <div className="text-sm font-bold font-mono tabular-nums text-slate-900">
              {record.bearingTempDelta !== undefined ? `+${record.bearingTempDelta.toFixed(1)} °C` : (
                <span className="text-purple-700 italic font-normal text-xs">Missing</span>
              )}
            </div>
            <div className="text-[10px] text-slate-400">
              {record.bearingTempDelta !== undefined ? (record.bearingTempDelta > 35 ? 'Severe heat' : record.bearingTempDelta >= 20 ? 'Elevated' : 'Nominal') : 'Not recorded'}
            </div>
          </div>

          {/* Overhaul Hours */}
          <div className="p-2.5 rounded bg-slate-50 border border-slate-100 space-y-1">
            <div className="text-slate-500 flex items-center justify-between">
              <span>Since Overhaul</span>
              <Clock className="w-3 h-3 text-slate-400" />
            </div>
            <div className="text-sm font-bold font-mono tabular-nums text-slate-900">
              {record.hoursSinceOverhaul !== undefined ? `${record.hoursSinceOverhaul.toLocaleString()} hrs` : (
                <span className="text-purple-700 italic font-normal text-xs">Missing</span>
              )}
            </div>
            <div className="text-[10px] text-slate-400">
              {record.hoursSinceOverhaul !== undefined ? (record.hoursSinceOverhaul > 8000 ? 'Overhaul due' : '< 8,000 hrs limit') : 'Not recorded'}
            </div>
          </div>

          {/* Lubricant Condition */}
          <div className="p-2.5 rounded bg-slate-50 border border-slate-100 space-y-1">
            <div className="text-slate-500 flex items-center justify-between">
              <span>Lube Condition</span>
              <ShieldAlert className="w-3 h-3 text-slate-400" />
            </div>
            <div className="text-sm font-bold truncate text-slate-900">
              {record.lubeCondition ?? (
                <span className="text-purple-700 italic font-normal text-xs">Missing</span>
              )}
            </div>
            <div className="text-[10px] text-slate-400 font-mono tabular-nums">
              {record.wearDebrisPpm !== undefined ? `${record.wearDebrisPpm} ppm debris` : 'Debris N/A'}
            </div>
          </div>
        </div>

        {/* Condition / Warning / Incomplete Indicators */}
        <div className="p-4 space-y-2.5">
          {/* Missing Fields Section (Rule: If input is incomplete, list what is missing instead of guessing) */}
          {isIncomplete && (
            <div className="rounded border border-purple-200 bg-purple-50/70 p-3 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-purple-900 mb-1">
                <AlertCircle className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                <span>Incomplete Inspection Record – Missing Telemetry:</span>
              </div>
              <p className="text-purple-800 text-[11px] mb-1.5">
                The walkdown record is missing the following parameter(s). Values are not guessed or imputed:
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-purple-950 font-medium">
                {missingFields.map((field) => (
                  <li key={field} className="font-mono text-[11px]">{field}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Uncertain Flag Section (Rule: Mark anything uncertain as "Needs checking") */}
          {needsChecking && (
            <div className="rounded border border-amber-300 bg-amber-50 p-3 text-xs">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="inline-flex items-center gap-1 font-bold text-amber-900 uppercase tracking-wider text-[11px]">
                  <HelpCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  Status: Needs checking
                </span>
                <span className="text-[10px] text-amber-700 font-medium">Manual Validation Required</span>
              </div>
              <p className="text-amber-800 text-xs leading-relaxed">
                {uncertaintyReason || 'Telemetry flag indicates sensor calibration expiration or unconfirmed sample chain.'}
              </p>
            </div>
          )}

          {/* Status summary */}
          <p className="text-xs text-slate-600 leading-relaxed">
            {statusSummary}
          </p>
        </div>
      </div>

      {/* Expandable Deterministic Rule Check Breakdown */}
      <div className="p-4 pt-0">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="w-full py-1.5 px-3 rounded border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center justify-between transition-colors"
        >
          <span>Deterministic Rule Audit ({ruleChecks.length} checks)</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {expanded && (
          <div className="mt-2.5 space-y-2 border-t border-slate-100 pt-2.5">
            {ruleChecks.map((rule) => {
              const ruleBg =
                rule.severity === 'critical'
                  ? 'bg-red-50 text-red-900 border-red-200'
                  : rule.severity === 'warning'
                  ? 'bg-amber-50 text-amber-900 border-amber-200'
                  : rule.severity === 'unknown'
                  ? 'bg-purple-50 text-purple-900 border-purple-200'
                  : 'bg-slate-50 text-slate-800 border-slate-200';

              return (
                <div key={rule.ruleId} className={`p-2 rounded border ${ruleBg} text-xs`}>
                  <div className="flex items-center justify-between gap-2 font-mono text-[11px] font-semibold">
                    <span>{rule.name}</span>
                    <span className="uppercase text-[10px] font-bold">
                      {rule.severity === 'critical' ? 'FAIL - CRITICAL' : rule.severity === 'warning' ? 'ALERT' : rule.severity === 'unknown' ? 'DATA MISSING' : 'PASS'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 font-mono mt-0.5">
                    Threshold: {rule.threshold} · Observed: {rule.observedValue}
                  </div>
                  <p className="text-[11px] text-slate-700 mt-1 leading-normal">
                    {rule.detail}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
