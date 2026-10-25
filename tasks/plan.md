# Plan: ResourcePay implementation phases

| # | Phase | Delivers | Verify gate | Commit |
|---|--------|----------|-------------|--------|
| 1 | Logic core (`src/app.js`) | month calc w/ seeds & gap inheritance + negative warnings, CSV wide-table builder incl config marker lines, render-descriptor fns (month form / history rows / charts(mode)), number/format helpers, `STR` dict | `node tests/test.mjs` green incl export-coverage gate; TDD RED run first | feat(logic) |
| 2 | Storage glue (`src/storage.js`) | OPFS read/save via Web Worker sync handle (spec pattern), in-memory init, feature-detect secure-context note | integration scenario through control-ui after UI wired (deferred unit for worker handshake once runnable page exists); review notes list it as integration-only until then | feat(storage) bundled into phase 3 commit when page exists |
| 3 | App shell UI (`src/index.html`, `src/style.css`) + entry stub root + manifest | tabs Bills/History/Charts/Settings mobile-first cute, descriptors → DOM glue only (DOM functions declared integration-only), month-entry form w prev labels+diffs+money+warnings, history table w export button both picker/anchor paths, header chart toggle volume/money, settings rename/price/enable+seed-required create | `tests/e2e/*.feature` runs green in Chromium (picker + fallback paths checked separately on non-Chromium), OPFS persistence survives reload; unit gate still green (no new app.js exports unlisted) | feat(ui)+feat(storage) together once scenarios pass |
| 4 | Ship polish | README deploy/setup doc, GH Pages link confirmation (entry stub meta-refresh per spec decision), manifest start_url sanity, screenshots via control-ui for cute-mobile look | launch checklist from shipping phase skill, tests rerun on final tree | docs+chore final commit + push -u origin main |

Code-review pass (**thermo-nuclear-code-quality-review**) runs after EACH phase before next starts; fixes folded into same phase commit. Phase 2 stays code-only until its integration evidence exists (storage.js written with UI page present so e2e can prove reload-persistence); unit coverage manifest covers `app.js` exports only — storage/DOM/picker names live in the named integration-only list from Testing strategy, enforced by review pass + AGENTS note rather than node gate.

Dependency order: 1 → (3 shell needed before 2's evidence) → run 2 coding alongside 3 once index page exists → 4 last. Tasks file tracks granular done/steps.

---

# Test-quality refactor — record of landed state (facts, 2026-10-25)

Detailed task ledger with evidence: `tasks/todo.md` Phases 5–7. How to run both gates: `tasks/test-deps.md`.

- Unit gate is one file: `tests/test.mjs` imports `{ strictEqual as eq } from 'node:assert/strict'`, keeps the `ran`/coverage manifest; green = every `src/app.js` export exercised (`test-results/unit.txt`).
- Acceptance layer shape: `tests/e2e/run.mjs` orchestrator (scenario order + exit rule) + `tests/e2e/harness.mjs` (launch/teardown, waits, probes, thresholds `TAP=40 GAP_MIN=4 CTRL_W_MAX=120 LEFT_MAX=48 ROW_W_MIN=300 TOAST_Z_MIN=9`) + six claim modules keyed by the `.feature` docs; section names inside them are the original bug-batch keys (`sGroup`, `freshOldestForm`, …).
- Month labels: calendar-derived once in `harness.mjs monthOptions()` (same rule as ui.js); the live `<select>` window is asserted from DOM options by B1 (≥24 `YYYY-MM` entries, first===OPT[0], last===OLDEST).
- Fresh-state runs still use the manual profile ritual (kill `msedge.exe` children + delete `E2E_PROFILE` dir); runner-seeded clean profiles are NOT implemented — precondition chk guards those runs.
