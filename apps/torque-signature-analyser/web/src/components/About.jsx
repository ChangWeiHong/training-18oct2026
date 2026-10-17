import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import diagram from '../diagram/how-it-works.svg.txt?raw';

export default function About({ open, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} className="about" aria-labelledby="about-title" onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      <div className="about-panel">
        <div className="about-head">
          <h2 id="about-title">How the analysis works</h2>
          <button type="button" className="btn btn-icon" onClick={onClose} aria-label="Close"><X size={14} aria-hidden="true" /></button>
        </div>

        <div className="about-diagram">
          <svg viewBox="0 0 760 348" width="760" height="348" role="img" aria-labelledby="hiw-title hiw-desc" dangerouslySetInnerHTML={{ __html: diagram }} />
        </div>

        <ol className="about-steps">
          <li><b>Features.</b> Each rundown becomes a short list: final and peak torque, snug angle, post-snug angle, elastic slope, torque drops, and how far the curve strays from the reference median.</li>
          <li><b>Reference.</b> The reference rundowns set the expected band, the 5th to 95th percentile at each angle after snug. The tool assumes they are good rundowns. Without a reference file, the upload is compared with itself, so a shift across the whole batch can hide.</li>
          <li><b>Signature result.</b> A rundown is worth investigating when one feature sits far outside the reference spread, the whole curve strays far from the median, the rotation runs past the reference curve, or the Isolation Forest finds the mix of features unusual. Typical means statistically similar to the reference. It does not approve the fastening. Can't assess means the reference or the trace gave too little to compare.</li>
          <li><b>Spec result.</b> Torque and post-snug angle are checked against the limits you enter. The reference plays no part. A rundown is within only when every limit you entered was checked and passed. Partly checked means a limit could not be tested. Not supplied means you entered no limits.</li>
        </ol>

        <h3>Limits</h3>
        <ul className="about-limits">
          <li>The tool reads continuous-drive tightening traces only.</li>
          <li>All sample data is synthetic.</li>
          <li>The detector was checked on 3 held-out synthetic seeds. Each had only 3 to 5 abnormal rundowns that were still in spec, so the recall figures rest on very few cases.</li>
          <li>A flag means worth checking. It does not confirm a fault.</li>
          <li>Real nutrunner traces may differ from the synthetic ones.</li>
          <li>In the 3D view, rotation is measured. Travel and compression are illustrative.</li>
        </ul>

        <h3>Keys</h3>
        <p className="about-keys">Left and Right step one sample, with Shift ten. In the 3D view, Q and E rotate, W and S tilt, plus and minus zoom, 0 resets.</p>
      </div>
    </dialog>
  );
}
