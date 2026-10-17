export const initialState = {
  result: null,
  selectedId: undefined,
  cursor: 0,
  playing: false,
  speed: 1,
};

export function selectedRundown(state) {
  return state.result?.rundowns?.find((r) => r.id === state.selectedId);
}

export function curveLength(rundown) {
  return rundown?.curve?.angle?.length ?? 0;
}

function clampCursor(state, i) {
  const max = Math.max(0, curveLength(selectedRundown(state)) - 1);
  return Math.min(max, Math.max(0, Math.round(i)));
}

export function selectionReducer(state, action) {
  switch (action.type) {
    case 'LOAD_RESULT':
      return {
        ...state,
        result: action.result,
        selectedId: action.result.rundowns[0]?.id,
        cursor: 0,
        playing: false,
      };
    case 'SELECT':
      return { ...state, selectedId: action.rundownId, cursor: 0 };
    case 'SET_CURSOR':
      return { ...state, cursor: clampCursor(state, action.i) };
    case 'STEP':
      return { ...state, cursor: clampCursor(state, state.cursor + action.delta) };
    case 'PLAY':
      return { ...state, playing: true };
    case 'PAUSE':
      return { ...state, playing: false };
    case 'SET_SPEED':
      return { ...state, speed: action.x };
    default:
      return state;
  }
}

export const SPEC_FIELDS = [
  { key: 'torque_min_nm', label: 'Torque min', unit: 'Nm' },
  { key: 'torque_max_nm', label: 'Torque max', unit: 'Nm' },
  { key: 'angle_min_deg', label: 'Post-snug min', unit: '°' },
  { key: 'angle_max_deg', label: 'Post-snug max', unit: '°' },
  { key: 'snug_torque_nm', label: 'Snug', unit: 'Nm' },
];

export const SAMPLE_SPEC = {
  torque_min_nm: 99,
  torque_max_nm: 121,
  angle_min_deg: 20,
  angle_max_deg: 60,
  snug_torque_nm: 30,
};

export const EMPTY_SPEC = Object.fromEntries(SPEC_FIELDS.map((f) => [f.key, '']));

/** Chip strings -> spec object, or null when none filled, or 'partial' when some are missing/invalid. */
export function parseSpecInputs(inputs) {
  const filled = SPEC_FIELDS.filter((f) => String(inputs[f.key] ?? '').trim() !== '');
  if (filled.length === 0) return null;
  if (filled.length < SPEC_FIELDS.length) return 'partial';
  const out = {};
  for (const f of SPEC_FIELDS) {
    const n = Number(inputs[f.key]);
    if (!Number.isFinite(n)) return 'partial';
    out[f.key] = n;
  }
  return out;
}

export function specToInputs(spec) {
  if (!spec) return { ...EMPTY_SPEC };
  return Object.fromEntries(SPEC_FIELDS.map((f) => [f.key, spec[f.key] == null ? '' : String(spec[f.key])]));
}

export const SIGNATURE_ORDER = { investigate: 0, cant_assess: 1, typical: 2 };
export const SPEC_ORDER = { outside: 0, incomplete: 1, within: 2, not_supplied: 3 };

export function sortRundowns(rows, key, dir = 'asc') {
  const m = dir === 'asc' ? 1 : -1;
  const val = (r) => {
    switch (key) {
      case 'assembly': return r.assembly_id;
      case 'position': return r.bolt_position ?? 99;
      case 'spec': return SPEC_ORDER[r.spec_result] ?? 9;
      case 'signature': return SIGNATURE_ORDER[r.signature] ?? 9;
      default: return r.rank;
    }
  };
  return [...rows].sort((a, b) => {
    const x = val(a), y = val(b);
    const c = typeof x === 'string' ? x.localeCompare(y, undefined, { numeric: true }) : x - y;
    return (c || a.rank - b.rank) * m;
  });
}
