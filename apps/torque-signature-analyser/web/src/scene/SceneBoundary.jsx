import { Component } from 'react';
import SceneFallback from './SceneFallback.jsx';

/** Any render or renderer error in the 3D view (including a failed lazy load) shows the fallback; the rest of the page keeps working. */
export default class SceneBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.warn('3D view failed:', error);
  }

  render() {
    return this.state.failed ? <SceneFallback /> : this.props.children;
  }
}
