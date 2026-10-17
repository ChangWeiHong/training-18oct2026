async function readError(res) {
  try {
    const body = await res.json();
    if (body && typeof body === 'object' && body.error) {
      return { error: body.error, row: body.row ?? null, column: body.column ?? null, fix: body.fix ?? null };
    }
    if (body?.detail) return { error: String(body.detail), row: null, column: null, fix: null };
  } catch { /* fall through */ }
  return { error: `The analysis service returned status ${res.status}.`, row: null, column: null, fix: 'Try again in a moment.' };
}

async function request(url, init) {
  let res;
  try {
    res = await fetch(url, init);
  } catch {
    throw { error: 'Could not reach the analysis service.', row: null, column: null, fix: 'Check your connection and try again.' };
  }
  if (!res.ok) throw await readError(res);
  return res.json();
}

export function listSamples() {
  return request('/api/samples');
}

export function analyseSample(id, spec) {
  const body = { sample_id: id };
  // undefined: use the pack's spec. null: explicitly no spec.
  if (spec !== undefined) body.spec = spec;
  return request('/api/analyse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function analyseUpload(readings, reference, spec) {
  const form = new FormData();
  form.append('readings', readings);
  if (reference) form.append('reference', reference);
  if (spec) form.append('spec', JSON.stringify(spec));
  return request('/api/analyse', { method: 'POST', body: form });
}

export const TEMPLATE_URL = '/api/template.csv';
