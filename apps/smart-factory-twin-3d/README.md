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

## What the model does

`src/sim/engine.js` is a seeded discrete-event simulation, one tick per simulated second. Same config and seed give the same run.

- **Nine stations plus a feeder:** stamping (press), body welding (robot cells), paint (batch oven), interior trim (manual), chassis marriage (join with powertrain kits), final assembly (manual), end-of-line test, quality audit, dispatch (truck batches). The powertrain cell feeds a kit buffer.
- **Per-station controls:** cycle time and variability, parallel machines, buffer size, MTBF/MTTR failures, first-pass yield, scrap share, rework target, changeover time, line speed, staffing, batch size.
- **Line controls:** demand target, CONWIP or push release, WIP cap, 1 to 3 shifts with breaks, model mix (sedan/SUV/EV), run-length sequencing.
- **Disruptions:** inject a breakdown, quality drop, staff absence, supply stop or demand surge into the live run.
- **Read-outs:** output vs target, WIP, lead time, rolled yield, per-station busy/blocked/starved/down shares, buffer fill, OEE, and a live constraint detector.
- **Improvement advisor:** runs each candidate change on the same engine (4 seeds, 12 h) and ranks them by capacity gain.

`src/sim/analysis.js` also holds a closed-form capacity estimate. It ignores starving, blocking and variability, so it overstates the run. The gap between the two is the cost of those effects.

**Limits:** one product flow, no maintenance planning, no operator skills, no part-level material tracking, simplified break calendar. All inputs are synthetic.

## 3D production floor

`src/FactoryScene.jsx` is fully procedural, 100 x 35 conceptual metres. Station zones and tags take their color from live state. Rows of blocks on the floor show each input buffer. Vehicle motion is illustrative.

## Cloud Run

```bash
gcloud run deploy smart-factory-twin \
  --source . \
  --region asia-southeast1 \
  --allow-unauthenticated
```

The multi-stage Dockerfile runs the Vite production build and serves the static files using Nginx on port 8080. Requires configured gcloud auth/project and enabled Cloud Run/Cloud Build APIs. No runtime backend or secrets needed.

See [`DESIGN.md`](DESIGN.md) for design choices and the three referenced skill repositories.
