/** WebGL2 is required: the scene uses features WebGL1 lacks. */
export function hasWebGL2(doc = document) {
  try {
    return Boolean(doc.createElement('canvas').getContext('webgl2'));
  } catch {
    return false;
  }
}

export const WEBGL_MESSAGE = '3D view needs WebGL. The graph, evidence and ledger still work.';
