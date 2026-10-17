import React from 'react';
import { Database, HelpCircle, Info } from 'lucide-react';
import { FictionalDataset } from '../types/equipment';

interface DatasetControlProps {
  datasets: FictionalDataset[];
  selectedDatasetId: string;
  onSelectDataset: (id: string) => void;
  stats: {
    total: number;
    criticalCount: number;
    highCount: number;
    needsCheckingCount: number;
    incompleteCount: number;
  };
}

export const DatasetControl: React.FC<DatasetControlProps> = ({
  datasets,
  selectedDatasetId,
  onSelectDataset,
  stats,
}) => {
  const currentDataset = datasets.find((d) => d.id === selectedDatasetId) || datasets[0];

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 sm:p-5 shadow-xs">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left side: dataset switcher */}
        <div className="space-y-1.5 flex-1 max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <Database className="w-3.5 h-3.5 text-slate-600" />
            <span>Inspection Telemetry Source (Fictional Datasets)</span>
          </div>

          <div className="relative">
            <label htmlFor="dataset-select" className="sr-only">
              Select Sample Dataset
            </label>
            <select
              id="dataset-select"
              value={selectedDatasetId}
              onChange={(e) => onSelectDataset(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 hover:border-slate-400 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 rounded-md py-2 px-3 text-sm font-semibold text-slate-900 cursor-pointer transition-colors"
            >
              {datasets.map((dataset) => (
                <option key={dataset.id} value={dataset.id}>
                  {dataset.name}
                </option>
              ))}
            </select>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed pt-0.5">
            {currentDataset.description}
          </p>
        </div>

        {/* Right side: quick telemetry summary KPI chips */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
          <div className="bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-center min-w-[70px]">
            <div className="text-xs text-slate-500 font-medium">Assets</div>
            <div className="text-base font-bold text-slate-900 font-mono tabular-nums">
              {stats.total}
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded px-3 py-1.5 text-center min-w-[75px]">
            <div className="text-xs text-red-700 font-medium">Critical (R1)</div>
            <div className="text-base font-bold text-red-900 font-mono tabular-nums">
              {stats.criticalCount}
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded px-3 py-1.5 text-center min-w-[95px]">
            <div className="text-xs text-amber-800 font-medium">Needs Checking</div>
            <div className="text-base font-bold text-amber-900 font-mono tabular-nums">
              {stats.needsCheckingCount}
            </div>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded px-3 py-1.5 text-center min-w-[85px]">
            <div className="text-xs text-purple-700 font-medium">Incomplete</div>
            <div className="text-base font-bold text-purple-900 font-mono tabular-nums">
              {stats.incompleteCount}
            </div>
          </div>
        </div>
      </div>

      {/* Audit rule assurance banner */}
      <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
        <div className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>Rule checks: ISO 10816 velocity, bearing thermal delta, 8k-hr overhaul limit, lubrication analysis.</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-600">
          <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>Missing fields are strictly flagged with zero imputation.</span>
        </div>
      </div>
    </div>
  );
};
