# Test tooling (not shipped)

`package.json` exists only to hold the browser-automation harness as a **devDependency**: `playwright-core`, launched against the Chromium-family browser already on this machine (`msedge.exe`), so nothing is downloaded and the PWA itself stays dependency-free / build-step-free.

Run gates:
1. `node tests/test.mjs` — unit layer (all `src/app.js` exports + coverage manifest gate).
2. `python -m http.server 8123 --bind 127.0.0.1` then `node tests/e2e/run.mjs` — BDD acceptance layer in a real browser (`tests/e2e/*.feature`).

Notes:
- The harness drives only stable `data-*` markers and asserts buttons via presence + JS-dispatched click; whole-tab re-render makes Playwright's actionability wait time out on stale nodes (that is a harness artifact, not a missing button).
- Picker branch (`window.showSaveFilePicker`) is Chromium-gated: the chooser click needs a real user gesture, so the runner only asserts the button exists — check filename/bytes by hand in Chrome.
- Test data stays local + disposable: profile dir under `C:\Users\avalan4er\AppData\Local\Temp\opencode`, screenshots in `test-results/` (gitignored). Deleting the profile dir before a run makes that run prove boot-from-empty; leaving it lets the next run's `[DIAG] bootState` line show months survived a fresh browser launch.
