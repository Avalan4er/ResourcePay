# Test tooling (not shipped)

`package.json` exists only to hold the browser-automation harness as a **devDependency**: `playwright-core`, launched against the Chromium-family browser already on this machine (`msedge.exe`), so nothing is downloaded and the PWA itself stays dependency-free / build-step-free.

Run gates:
1. `node tests/test.mjs` — unit layer (all `src/app.js` exports + coverage manifest gate).
2. `python -m http.server 8123 --bind 127.0.0.1` then `node tests/e2e/run.mjs` — BDD acceptance layer in a real browser (`tests/e2e/*.feature`).

Notes:
- The harness drives only stable `data-*` markers and asserts buttons via presence + JS-dispatched click; whole-tab re-render makes Playwright's actionability wait time out on stale nodes (that is a harness artifact, not a missing button).
- Picker branch (`window.showSaveFilePicker`) is Chromium-gated: the chooser click needs a real user gesture, so the runner only asserts the button exists — check filename/bytes by hand in Chrome.
- Test data stays local + disposable: profile dir under `C:\Users\avalan4er\AppData\Local\Temp\opencode`, screenshots in `test-results/` (gitignored). Deleting the profile dir before a run makes that run prove boot-from-empty; leaving it lets the next run's `[DIAG] bootState` line show months survived a fresh browser launch.
- Killed harness runs leave headless `msedge.exe` children holding the profile lock → the next `launchPersistentContext` dies with "Target page, context or browser has been closed". Kill every `msedge.exe` first (`taskkill /F /IM msedge.exe /T`) and clear the profile dir before a clean-state run.
- Headless Edge never fires `requestAnimationFrame` reliably → any rAF-based settle probe hangs forever. Wait on repeated `page.evaluate` round-trips (rect stops changing) or on a structural marker instead; that is what `until()`/`frames()` in `run.mjs` now do.
- Unit-layer gotcha while fixing H2/B7: `tests/test.mjs` used to import `{ strict as eq } from 'node:assert'`, which binds node's **truthiness** assertion — every numeric comparison there was vacuous (`eq(1,2)` passed, `eq(0,0)` threw with message `0`). Re-pinned 2026-10-25 to `{ strictEqual as eq } from 'node:assert/strict'`; keep that import. Zero-valued and boolean expectations are now asserted through `ok(x === …)` where the message must stay readable (e.g. `clearHistory`, garbage money).
- Acceptance-harness rule that bit bug batch 2: markers are per-tab, so reading `.cfgNew`, `.chart` or History rows requires `tab(…)` first — a check aimed at another tab's card returns null and launders nothing (it stays RED, but the RED was the harness, not the app). Ledger records those separately in tasks/bugs-2.md.
- iPhone-only behaviors that the desktop harness cannot prove stay manual: Safari ignores `<a download>`; shrink-to-fit re-zoom on tapping a field (mitigated by `width=device-width,initial-scale=1,shrink-to-fit=no` in `src/index.html`, verified only as computed meta + full-size tap targets).
