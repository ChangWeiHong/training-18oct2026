# FORGE 3D — Visual System

## Audience and job

Automotive process, R&D and manufacturing engineers. The main task is to see how a change in station cycle time or downtime affects line capacity, then identify the next limiting station.

## Visual direction

- Industrial workbench, not a SaaS landing page.
- Dark graphite / desaturated slate equipment, light aluminum structural frames, restrained sea-glass operational indicators, warm amber reserved for the current bottleneck.
- Use one large, functional axonometric **real 3D scene** as the page's visual anchor. All geometry is procedural. Avoid decorative gradients, round-card grids, ornamental glows, and gradients in text.
- Thin linework and gentle translucent process footprints give spatial grouping. Actual equipment is visually distinct across stages.
- Technical copy says what a value means, names simulation assumptions, and never implies real PLC telemetry.

## Layout rules

1. Header (identity and live/paused state)
2. Small task title and three actions
3. Capacity-led KPI strip (throughput takes most room)
4. **Full-width 3D production floor** (selected station, five-stage areas, transit flow, camera presets)
5. Five editable stage cycle times and the downtime injector
6. Trend and utilisation charts, constraint explanation

## Geometry contract

- World units are conceptual metres, not an engineering plant drawing.
- Plate: 63 × 23 world units. Serial conveyor runs across the long X axis.
- Five logical stages at x = -23, -11.5, 0, 11.5, 23.
- Y vertical, Z depth. Camera uses genuine 3D Orthographic projection; users can orbit, zoom, and pan.
- Physical complexity is made of racks, cabinets, forklifts, conveyors, welding robots, spray units, presses, gantries, inspection portals, trusses, ducts, trolleys, sensors, and vehicles.
- Orange marks only the constrained stage. Other stations remain neutral/soft teal. Avoid five competing glowing colors.
- Animated movement is accelerated for demonstration and does not represent real-time vehicle travel.

## Source skills reviewed

- https://github.com/nutlope/hallmark — hierarchy, workbench structure, removal of common generated-UI patterns.
- https://github.com/cathrynlavery/diagram-design — axonometric plan composition, shared projection, geometry/labels, visual restraint.
- https://github.com/hardikpandya/stop-slop — direct, concrete microcopy without promotional filler.

The UI applies these principles selectively. The charting and true 3D simulation requirements take precedence over the static illustration constraints of diagram-design.
