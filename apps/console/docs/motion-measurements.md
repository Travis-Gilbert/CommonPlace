# Motion and idle-cost measurements

HANDOFF-GREENFIELD-CONSOLE G4 and G7 require the ground canvas and Presence
mark idle costs to be measured and recorded. Method: headless chromium
(Playwright) at 1440x900 against the dev server, sampling 5 seconds of
requestAnimationFrame cadence plus a PerformanceObserver longtask watch, with
the full proof workspace mounted (ground canvas live, record table, Galley
brief, thread pane).

## 2026-07-17 (initial baseline, Apple Silicon dev machine)

- frames observed: 301 over 5.0s (60.2 fps sustained)
- worst frame gap: 18.6 ms (one frame; the 60hz budget is 16.7 ms)
- long tasks (>50 ms): 0, total 0 ms

Reading: the ground repaint (throttled to one paint per GROUND.tickMs, 240 ms)
and the shell at idle never block the main thread measurably. The mark's live
canvas only runs while a non-idle state is active; at idle with no run, no
mark canvas is mounted, so its idle cost is zero by construction. Reduced
motion stops the ground repaint loop entirely (paint once, no rAF loop).

Regenerate: start the dev server, then run the sampling snippet from this file
history (or re-add scripts/measure-idle.mjs) and update the numbers here.
