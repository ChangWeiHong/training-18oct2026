import { Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight, Repeat, Route } from 'lucide-react';
import { SPEEDS, hasTime } from '../playback.js';

const fmt = (v) => (Math.round(v * 10) / 10).toFixed(1);

export default function PlaybackBar({ selected, cursor, playing, speed, loop, tour, canTour, reducedMotion, dispatch }) {
  const curve = selected?.curve;
  const n = curve?.angle?.length ?? 0;
  const ready = n > 1;
  const i = ready ? Math.min(cursor, n - 1) : 0;
  const timed = ready && hasTime(curve);

  return (
    <div className="playback" role="group" aria-label="Playback">
      <div className="playback-controls">
        <button
          type="button"
          className="btn btn-play"
          disabled={!ready}
          aria-pressed={playing}
          onClick={() => dispatch({ type: playing ? 'PAUSE' : 'PLAY' })}
        >
          {playing ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
          <span>{playing ? 'Pause' : 'Play'}</span>
        </button>
        <div className="btn-group playback-steps" role="group" aria-label="Step">
          <button type="button" className="btn btn-icon" disabled={!ready} aria-label="Back 10 samples" title="Back 10 samples (Shift+Left)" onClick={() => dispatch({ type: 'STEP', delta: -10 })}><SkipBack size={14} aria-hidden="true" /></button>
          <button type="button" className="btn btn-icon" disabled={!ready} aria-label="Back 1 sample" title="Back 1 sample (Left)" onClick={() => dispatch({ type: 'STEP', delta: -1 })}><ChevronLeft size={14} aria-hidden="true" /></button>
          <button type="button" className="btn btn-icon" disabled={!ready} aria-label="Forward 1 sample" title="Forward 1 sample (Right)" onClick={() => dispatch({ type: 'STEP', delta: 1 })}><ChevronRight size={14} aria-hidden="true" /></button>
          <button type="button" className="btn btn-icon" disabled={!ready} aria-label="Forward 10 samples" title="Forward 10 samples (Shift+Right)" onClick={() => dispatch({ type: 'STEP', delta: 10 })}><SkipForward size={14} aria-hidden="true" /></button>
        </div>
        <div className="btn-group playback-modes" role="group" aria-label="Repeat and tour">
          <button type="button" className="btn btn-small btn-toggle" aria-pressed={loop} title="Hold the final pose for 1 second, then play again" onClick={() => dispatch({ type: 'SET_LOOP', on: !loop })}>
            <Repeat size={13} aria-hidden="true" /><span>Loop</span>
          </button>
          <button
            type="button"
            className="btn btn-small btn-toggle"
            aria-pressed={tour}
            disabled={!ready || !canTour || reducedMotion}
            title={reducedMotion ? 'Tour is off because your system asks for less motion' : canTour ? 'Play each flagged rundown in rank order. Any action of yours stops it.' : 'Nothing is flagged in this pack'}
            onClick={() => dispatch({ type: 'SET_TOUR', on: !tour })}
          >
            <Route size={13} aria-hidden="true" /><span>Tour</span>
          </button>
        </div>
        <div className="btn-group playback-speeds" role="group" aria-label="Speed">
          {SPEEDS.map((x) => (
            <button key={x} type="button" className="btn btn-small" aria-pressed={speed === x} onClick={() => dispatch({ type: 'SET_SPEED', x })}>{x}x</button>
          ))}
        </div>
      </div>
      <p className="playback-readout">
        {ready ? (
          <>Sample <b>{i}</b> of {n - 1} · angle <b>{fmt(curve.angle[i])}°</b> · torque <b>{fmt(curve.torque[i])} Nm</b></>
        ) : (
          <span className="dim">Load a pack to play a rundown.</span>
        )}
      </p>
      {ready && <p className="playback-mode">{timed ? 'Real time from time_ms' : 'Uniform sample playback'}</p>}
    </div>
  );
}
