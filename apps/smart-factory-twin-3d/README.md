# FORGE / Automotive Production Digital Twin 3D

Interactive 3D factory overview and five-stage bottleneck simulator for automotive engineers. **All content is synthetic.** No factory systems, external AI models, APIs or backend.

## Quick start

```bash
npm install
npm run dev
```

Requires Node.js 20+. Open the URL printed by Vite. A browser with WebGL support is required to render the 3D factory.

```bash
npm test       # built-in Node.js tests for the capacity model
npm run build  # production static bundle
npm run preview
```

## 3D production floor

The real Three.js scene (`src/FactoryScene.jsx`) is fully procedural. No remote GLTF assets or textures. The production floor is **63 × 23 conceptual world units**, and the view can be rotated, zoomed and panned. Three camera presets provide 3D isometric, top and front views. Rendering includes:

- Stamping press with animated die and sheet staging.
- Four robotic welding manipulators, structural gantry and protected cell.
- Transparent paint booth, spray manipulators and extraction ducts.
- Vehicle assembly gantry, moving hoist and robot tools.
- Quality inspection gate, scanner and operator cabinets.
- Connected motor conveyor, moving vehicles, factory hall, overhead light trusses, pipework, storage racks, forklifts, material pallets, tire stacks, mobile robots, safety fences, control cabinets, and other support equipment.
- Click an asset or station label to select a production stage; bottleneck and selected stages get restrained floor annotations.

Vehicle animation is deliberately accelerated to make flow visible and is **not** a discrete-event or vehicle-tracking simulation.

## Simulation model

`src/simulation.js` is a pure local function covered by `tests/simulation.test.js`.

- Cycle time editable from 15–100s per unit.
- Downtime editable from 0–60% for each station.
- Effective cycle time = `nominalCycleSeconds / (1 - downtimePercent / 100)`.
- Bottleneck is the stage with the greatest effective cycle time.
- Line capacity = `3600 / maxEffectiveCycleSeconds` (units/hour).
- Utilisation = `stageEffectiveCycle / maxEffectiveCycle` (as a percentage).
- Mean station utilisation = average of above figures.
- Balance efficiency = `sum(nominalCycles) / (stationCount * maxEffectiveCycle)`.
- Estimated shift output = `floor(hourlyCapacity * 8)`.
- **Simulate Improvement** cuts the bottleneck's *nominal* cycle by 20%, respecting the 15s minimum; it can cause the constraint to move.
- **Reset** restores all initial rates and clears downtime.

**Model limits:** ideal serial flow; no station buffers, parallel lines, scrap, queues, setup times, failures, or quality-yield model. Charts display synthetic time-series jitter; there is no historical or live telemetry. These metrics are capacity estimates, not certified OEE values.

## Cloud Run

```bash
gcloud run deploy smart-factory-twin \
  --source . \
  --region asia-southeast1 \
  --allow-unauthenticated
```

The multi-stage Dockerfile runs the Vite production build and serves the static files using Nginx on port 8080. Requires configured gcloud auth/project and enabled Cloud Run/Cloud Build APIs. No runtime backend or secrets needed.

See [`DESIGN.md`](DESIGN.md) for design choices and the three referenced skill repositories.
