import { useEffect, useRef } from 'react';
import { selectedRundown, curveLength } from './state.js';
import { frameStep } from './playback.js';

/** Elements that own the arrow keys themselves. */
const OWN_KEYS = 'input, select, textarea, [contenteditable="true"], [data-slot="3d"], .graph-svg, .ledger, dialog[open]';

export function shouldStep(e) {
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return false;
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return false;
  const t = e.target;
  const doc = t?.ownerDocument ?? globalThis.document;
  if (doc?.querySelector?.('dialog[open]')) return false; // a modal owns the keys, wherever focus sits
  return !(t && t.closest && t.closest(OWN_KEYS));
}

/** rAF playback loop plus the global arrow-key stepper. At the last sample the loop holds, then asks the reducer what comes next. */
export default function usePlayback(state, dispatch) {
  const live = useRef(state);
  live.current = state;
  const playing = state.playing;

  useEffect(() => {
    if (!playing) return undefined;
    let raf = 0;
    let last = null;
    let pos = live.current.cursor;
    let sent = pos; // last cursor this loop dispatched
    let seen = pos; // last cursor value read from state
    let hold = null; // ms spent on the last sample
    let key = null; // result + selection this loop is playing
    const frame = (now) => {
      const s = live.current;
      const sel = selectedRundown(s);
      const n = curveLength(sel);
      if (n < 2) { dispatch({ type: 'STOP' }); return; }
      const here = `${s.selectedId}`;
      if (key !== null && (key.result !== s.result || key.id !== here)) {
        // A different rundown: start over from its first sample.
        pos = s.cursor; sent = pos; seen = pos; hold = null; last = null;
      }
      key = { result: s.result, id: here };
      // The cursor moved by hand (graph drag, keys, ledger): continue from there.
      // State may lag one frame behind a dispatch, so only a value we did not send counts.
      if (s.cursor !== seen && s.cursor !== sent) { pos = s.cursor; hold = null; }
      seen = s.cursor;
      const dt = last == null ? 0 : Math.min(100, now - last); // a background tab must not jump ahead
      last = now;
      const step = frameStep(sel.curve, pos, hold, dt, s.speed);
      pos = step.pos;
      hold = step.hold;
      const i = Math.round(pos);
      if (i !== sent) { sent = i; dispatch({ type: 'TICK', i }); }
      if (step.ended) {
        // Reset local state; the reducer restarts, advances the tour or stops.
        pos = 0; sent = 0; seen = s.cursor; hold = null; last = null;
        dispatch({ type: 'LOOP_END' });
        if (!live.current.loop && !live.current.tour) return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [playing, dispatch]);

  useEffect(() => {
    const onKey = (e) => {
      if (!shouldStep(e)) return;
      e.preventDefault();
      dispatch({ type: 'STEP', delta: (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 10 : 1) });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch]);
}
