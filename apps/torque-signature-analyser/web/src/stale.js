// A result is only current for the inputs it was computed from.

/** What a run depends on. Files compare by identity, spec by its chip text. */
export function inputsSnapshot({ sampleId, readingsFile, referenceFile, specInputs }) {
  return {
    sampleId: sampleId ?? null,
    readingsFile: sampleId != null ? null : readingsFile ?? null,
    // A reference chosen while a pack is active is not used, so it cannot make a pack result stale.
    referenceFile: sampleId != null ? null : referenceFile ?? null,
    spec: JSON.stringify(specInputs),
  };
}

export function sameInputs(a, b) {
  if (!a || !b) return false;
  return a.sampleId === b.sampleId && a.readingsFile === b.readingsFile
    && a.referenceFile === b.referenceFile && a.spec === b.spec;
}

/** Out of date when inputs changed since the result was computed, or the latest request failed. */
export function isStale({ hasResult, computedFrom, current, failed }) {
  if (!hasResult) return false;
  return Boolean(failed) || !sameInputs(computedFrom, current);
}
