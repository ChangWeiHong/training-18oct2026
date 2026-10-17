import React, { useState } from 'react';
import { ArrowUpDown, HelpCircle, AlertCircle, Search, Filter } from 'lucide-react';
import { EquipmentEvaluation } from '../types/equipment';

interface EquipmentTableProps {
  evaluations: EquipmentEvaluation[];
}

type SortField = 'rank' | 'tag' | 'vibration' | 'temp' | 'hours';
type SortDirection = 'asc' | 'desc';

export const EquipmentTable: React.FC<EquipmentTableProps> = ({ evaluations }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'critical' | 'needs_checking' | 'incomplete'>('all');
  const [sortField, setSortField] = useState<SortField>('rank');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filter evaluations
  const filtered = evaluations.filter((item) => {
    // Search filter
    const matchesSearch =
      item.record.tag.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.record.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.record.subsystem.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    // Category filter
    if (filterMode === 'critical') {
      return item.rank === 1;
    }
    if (filterMode === 'needs_checking') {
      return item.needsChecking;
    }
    if (filterMode === 'incomplete') {
      return item.isIncomplete;
    }

    return true;
  });

  // Sort evaluations
  const sorted = [...filtered].sort((a, b) => {
    let comparison = 0;

    switch (sortField) {
      case 'rank': {
        const rankWeight = (r: typeof a.rank) => (r === 'Incomplete' ? 2.5 : Number(r));
        comparison = rankWeight(a.rank) - rankWeight(b.rank);
        break;
      }
      case 'tag':
        comparison = a.record.tag.localeCompare(b.record.tag);
        break;
      case 'vibration': {
        const valA = a.record.vibrationRms ?? -999;
        const valB = b.record.vibrationRms ?? -999;
        comparison = valA - valB;
        break;
      }
      case 'temp': {
        const valA = a.record.bearingTempDelta ?? -999;
        const valB = b.record.bearingTempDelta ?? -999;
        comparison = valA - valB;
        break;
      }
      case 'hours': {
        const valA = a.record.hoursSinceOverhaul ?? -999;
        const valB = b.record.hoursSinceOverhaul ?? -999;
        comparison = valA - valB;
        break;
      }
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
      {/* Table Controls Bar */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by tag, equipment name, or subsystem..."
            className="w-full bg-white border border-slate-300 rounded-md pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-800"
          />
        </div>

        {/* Filter Segmented Control */}
        <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-md text-xs">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-2.5 py-1 rounded font-medium transition-colors ${
              filterMode === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Items ({evaluations.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('critical')}
            className={`px-2.5 py-1 rounded font-medium transition-colors ${
              filterMode === 'critical'
                ? 'bg-white text-red-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Critical (Rank 1)
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('needs_checking')}
            className={`px-2.5 py-1 rounded font-medium transition-colors ${
              filterMode === 'needs_checking'
                ? 'bg-white text-amber-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Needs Checking
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('incomplete')}
            className={`px-2.5 py-1 rounded font-medium transition-colors ${
              filterMode === 'incomplete'
                ? 'bg-white text-purple-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Incomplete Data
          </button>
        </div>
      </div>

      {/* Responsive Table Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-700 font-semibold">
              <th className="py-3 px-4 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => handleSort('rank')}
                  className="flex items-center gap-1.5 hover:text-slate-900 cursor-pointer"
                >
                  <span>Priority Rank</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </button>
              </th>
              <th className="py-3 px-4 min-w-[200px]">
                <button
                  type="button"
                  onClick={() => handleSort('tag')}
                  className="flex items-center gap-1.5 hover:text-slate-900 cursor-pointer"
                >
                  <span>Equipment Tag & Name</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </button>
              </th>
              <th className="py-3 px-4 whitespace-nowrap">Subsystem Area</th>
              <th className="py-3 px-4 text-right whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => handleSort('vibration')}
                  className="inline-flex items-center gap-1.5 hover:text-slate-900 cursor-pointer ml-auto"
                >
                  <span>Vibration (RMS)</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </button>
              </th>
              <th className="py-3 px-4 text-right whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => handleSort('temp')}
                  className="inline-flex items-center gap-1.5 hover:text-slate-900 cursor-pointer ml-auto"
                >
                  <span>Bearing ΔT</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </button>
              </th>
              <th className="py-3 px-4 text-right whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => handleSort('hours')}
                  className="inline-flex items-center gap-1.5 hover:text-slate-900 cursor-pointer ml-auto"
                >
                  <span>Overhaul Hours</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </button>
              </th>
              <th className="py-3 px-4 whitespace-nowrap">Lubricant</th>
              <th className="py-3 px-4 min-w-[190px]">Certainty & Completeness</th>
              <th className="py-3 px-4 min-w-[220px]">Rule-Based Check Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-500">
                  No equipment records match the current filter or search criteria.
                </td>
              </tr>
            ) : (
              sorted.map((item) => {
                const { record, rank, rankSeverity, needsChecking, isIncomplete, missingFields, uncertaintyReason } = item;

                // Rank column styling
                const rankBadgeClass = {
                  critical: 'bg-red-100 text-red-900 border-red-300 font-bold',
                  high: 'bg-amber-100 text-amber-900 border-amber-300 font-bold',
                  routine: 'bg-blue-50 text-blue-900 border-blue-200 font-semibold',
                  nominal: 'bg-slate-100 text-slate-800 border-slate-200 font-semibold',
                  incomplete: 'bg-purple-100 text-purple-900 border-purple-300 font-bold',
                }[rankSeverity];

                return (
                  <tr
                    key={record.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    {/* Rank */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 text-xs rounded border ${rankBadgeClass} font-mono tabular-nums`}>
                        {typeof rank === 'number' ? `Rank #${rank}` : 'Deferred'}
                      </span>
                    </td>

                    {/* Equipment Tag & Name */}
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-slate-900">{record.tag}</div>
                      <div className="text-slate-700 font-medium truncate max-w-[220px]">{record.name}</div>
                    </td>

                    {/* Subsystem Area */}
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {record.subsystem}
                    </td>

                    {/* Vibration */}
                    <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                      {record.vibrationRms !== undefined ? (
                        <span className={record.vibrationRms > 4.5 ? 'text-red-700 font-bold' : record.vibrationRms >= 2.8 ? 'text-amber-700 font-semibold' : 'text-slate-900'}>
                          {record.vibrationRms.toFixed(1)} mm/s
                        </span>
                      ) : (
                        <span className="text-purple-700 italic text-[11px]">Missing</span>
                      )}
                    </td>

                    {/* Bearing Temp Delta */}
                    <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                      {record.bearingTempDelta !== undefined ? (
                        <span className={record.bearingTempDelta > 35 ? 'text-red-700 font-bold' : record.bearingTempDelta >= 20 ? 'text-amber-700 font-semibold' : 'text-slate-900'}>
                          +{record.bearingTempDelta.toFixed(1)} °C
                        </span>
                      ) : (
                        <span className="text-purple-700 italic text-[11px]">Missing</span>
                      )}
                    </td>

                    {/* Overhaul Hours */}
                    <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                      {record.hoursSinceOverhaul !== undefined ? (
                        <span className={record.hoursSinceOverhaul > 8000 ? 'text-amber-800 font-semibold' : 'text-slate-700'}>
                          {record.hoursSinceOverhaul.toLocaleString()} hrs
                        </span>
                      ) : (
                        <span className="text-purple-700 italic text-[11px]">Missing</span>
                      )}
                    </td>

                    {/* Lubricant Condition */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {record.lubeCondition ? (
                        <span className={record.lubeCondition === 'Severe Contamination' ? 'text-red-700 font-bold' : record.lubeCondition === 'Degraded' ? 'text-amber-700 font-medium' : record.lubeCondition === 'Unverified Sample' ? 'text-amber-800 italic' : 'text-slate-700'}>
                          {record.lubeCondition}
                        </span>
                      ) : (
                        <span className="text-purple-700 italic text-[11px]">Missing</span>
                      )}
                    </td>

                    {/* Certainty & Missing Fields */}
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        {/* Needs checking mark */}
                        {needsChecking && (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 border border-amber-300 text-amber-900 text-[11px] font-semibold">
                            <HelpCircle className="w-3 h-3 text-amber-700 shrink-0" />
                            <span>Needs checking</span>
                          </div>
                        )}

                        {/* Incomplete missing fields list */}
                        {isIncomplete ? (
                          <div className="text-[11px] text-purple-900 bg-purple-50/70 border border-purple-200 rounded px-2 py-1">
                            <div className="font-semibold text-purple-950 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 text-purple-700 shrink-0" />
                              <span>Missing Data ({missingFields.length}):</span>
                            </div>
                            <div className="text-[10px] text-purple-800 font-mono mt-0.5">
                              {missingFields.join(', ')}
                            </div>
                          </div>
                        ) : (
                          !needsChecking && (
                            <span className="text-slate-500 text-[11px]">Verified complete</span>
                          )
                        )}

                        {needsChecking && uncertaintyReason && (
                          <div className="text-[10px] text-amber-800 leading-tight">
                            {uncertaintyReason}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Rule Check Status */}
                    <td className="py-3 px-4 text-slate-700">
                      <div className="text-[11px] leading-snug">
                        {item.statusSummary}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
        <div>
          Showing {sorted.length} of {evaluations.length} equipment entries · Evaluated deterministically
        </div>
        <div className="text-slate-500 font-mono">
          Thresholds: ISO 10816 (4.5 mm/s) · ΔT (35 °C) · Lifecycle (8k hrs)
        </div>
      </div>
    </div>
  );
};
