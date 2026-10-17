import { lazy, Suspense, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import Toolbar from './components/Toolbar.jsx';
import CountStrip from './components/CountStrip.jsx';
import Ledger from './components/Ledger.jsx';
import TorqueGraph from './components/TorqueGraph.jsx';
import EvidencePanel from './components/EvidencePanel.jsx';
import PlaybackBar from './components/PlaybackBar.jsx';
import About from './components/About.jsx';
import usePlayback from './usePlayback.js';
import { inputsSnapshot, isStale } from './stale.js';
import SceneBoundary from './scene/SceneBoundary.jsx';
import { initialState, selectionReducer, selectedRundown, parseSpecInputs, specToInputs, SAMPLE_SPEC, EMPTY_SPEC, isFlagged } from './state.js';
import { defaultPackId, packBolts, showUploadControls } from './packs.js';
import { useReducedMotion } from './motion.js';
import { listSamples, analyseSample, analyseUpload } from './api.js';

const JointScene = lazy(() => import('./scene/JointScene.jsx'));

export default function App() {
  const [state, dispatch] = useReducer(selectionReducer, initialState);
  const [samples, setSamples] = useState([]);
  const [sampleId, setSampleId] = useState(null);
  const [readingsFile, setReadingsFile] = useState(null);
  const [referenceFile, setReferenceFile] = useState(null);
  const [specInputs, setSpecInputs] = useState({ ...EMPTY_SPEC });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState('absolute');
  const [aboutOpen, setAboutOpen] = useState(false);
  const [computedFrom, setComputedFrom] = useState(null);
  const ticket = useRef(0);
  const reducedMotion = useReducedMotion();
  const autoplay = !reducedMotion;
  const showUpload = useMemo(() => showUploadControls(window.location.search), []);
  const autoplayRef = useRef(autoplay);
  autoplayRef.current = autoplay;
  const select = useCallback((id) => dispatch({ type: 'SELECT', rundownId: id, autoplay }), [autoplay]);
  const touch = useCallback(() => dispatch({ type: 'USER_ACTION' }), []);

  // Reduced motion switched on mid-session: clear the tour and stop playback.
  useEffect(() => { dispatch({ type: 'REDUCED_MOTION', on: reducedMotion }); }, [reducedMotion]);

  usePlayback(state, dispatch);

  // `snap` records which inputs the result is computed from.
  const run = useCallback(async (job, snap, source = 'sample') => {
    const mine = ++ticket.current;
    setBusy(true);
    setError(null);
    try {
      const result = await job();
      if (mine === ticket.current) {
        dispatch({ type: 'LOAD_RESULT', result, autoplay: autoplayRef.current, source });
        setComputedFrom(snap);
      }
    } catch (e) {
      if (mine === ticket.current) setError(e?.error ? e : { error: 'Something went wrong.', fix: 'Try again.' });
    } finally {
      if (mine === ticket.current) setBusy(false);
    }
  }, []);

  const loadSample = useCallback((id, pack) => {
    setSampleId(id);
    setReadingsFile(null);
    setReferenceFile(null);
    const inputs = specToInputs(pack?.spec);
    setSpecInputs(inputs);
    run(() => analyseSample(id), inputsSnapshot({ sampleId: id, readingsFile: null, referenceFile: null, specInputs: inputs }));
  }, [run]);

  // Boot: list packs, load "mixed".
  useEffect(() => {
    let live = true;
    listSamples()
      .then((list) => {
        if (!live) return;
        setSamples(list);
        const first = list.find((s) => s.id === defaultPackId(list));
        if (first) loadSample(first.id, first);
      })
      .catch((e) => live && setError(e?.error ? e : { error: 'Could not load sample packs.', fix: 'Reload the page.' }));
    return () => { live = false; };
  }, [loadSample]);

  const parsed = parseSpecInputs(specInputs);
  const specNote = parsed === 'partial' ? 'Fill all five spec values, or clear them all, then press Re-run.' : null;

  const snapFor = (over) => inputsSnapshot({ sampleId, readingsFile, referenceFile, specInputs, ...over });

  const runUpload = (readings, reference, spec, inputs = specInputs) => {
    run(() => analyseUpload(readings, reference, spec),
      inputsSnapshot({ sampleId: null, readingsFile: readings, referenceFile: reference, specInputs: inputs }), 'upload');
  };

  const onReadings = (f) => {
    touch();
    // Chips filled by a sample pack belong to that pack. A fresh upload starts without a spec.
    const fromSample = sampleId != null;
    setReadingsFile(f);
    setSampleId(null);
    if (fromSample) setSpecInputs({ ...EMPTY_SPEC });
    const spec = fromSample ? null : parsed;
    if (spec !== 'partial') runUpload(f, referenceFile, spec, fromSample ? { ...EMPTY_SPEC } : specInputs);
  };
  const onReference = (f) => {
    touch();
    setReferenceFile(f);
    if (readingsFile && parsed !== 'partial') runUpload(readingsFile, f, parsed);
  };
  const onRerun = () => {
    touch();
    if (parsed === 'partial') return;
    if (readingsFile) runUpload(readingsFile, referenceFile, parsed);
    else if (sampleId) run(() => analyseSample(sampleId, parsed), snapFor({}));
  };

  const stale = isStale({
    hasResult: Boolean(state.result),
    computedFrom,
    current: snapFor({}),
    failed: Boolean(error),
  });
  const referenceNote = referenceFile && !readingsFile && sampleId != null ? 'Upload readings to use this reference.' : null;

  const rundowns = state.result?.rundowns ?? [];
  const selected = selectedRundown(state);
  // A new analysis result gives the 3D view a fresh start after an earlier failure.
  const resultSeen = useRef({ result: null, n: 0 });
  if (resultSeen.current.result !== state.result) resultSeen.current = { result: state.result, n: resultSeen.current.n + 1 };
  const resultKey = resultSeen.current.n;
  const pack = samples.find((p) => p.id === sampleId);
  const packSpec = pack?.spec;
  const canTour = rundowns.some(isFlagged);
  const canRerun = parsed !== 'partial' && Boolean(readingsFile || sampleId);

  return (
    <div className="app">
      <Toolbar
        samples={samples}
        sampleId={sampleId}
        onPickSample={(id) => { touch(); loadSample(id, samples.find((s) => s.id === id)); }}
        readingsFile={readingsFile}
        referenceFile={referenceFile}
        onReadings={onReadings}
        onReference={onReference}
        specInputs={specInputs}
        onSpecChange={(k, v) => { touch(); setSpecInputs((s) => ({ ...s, [k]: v })); }}
        onUseSampleSpec={() => { touch(); setSpecInputs(specToInputs(packSpec ?? SAMPLE_SPEC)); }}
        showUpload={showUpload}
        onRerun={onRerun}
        canRerun={canRerun}
        busy={busy}
        error={error}
        specNote={specNote}
        referenceNote={referenceNote}
        onAbout={() => { touch(); setAboutOpen(true); }}
        source={state.source}
      />
      <About open={aboutOpen} onClose={() => setAboutOpen(false)} />

      <main className="main">
        {stale && (
          <p className="stale-note" role="status">
            {busy ? 'Out of date: updating.' : 'Out of date: press Re-run.'}
          </p>
        )}
        <div className={stale ? 'results is-stale' : 'results'} aria-busy={busy || undefined}>
        <CountStrip result={state.result} />

        <section className="workspace" aria-label="Workspace">
          <div className="workspace-left">
            <div className="slot slot-graph" data-slot="graph">
              <TorqueGraph
                result={state.result}
                selected={selected}
                cursor={state.cursor}
                mode={mode}
                onMode={(m) => { touch(); setMode(m); }}
                onInteract={touch}
                playing={state.playing}
                onCursor={(i) => dispatch({ type: 'SET_CURSOR', i })}
              />
            </div>
            <aside className="slot slot-evidence" data-slot="evidence" aria-label="Evidence">
              <EvidencePanel selected={selected} />
            </aside>
          </div>
          <div className="slot slot-3d" data-slot="3d">
            <SceneBoundary key={resultKey}>
            <Suspense fallback={<p className="slot-empty">Loading 3D view.</p>}>
              <JointScene
                result={state.result}
                selected={selected}
                cursor={state.cursor}
                onSelect={select}
                onInteract={touch}
                bolts={packBolts(pack)}
              />
            </Suspense>
            </SceneBoundary>
          </div>
          <div className="slot slot-playback" data-slot="playback">
            <PlaybackBar selected={selected} cursor={state.cursor} playing={state.playing} speed={state.speed} loop={state.loop} tour={state.tour} canTour={canTour} reducedMotion={reducedMotion} dispatch={dispatch} />
          </div>
        </section>

        {rundowns.length > 0 && (
          <Ledger rundowns={rundowns} selectedId={state.selectedId} onSelect={select} onInteract={touch} />
        )}
        </div>
      </main>
    </div>
  );
}
