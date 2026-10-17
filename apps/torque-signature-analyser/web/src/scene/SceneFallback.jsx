import { WEBGL_MESSAGE } from './webgl.js';

export default function SceneFallback() {
  return <div className="joint-fallback" role="note">{WEBGL_MESSAGE}</div>;
}
