import { EquipmentEvaluation, EquipmentRecord, PriorityRank, RuleCheckResult } from '../types/equipment';

export const FIELD_LABELS: Record<string, string> = {
  operatingHours: 'Total Operating Hours',
  hoursSinceOverhaul: 'Hours Since Last Overhaul',
  vibrationRms: 'Vibration RMS (mm/s)',
  bearingTempDelta: 'Bearing Temperature Delta (°C)',
  lubeCondition: 'Lubricant Condition Sample',
  wearDebrisPpm: 'Wear Debris Index (ppm)',
};

/**
 * Deterministic rule-based evaluation engine.
 * Computes deterministic machine condition thresholds strictly based on verified inspection records.
 * Does NOT generate predictions, probabilistic scores, or AI estimations.
 * Never guesses or imputes values for missing parameters.
 */
export function evaluateEquipmentRecord(record: EquipmentRecord): EquipmentEvaluation {
  const missingFields: string[] = [];

  // 1. Audit missing inspection fields
  if (record.operatingHours === undefined || record.operatingHours === null) {
    missingFields.push(FIELD_LABELS.operatingHours);
  }
  if (record.hoursSinceOverhaul === undefined || record.hoursSinceOverhaul === null) {
    missingFields.push(FIELD_LABELS.hoursSinceOverhaul);
  }
  if (record.vibrationRms === undefined || record.vibrationRms === null) {
    missingFields.push(FIELD_LABELS.vibrationRms);
  }
  if (record.bearingTempDelta === undefined || record.bearingTempDelta === null) {
    missingFields.push(FIELD_LABELS.bearingTempDelta);
  }
  if (!record.lubeCondition) {
    missingFields.push(FIELD_LABELS.lubeCondition);
  }
  if (record.wearDebrisPpm === undefined || record.wearDebrisPpm === null) {
    missingFields.push(FIELD_LABELS.wearDebrisPpm);
  }

  const isIncomplete = missingFields.length > 0;

  // 2. Telemetry certainty check
  const isSampleUnverified = record.lubeCondition === 'Unverified Sample';
  const needsChecking = Boolean(record.isTelemetryUncertain || isSampleUnverified);
  const uncertaintyReason = record.uncertaintyReason || 
    (isSampleUnverified ? 'Lubricant sample pending laboratory validation / chain of custody confirmation.' : undefined);

  // 3. Deterministic Rule Checks
  const ruleChecks: RuleCheckResult[] = [];

  // Check 1: Vibration Threshold (ISO 10816-3 Industrial Velocity Criteria)
  if (record.vibrationRms !== undefined && record.vibrationRms !== null) {
    const isCritical = record.vibrationRms > 4.5;
    const isWarning = record.vibrationRms >= 2.8 && record.vibrationRms <= 4.5;
    ruleChecks.push({
      ruleId: 'RULE-VIB-01',
      name: 'Vibration Velocity Limit',
      threshold: '< 2.8 mm/s (Nominal), > 4.5 mm/s (Critical)',
      observedValue: `${record.vibrationRms.toFixed(1)} mm/s`,
      triggered: isCritical || isWarning,
      severity: isCritical ? 'critical' : isWarning ? 'warning' : 'nominal',
      detail: isCritical
        ? 'Breaches ISO 10816 critical threshold (> 4.5 mm/s). Severe mechanical unbalance or bearing fatigue.'
        : isWarning
        ? 'Operating in alert zone (2.8 - 4.5 mm/s). Elevated harmonic vibration detected.'
        : 'Velocity within nominal tolerance (< 2.8 mm/s).',
    });
  } else {
    ruleChecks.push({
      ruleId: 'RULE-VIB-01',
      name: 'Vibration Velocity Limit',
      threshold: '< 2.8 mm/s',
      observedValue: 'Missing / Not Recorded',
      triggered: false,
      severity: 'unknown',
      detail: 'Field walkdown did not supply vibration velocity. Cannot determine vibration health.',
    });
  }

  // Check 2: Bearing Temperature Variance Delta
  if (record.bearingTempDelta !== undefined && record.bearingTempDelta !== null) {
    const isCritical = record.bearingTempDelta > 35.0;
    const isWarning = record.bearingTempDelta >= 20.0 && record.bearingTempDelta <= 35.0;
    ruleChecks.push({
      ruleId: 'RULE-THM-02',
      name: 'Bearing Thermal Variance',
      threshold: '< 20.0 °C (Nominal), > 35.0 °C (Critical)',
      observedValue: `+${record.bearingTempDelta.toFixed(1)} °C`,
      triggered: isCritical || isWarning,
      severity: isCritical ? 'critical' : isWarning ? 'warning' : 'nominal',
      detail: isCritical
        ? 'Exceeds critical thermal ceiling (+35.0 °C above ambient). Severe friction or lubrication loss.'
        : isWarning
        ? 'Elevated thermal variance (+20.0 °C - +35.0 °C). Bearing heat generation requires monitoring.'
        : 'Thermal delta within normal operating equilibrium (+< 20.0 °C).',
    });
  } else {
    ruleChecks.push({
      ruleId: 'RULE-THM-02',
      name: 'Bearing Thermal Variance',
      threshold: '< 20.0 °C',
      observedValue: 'Missing / Not Recorded',
      triggered: false,
      severity: 'unknown',
      detail: 'Bearing thermal delta unrecorded. Cannot verify heat dissipation state.',
    });
  }

  // Check 3: Overhaul Service Interval Limit (8,000 runtime hours)
  if (record.hoursSinceOverhaul !== undefined && record.hoursSinceOverhaul !== null) {
    const isOverdue = record.hoursSinceOverhaul > 8000;
    const isApproaching = record.hoursSinceOverhaul >= 6500 && record.hoursSinceOverhaul <= 8000;
    ruleChecks.push({
      ruleId: 'RULE-SVC-03',
      name: 'Major Overhaul Operating Interval',
      threshold: 'Max 8,000 operating hours',
      observedValue: `${record.hoursSinceOverhaul.toLocaleString()} hrs`,
      triggered: isOverdue || isApproaching,
      severity: isOverdue ? 'warning' : isApproaching ? 'warning' : 'nominal',
      detail: isOverdue
        ? `Overhaul interval exceeded by ${(record.hoursSinceOverhaul - 8000).toLocaleString()} hours. Component fatigue window expired.`
        : isApproaching
        ? `Approaching service limit (${(8000 - record.hoursSinceOverhaul).toLocaleString()} hrs remaining).`
        : 'Overhaul interval within manufacturer certified lifecycle.',
    });
  } else {
    ruleChecks.push({
      ruleId: 'RULE-SVC-03',
      name: 'Major Overhaul Operating Interval',
      threshold: 'Max 8,000 operating hours',
      observedValue: 'Missing / Not Recorded',
      triggered: false,
      severity: 'unknown',
      detail: 'Runtime hours since last overhaul not found in records. Service cycle unverifiable.',
    });
  }

  // Check 4: Lubrication Condition Sample
  if (record.lubeCondition) {
    const isCritical = record.lubeCondition === 'Severe Contamination';
    const isWarning = record.lubeCondition === 'Degraded';
    const isUnverified = record.lubeCondition === 'Unverified Sample';
    ruleChecks.push({
      ruleId: 'RULE-LUB-04',
      name: 'Lubricant Degradation & Debris',
      threshold: 'Nominal condition, < 60 ppm debris',
      observedValue: `${record.lubeCondition}${record.wearDebrisPpm !== undefined ? ` (${record.wearDebrisPpm} ppm)` : ''}`,
      triggered: isCritical || isWarning || isUnverified,
      severity: isCritical ? 'critical' : isWarning ? 'warning' : isUnverified ? 'unknown' : 'nominal',
      detail: isCritical
        ? 'Severe particulate contamination or acid breakdown detected. Risk of mechanical seizure.'
        : isWarning
        ? 'Oil viscosity thinning or elevated particulate debris detected. Filter change required.'
        : isUnverified
        ? 'Sample seal unconfirmed. Needs laboratory re-verification.'
        : 'Spectrographic analysis confirms clean baseline lubricant matrix.',
    });
  } else {
    ruleChecks.push({
      ruleId: 'RULE-LUB-04',
      name: 'Lubricant Degradation & Debris',
      threshold: 'Nominal condition',
      observedValue: 'Missing / Not Recorded',
      triggered: false,
      severity: 'unknown',
      detail: 'No oil sample was logged during this inspection.',
    });
  }

  // 4. Determine Priority Rank strictly using deterministic logic
  const hasCriticalRule = ruleChecks.some((r) => r.severity === 'critical');
  const hasWarningRule = ruleChecks.some((r) => r.severity === 'warning');
  const hasMissingCriticalTelemetry = 
    record.vibrationRms === undefined || 
    record.bearingTempDelta === undefined || 
    record.hoursSinceOverhaul === undefined;

  let rank: PriorityRank;
  let rankLabel: string;
  let rankSeverity: EquipmentEvaluation['rankSeverity'];
  let statusSummary: string;

  if (hasCriticalRule) {
    // If any observed reading has breached critical limits, it must be Rank 1 immediately
    rank = 1;
    rankLabel = 'Rank 1 – Critical Intervention';
    rankSeverity = 'critical';
    statusSummary = 'Immediate maintenance shutdown or load reduction required. One or more critical thresholds breached.';
  } else if (hasMissingCriticalTelemetry && !hasWarningRule) {
    // If no critical breach is observable but fundamental telemetry is missing, rank cannot be inferred
    rank = 'Incomplete';
    rankLabel = 'Incomplete – Priority Deferred';
    rankSeverity = 'incomplete';
    statusSummary = 'Critical inspection fields missing. Rule-based ranking deferred pending field walkdown completion.';
  } else if (hasWarningRule) {
    rank = 2;
    rankLabel = 'Rank 2 – High Priority Scheduled';
    rankSeverity = 'high';
    statusSummary = 'Operating in alert envelope or overdue for scheduled major service interval.';
  } else if (needsChecking) {
    rank = 3;
    rankLabel = 'Rank 3 – Unverified Telemetry';
    rankSeverity = 'routine';
    statusSummary = 'Parameters within nominal bounds but sensor telemetry is marked for physical re-verification.';
  } else {
    rank = 4;
    rankLabel = 'Rank 4 – Nominal Operation';
    rankSeverity = 'nominal';
    statusSummary = 'All verified parameters operate within specified manufacturer tolerances.';
  }

  return {
    record,
    rank,
    rankLabel,
    rankSeverity,
    statusSummary,
    missingFields,
    isIncomplete,
    needsChecking,
    uncertaintyReason,
    ruleChecks,
  };
}

/**
 * Evaluates all records and ranks them by priority:
 * 1 (Critical) -> 2 (High) -> 'Incomplete' -> 3 (Unverified) -> 4 (Nominal)
 */
export function evaluateAndRankDataset(records: EquipmentRecord[]): EquipmentEvaluation[] {
  const evaluations = records.map(evaluateEquipmentRecord);

  // Sorting order: Rank 1 first, then Rank 2, then Incomplete (needs urgent data collection), then Rank 3, then Rank 4
  const rankWeight: Record<string, number> = {
    '1': 1,
    '2': 2,
    'Incomplete': 2.5,
    '3': 3,
    '4': 4,
  };

  return [...evaluations].sort((a, b) => {
    const weightA = rankWeight[String(a.rank)] ?? 99;
    const weightB = rankWeight[String(b.rank)] ?? 99;
    if (weightA !== weightB) {
      return weightA - weightB;
    }
    // Secondary sort: vibration RMS descending if present
    const vibA = a.record.vibrationRms ?? -1;
    const vibB = b.record.vibrationRms ?? -1;
    return vibB - vibA;
  });
}
