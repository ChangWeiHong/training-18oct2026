import { useEffect, useRef } from 'react';
import { selectedRundown, curveLength } from './state.js';
import { nextPosition } from './playback.js';

/** Elements that own the arrow keys themselves. */
const OWN_KEYS = 'input, select, textarea, [contenteditable="true"], [data-slot="3d"], .graph-svg, .ledger, dialog[open]';

export function shouldStep(e) {
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return false;
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return false;
  const t = e.target;
  return !(t && t.closest && t.closest(OWN_KEYS));
}

/** rAF playback loop plus the global arrow-key stepper. */
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
    const frame = (now) => {
      const s = live.current;
      const sel = selectedRundown(s);
      const n = curveLength(sel);
      if (n < 2) { dispatch({ type: 'PAUSE' }); return; }
      // The cursor moved by hand (graph drag, keys, ledger): continue from there.
      // State may lag one frame behind a dispatch, so only a value we did not send counts.
      if (s.cursor !== seen && s.cursor !== sent) pos = s.cursor;
      seen = s.cursor;
      const dt = last == null ? 0 : Math.min(100, now - last); // a background tab must not jump ahead
      last = now;
      pos = nextPosition(sel.curve, pos, dt, s.speed);
      const i = Math.round(pos);
      if (i !== sent) { sent = i; dispatch({ type: 'SET_CURSOR', i }); }
      if (pos >= n - 1) { dispatch({ type: 'PAUSE' }); return; }
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
