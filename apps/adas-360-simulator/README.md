# ADAS 360° Threat Detection Simulator

A browser demo of a 360° perception view around a car. You pick a driving scenario, set speed, detection radius, traffic density, collision sensitivity, braking response and weather, then run the simulation. Traffic moves around the ego vehicle in a 3D or top-down view while the side panels show the nearest objects, time to collision, a threat trend and whether automatic emergency braking (AEB) has kicked in. **Trigger collision scenario** puts an obstacle in your lane so you can see whether the braking settings stop the car in time.

Live: https://adas-360-simulator-271836949821.asia-southeast1.run.app

All data is synthetic. Object motion, classification, sensor confidence and braking logic are simplified rules, not validated ADAS software. Do not use it as driving or safety guidance.

![ADAS 360° simulator at 1440 px](docs/screenshots/overview.png)

## How it works

- One file, `index.html`: HTML, CSS and plain JavaScript drawing on a `<canvas>`. No build step, no external libraries.
- Time to collision is the gap to the nearest in-lane object ahead divided by the closing speed. Risk rises as that time drops below 6.8 s, scaled up for rain, fog, snow and night.
- AEB brakes when time to collision falls under a threshold set by collision sensitivity (1.35 s, 1.9 s or 2.8 s). Braking response sets the deceleration.
- Drag the view to orbit, scroll to zoom.

## Run locally

```bash
open index.html
```

## Deploy

```bash
gcloud run deploy adas-360-simulator --source . --region asia-southeast1 --project marii-ge --allow-unauthenticated
```

Run from this folder. The `Dockerfile` serves `index.html` with nginx on port 8080. Full steps: [`DEPLOY.md`](../../DEPLOY.md).
