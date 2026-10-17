/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { LayoutGrid, Table, Layers, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { SAMPLE_DATASETS } from './data/sampleDatasets';
import { evaluateAndRankDataset } from './utils/rulesEngine';
import { HeaderBanner } from './components/HeaderBanner';
import { DatasetControl } from './components/DatasetControl';
import { EquipmentCard } from './components/EquipmentCard';
import { EquipmentTable } from './components/EquipmentTable';

export default function App() {
  // 1. Initial State: Load the first fictional dataset when page opens
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>(SAMPLE_DATASETS[0].id);
  const [viewMode, setViewMode] = useState<'both' | 'cards' | 'table'>('both');

  // 2. Retrieve active dataset
  const currentDataset = useMemo(() => {
    return SAMPLE_DATASETS.find((d) => d.id === selectedDatasetId) || SAMPLE_DATASETS[0];
  }, [selectedDatasetId]);

  // 3. Deterministic rule-based evaluation and priority ranking
  const rankedEvaluations = useMemo(() => {
    return evaluateAndRankDataset(currentDataset.records);
  }, [currentDataset]);

  // 4. Calculate operational summary statistics
  const stats = useMemo(() => {
    const total = rankedEvaluations.length;
    const criticalCount = rankedEvaluations.filter((e) => e.rank === 1).length;
    const highCount = rankedEvaluations.filter((e) => e.rank === 2).length;
    const needsCheckingCount = rankedEvaluations.filter((e) => e.needsChecking).length;
    const incompleteCount = rankedEvaluations.filter((e) => e.isIncomplete).length;

    return {
      total,
      criticalCount,
      highCount,
      needsCheckingCount,
      incompleteCount,
    };
  }, [rankedEvaluations]);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-900">
      {/* 1. Header with Top Bar Contract, Prototype Label & Mandatory Engineer Review Notice */}
      <HeaderBanner />

      {/* 2. Main One-Screen Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Dataset Switcher & Telemetry Scope */}
        <DatasetControl
          datasets={SAMPLE_DATASETS}
          selectedDatasetId={selectedDatasetId}
          onSelectDataset={setSelectedDatasetId}
          stats={stats}
        />

        {/* View Mode & Priority Summary Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 sm:px-4 rounded-lg border border-slate-200">
          <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
            <span className="font-semibold text-slate-900">Evaluation Engine:</span>
            <span>Deterministic ISO 10816 & OEM Thresholds</span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span>Zero Imputation</span>
          </div>

          {/* View Switcher: Both, Cards, Table */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md text-xs">
            <button
              type="button"
              onClick={() => setViewMode('both')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-medium transition-colors cursor-pointer ${
                viewMode === 'both'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <span>Cards & Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-medium transition-colors cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 text-slate-500" />
              <span>Cards Only</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-medium transition-colors cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Table className="w-3.5 h-3.5 text-slate-500" />
              <span>Table Only</span>
            </button>
          </div>
        </div>

        {/* 3. Cards Section */}
        {(viewMode === 'both' || viewMode === 'cards') && (
          <section aria-labelledby="cards-heading" className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 id="cards-heading" className="text-base font-bold text-slate-900">
                  Equipment Priority Cards
                </h2>
                <p className="text-xs text-slate-500">
                  Ranked by rule-based severity. Incomplete records display missing fields; unconfirmed sensors marked "Needs checking".
                </p>
              </div>
              <span className="text-xs font-mono text-slate-500 tabular-nums">
                {rankedEvaluations.length} assets evaluated
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rankedEvaluations.map((evaluation) => (
                <EquipmentCard key={evaluation.record.id} evaluation={evaluation} />
              ))}
            </div>
          </section>
        )}

        {/* 4. Table Section */}
        {(viewMode === 'both' || viewMode === 'table') && (
          <section aria-labelledby="table-heading" className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 id="table-heading" className="text-base font-bold text-slate-900">
                  Comprehensive Telemetry & Triage Table
                </h2>
                <p className="text-xs text-slate-500">
                  Sortable inspection records. Explicit zero-imputation policy for missing data and uncalibrated sensors.
                </p>
              </div>
            </div>

            <EquipmentTable evaluations={rankedEvaluations} />
          </section>
        )}

        {/* Bottom Review Protocol Reminder */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-xs text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start sm:items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-slate-700 shrink-0 mt-0.5 sm:mt-0" />
            <span>
              <strong>Review Protocol:</strong> A certified maintenance engineer must review this before scheduling equipment downtime or dispatching technicians.
            </span>
          </div>
          <div className="text-slate-400 font-mono text-[11px] shrink-0">
            Rule-Based Evaluation · Prototype – sample data only
          </div>
        </div>
      </main>
    </div>
  );
}
