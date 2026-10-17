export type LubricantStatus = 'Nominal' | 'Degraded' | 'Severe Contamination' | 'Unverified Sample';

export interface EquipmentRecord {
  id: string;
  tag: string;
  name: string;
  subsystem: string;
  // Metrics can be undefined/null to represent missing field inspection logs
  operatingHours?: number;
  hoursSinceOverhaul?: number;
  vibrationRms?: number; // mm/s
  bearingTempDelta?: number; // °C above ambient
  lubeCondition?: LubricantStatus;
  wearDebrisPpm?: number;
  isTelemetryUncertain?: boolean;
  uncertaintyReason?: string;
  inspectionDate?: string;
  inspectorId?: string;
}

export type PriorityRank = 1 | 2 | 3 | 4 | 'Incomplete';

export interface RuleCheckResult {
  ruleId: string;
  name: string;
  threshold: string;
  observedValue: string;
  triggered: boolean;
  severity: 'critical' | 'warning' | 'nominal' | 'unknown';
  detail: string;
}

export interface EquipmentEvaluation {
  record: EquipmentRecord;
  rank: PriorityRank;
  rankLabel: string;
  rankSeverity: 'critical' | 'high' | 'routine' | 'nominal' | 'incomplete';
  statusSummary: string;
  missingFields: string[];
  isIncomplete: boolean;
  needsChecking: boolean;
  uncertaintyReason?: string;
  ruleChecks: RuleCheckResult[];
}

export interface FictionalDataset {
  id: string;
  name: string;
  shortLabel: string;
  description: string;
  records: EquipmentRecord[];
}
