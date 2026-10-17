import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import Toolbar from './components/Toolbar.jsx';
import CountStrip from './components/CountStrip.jsx';
import Ledger from './components/Ledger.jsx';
import TorqueGraph from './components/TorqueGraph.jsx';
import EvidencePanel from './components/EvidencePanel.jsx';
import JointScene from './scene/JointScene.jsx';
import { initialState, selectionReducer, selectedRundown, parseSpecInputs, specToInputs, SAMPLE_SPEC, EMPTY_SPEC } from './state.js';
import { listSamples, analyseSample, analyseUpload } from './api.js';

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
  const ticket = useRef(0);

  const run = useCallback(async (job) => {
    const mine = ++ticket.current;
    setBusy(true);
    setError(null);
    try {
      const result = await job();
      if (mine === ticket.current) dispatch({ type: 'LOAD_RESULT', result });
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
    setSpecInputs(specToInputs(pack?.spec));
    run(() => analyseSample(id));
  }, [run]);

  // Boot: list packs, load "mixed".
  useEffect(() => {
    let live = true;
    listSamples()
      .then((list) => {
        if (!live) return;
        setSamples(list);
        const first = list.find((s) => s.id === 'mixed') ?? list[0];
        if (first) loadSample(first.id, first);
      })
      .catch((e) => live && setError(e?.error ? e : { error: 'Could not load sample packs.', fix: 'Reload the page.' }));
    return () => { live = false; };
  }, [loadSample]);

  const parsed = parseSpecInputs(specInputs);
  const specNote = parsed === 'partial' ? 'Fill all five spec values, or clear them all, then press Re-run.' : null;

  const runUpload = (readings, reference) => {
    if (parsed === 'partial') return;
    run(() => analyseUpload(readings, reference, parsed));
  };

  const onReadings = (f) => {
    // Chips filled by a sample pack belong to that pack. A fresh upload starts without a spec.
    const fromSample = sampleId != null;
    setReadingsFile(f);
    setSampleId(null);
    if (fromSample) setSpecInputs({ ...EMPTY_SPEC });
    const spec = fromSample ? null : parsed;
    if (spec !== 'partial') run(() => analyseUpload(f, referenceFile, spec));
  };
  const onReference = (f) => {
    setReferenceFile(f);
    if (readingsFile) runUpload(readingsFile, f);
  };
  const onRerun = () => {
    if (parsed === 'partial') return;
    if (readingsFile) runUpload(readingsFile, referenceFile);
    else if (sampleId) run(() => analyseSample(sampleId, parsed));
  };

  const rundowns = state.result?.rundowns ?? [];
  const selected = selectedRundown(state);
  const canRerun = parsed !== 'partial' && Boolean(readingsFile || sampleId);

  return (
    <div className="app">
      <Toolbar
        samples={samples}
        sampleId={sampleId}
        onPickSample={(id) => loadSample(id, samples.find((s) => s.id === id))}
        readingsFile={readingsFile}
        referenceFile={referenceFile}
        onReadings={onReadings}
        onReference={onReference}
        specInputs={specInputs}
        onSpecChange={(k, v) => setSpecInputs((s) => ({ ...s, [k]: v }))}
        onUseSampleSpec={() => setSpecInputs(specToInputs(SAMPLE_SPEC))}
        onRerun={onRerun}
        canRerun={canRerun}
        busy={busy}
        error={error}
        specNote={specNote}
      />

      <main className="main">
        <CountStrip result={state.result} />

        {/* Task 8 (3D joint) and Task 9 (playback, layout) fill the remaining slots. */}
        <section className="workspace" aria-label="Workspace">
          <div className="workspace-left">
            <div className="slot slot-graph" data-slot="graph">
              <TorqueGraph
                result={state.result}
                selected={selected}
                cursor={state.cursor}
                mode={mode}
                onMode={setMode}
                onCursor={(i) => dispatch({ type: 'SET_CURSOR', i })}
              />
            </div>
            <aside className="slot slot-evidence" data-slot="evidence" aria-label="Evidence">
              <EvidencePanel selected={selected} />
            </aside>
          </div>
          <div className="slot slot-3d" data-slot="3d">
            <JointScene
              result={state.result}
              selected={selected}
              cursor={state.cursor}
              onSelect={(id) => dispatch({ type: 'SELECT', rundownId: id })}
            />
          </div>
          <div className="slot slot-playback" data-slot="playback">
            <p className="slot-empty">Playback bar goes here.</p>
          </div>
        </section>

        {rundowns.length > 0 && (
          <Ledger rundowns={rundowns} selectedId={state.selectedId} onSelect={(id) => dispatch({ type: 'SELECT', rundownId: id })} />
        )}
      </main>
    </div>
  );
}
