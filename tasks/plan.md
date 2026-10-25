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

# Plan: test-quality refactor (post-review, `@thermo-nuclear-code-quality-review` of `tests/`)

Review verdict was "do not approve": 6 structural blockers in the acceptance harness + unit-layer convention rot + 2 spec/tests drifts. Phases below keep the AGENTS rules: unit green first → then browser layer → only then done/commit, one runner invocation per pass, no new runtime deps or build step (the unit gate stays `node tests/test.mjs`).

## Dependency graph (what must land first)

```
unit layer (tests/test.mjs)                ← no dependency on the browser; cheapest evidence
    │  convention + missing pure-logic cases
    ├── history-export.feature spec drift   ← doc fix backed by the new unit cases
    │
    e2e run.mjs — keep working TODAY         ← evidence-preserving surgery first
        │  section-catch (90 PASS/FAIL rows survive a crash), until() [wait-error],
        │  STR copy via AP.*, months from the live <select>, all() non-empty guard,
        │  error-trail assertion (title RE:/STORAGE + console)
        └── run.mjs split into harness module + per-feature acceptance modules
                └── threshold literals → app CSS tokens (--ok/--warn/--tap/z-index/rem)
                        └── fresh OPFS profile seeded per scenario (kills the taskkill ritual)
```

## Architecture decisions

- **Evidence before elegance:** `run.mjs` crashes today abort the run *before* printing collected PASS/FAIL rows (`rowKids` → `undefined[2]` TypeError). Fixing that first makes every later change diagnosable; do not fold it into the module split.
- **One assertion per `chk`, label = the claim.** The ledger in `tasks/bugs.md` greps bug ids; today claims are buried in 594-char lines and compound conjunctions mix causes into one RED.
- **No vacuous truth:** filtered `.every()` over an empty list passes (lines 77/83/142/184/235/256). Introduce `all(list, min, pred)` so cardinality is stated and a missing card can never be green.
- **Copy comes from STR only** (`AP.*`), thresholds come from CSS custom properties only, dates come from the DOM's own `<select>` only — three literals-families deleted, not moved. App already proves this precedent (`test.mjs:61`, `run.mjs:309 "one rule, no counted literals"`).
- **Unit gate stays a single file** (`import * as A from '../src/app.js'` + `ran` manifest gate); reformatting buys legibility without new module plumbing. The e2e split is where modules go (per `.feature` file), because that file has ~90 claims worth grouping.
- **LANDED 2026-10-25 (deviation):** section names inside the six modules keep the original pass-block/bug-batch keys (`sGroup`, `freshOldestForm`, …) rather than one function per feature bullet — claims stay greppable per bug id and batch history survives; months are calendar-derived ONCE in `harness.mjs` (same rule as ui.js) instead of read from the live `<select>`, because coupling date math to Bills-tab visit order inside a single persistent pass was not worth it — B1 asserts the window from DOM options instead, so ui.js drift still goes RED.
- **Ledger rule honored:** new bug-backing cases get named repro checks; harness fixes land as separate commits, ledger re-ticked only on fresh GREEN acceptance evidence — never folded into a bug fix.

## Risks and mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Section-catch hides which section died | Med | Each crash recorded as a named FAIL row + `[wait-error]` line; ledger ids stay in labels |
| `all(list,min,pred)` changes existing RED/GREEN meaning (a currently-vacuous check goes red) | High — expected: those checks were lying | Each newly-red check gets a diag first; fix the app or the selector, never weaken the guard |
| STR copy via `AP.*` flips 7 assertions at once if copy drifts | Low | That is the point: they stop lying, not start lying |
| Months from DOM (`select[data-el=month]`) makes M0/M1/OLDEST depend on B1 being green | Med | Order task B2 after B1 evidence exists; assert the 24-window explicitly (never asserted today) |
| Module split changes "one runner invocation" promise | Med | Keep `tests/e2e/run.mjs` as the single entry point importing sections; still one playwright context, no fixed sleeps |
| Fresh per-scenario OPFS profile re-seeding breaks cross-launch persistence evidence (`persistence-reload.feature`) | High | Only fresh-profile scenarios get a clean dir; persistence scenario keeps the reusable profile — and `tasks/test-deps.md` documents both dirs |
| Deleting stale unit comments loses the pin history | Low | Keep the one true note (line 3: why `{ strict as eq }` was replaced), drop the three false ones after switching to `eq(a,b,msg)` |

## Open questions (need human before Phase C)

- Should per-feature acceptance modules be one file per `.feature` (5 files) or sections keyed by bug-batch (`part A/B/C`)? Feature-file keyed matches the BDD docs and the ledger better; batch-keyed matches current comment structure.
- Threshold via CSS tokens assumes computed style exposes custom props to `getComputedStyle(document.documentElement).getPropertyValue('--tap')` — verify once in the real browser before rewriting the 6 geometry checks.
