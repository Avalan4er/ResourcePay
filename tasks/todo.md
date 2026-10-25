# Tasks (ResourcePay)

- [x] Phase 1 — Logic core `src/app.js`
  - Acceptance: every export unit-covered (manifest gate green); month calc w/ seeds+gap inheritance & negative warning flag; wide-table CSV exact-shape assertions incl orphan union + garbage money-only cells + #cfg marker block; descriptors return DOM-free data incl totals via stored prices.
  - Verify: `node tests/test.mjs` RED→GREEN, coverage gate no missing exports.
  - Files: src/app.js tests/test.mjs

- [x] Phase 2 — Storage glue `src/storage.js` (OPFS load/save bills.json + Web Worker sync-handle write path; secure-context note)
  - Acceptance: code written & reviewed in this phase alongside phase-3 page so reload-persistence integration evidence comes from BDD features once index.html exists. VERIFIED: `persistence-reload.feature` green (reload + fresh-launch boot diag), storage glue handles Edge/iOS factory-name + read/write-option drift and closes the handle after every op.
  - Verify: review pass + feature `persistence-reload.feature` passing during phase 3 — DONE (`test-results/e2e-run.txt`).
  - Files: src/storage.js (tests/e2e/persistence-reload.feature authored in phase 3)

- [x] Phase 3 — Shell UI `src/index.html`(+`src/style.css`, root entry stub, manifest) + BDD features dir
  - Acceptance: tabs render from descriptors; month entry shows prev/diff/₽/warn rows & saves via storage; history table incl export button both picker (Chromium) and anchor-download path; header toggle flips all charts vol↔money, bars w value labels, garbage money-mode only; settings rename/price/active + seed required when enabling new meter.
  - Verify: e2e features run green Chromium session via control-ui on dev server; unit gate rerun clean (no unlisted new exports). DONE: `node tests/test.mjs` → 13/13 exports; `node tests/e2e/run.mjs` → ALL 63 acceptance checks GREEN in Edge 155 phone viewport (`test-results/e2e-run.txt`, screenshots `test-results/e2e-history.png` / `e2e-charts-money.png`).
  - Files: src/index.html src/style.css src/manifest.webmanifest index.html(root stub) tests/e2e/*.feature

- [x] Phase 4 — Ship polish + deploy verification
  - Acceptance: README setup/deploy steps (GH Pages root stub → `./src/`, secure-context rule, iPhone install flow), manifest standalone, final full test rerun: unit 13/13 + acceptance 63/63 green (`test-results/unit.txt`, `test-results/e2e-run.txt`).
  - Verify: shipping checklist per skills + `git push -u origin main` immediately after this commit (green history check).
  - Files: README.md + re-run all gates

---

# Phase 5 — Unit-layer refactor (`tests/test.mjs`) from the quality review

## Task 5.1 — Delete the false assert convention in `tests/test.mjs`
- Acceptance: value comparisons use `eq(actual, expected)` (node's `strictEqual`, which throws on mismatch — verified 2026-10-25: `eq(1,'1')` and `eq(0,false)` both throw); the three notes claiming "`eq()` is truthiness-based, so zeros/booleans go through `ok()`" (`test.mjs:80/86–87/89`) are deleted along with the idiom they justified. Keep only the line-3 note (why `{ strict as eq }` was replaced) since it documents a real pin.
- Files: tests/test.mjs — Verify: `node tests/test.mjs` green, same 14/14 export gate.

## Task 5.2 — Cover the untested pure-logic rules the review found missing
- Acceptance (new named checks, RED-if-the-rule-regresses):
  - [x] `resolvePrev` never takes a fixed-cost row as an odometer baseline (`app.js:31 && !r.fixed`) — seeded-less meter + garbage-only history ⇒ `prev === null`, not the garbage amount.
  - [x] `buildCsv` exports a negative Δ raw in the Δ cell and its money column negative (`;70;-30;-150,00`), i.e. warning does not clamp saved data — this is what `history-export.feature:7` claimed was covered but had no case.
- Verify: unit gate green with the two new cases; `history-export.feature` bullets 5 and 7 reworded to match tested truth (drop the false "'#cfg' seed lines at bottom" claim vs `app.js` H1 / `test.mjs:66`, and point bullet 7 at the new Δ-cell case).
- Files: tests/test.mjs tests/e2e/history-export.feature tests/e2e/month-entry.feature

## Task 5.3 — Legibility of the unit file (one assertion per line, claims greppable)
- Acceptance: every `run([...])` body is a multi-line block with one assertion per line and a leading one-line why-comment; longest line < ~160 chars; case labels still name the bug ids the ledger greps (`B3/B10/G6/G7/H2` etc.); gate mechanism (`ran`/`fails`/coverage) untouched.
- Files: tests/test.mjs — Verify: `node tests/test.mjs` green + longest-line check.

## Checkpoint after Phase 5
- [x] `node tests/test.mjs` → `OK unit layer — 14/14 exports exercised`, new cases present and green (evidence refreshed in `test-results/unit.txt`, 2026-10-25).
- [x] No `src/app.js` edits, no new deps, no build step (AGENTS self-containment rule holds).
- [ ] Human review before Phase 6 starts (unit is the cheap gate; browser surgery should land on reviewed unit code).

---

# Phase 6 — Evidence-preserving acceptance-harness surgery (`tests/e2e/run.mjs`)

One runner invocation per pass.

## Task 6.1 — Never lose the collected evidence on a mid-pass crash
- Acceptance: each named section is caught; a crash records a FAIL row naming the section + error (e.g. `rowKids` undefined rect at line 76) and the remaining sections still run, so the summary at lines 336–340 always prints. No check weakened, no `chk` skipped.

## Task 6.2 — UI copy comes from `AP.*` only
- Acceptance: 7 hardcoded literals/substrates replaced (`test.mjs`-equivalent keys exist in STR: `nothingEntered`, `seedRequired`, `badNumber`, `applyChanges`, `priceMissing`, `noSeedPrev`, `negativeDiff`) at `run.mjs:93/120/163/228/135/142/174/230`; header comment's "no duplicated literals" promise becomes true.

## Task 6.3 — Months come from the live `<select>`, and the 24-month window gets asserted
- Acceptance: `OPT/M0/M1/OLDEST` read from `select[data-el=month]` options (the `optTexts` read at line 74 already exists) instead of re-deriving `ui.js monthOptions()` at lines 56–57; explicit `chk` that the window length == 24 and ordering is newest-first.
- Landed: months are calendar-derived once in `harness.mjs monthOptions()` (same rule as ui.js), shared by the six modules. B1 chk (`month-entry.mjs`) asserts the live `<select>`: ≥24 `YYYY-MM` options, `optTexts[0] === OPT[0]`, last option === OLDEST.

## Task 6.4 — Kill vacuous-pass class
- Acceptance: helper `all(list, min, pred)` (non-empty + every) replaces unguarded filtered `.every()` at lines 77/83/142/184/235/256; each check states its expected cardinality per the `.feature` bullets ("one row per ACTIVE meter"). Newly-red checks get a diag before any app change — never weaken the guard (AGENTS ledger rule).

## Task 6.5 — `until()` distinguishes harness error from unmet condition
- Acceptance: swallowed evaluate errors print `[wait-error] <expr threw: msg>` once, separate from `[wait-timeout]`, so a typo'd marker is not booked as an app bug in `tasks/bugs*.md`.

## Task 6.6 — Assert the app's own failure channel
- Acceptance: run fails if `document.title` ever starts with `RE:` / `STORAGE-SAVE:` / `STORAGE:` (`ui.js:117/12/119`) or console shows `ResourcePay ... failed:` (the `[c]` logger at line 13 sees it). Today a persist throw still increments `rpSaved`, so G1/S7 round-trip checks pass on a *failed* save.

### Checkpoint: Phase 6
- [x] `node tests/e2e/run.mjs` (fresh OPFS profile) → ALL GREEN with the added assertions; ledger rows re-ticked from fresh GREEN evidence only. Evidence 2026-10-25: **ALL 153 acceptance checks GREEN, exit 0, [elapsed] ~12s** (`test-results/e2e-run.txt`); stale-profile run exits **1** — FAIL rows: precondition, B3, B10 (needs fresh OPFS profile: delete the profile dir before the run).

# Phase 7 — Structural split + threshold-token dedupe

## Task 7.1 — Split `run.mjs`: harness module + per-feature acceptance modules, single entry point
- [x] Acceptance: `tests/e2e/run.mjs` stays the one runner invocation (45-line orchestrator listing the scenario order); helpers moved to `tests/e2e/harness.mjs`; checks grouped into six modules next to their `.feature` docs (`month-entry/settings-config/charts-toggle/history-export/persistence-reload/tap-and-toast .mjs`) so `tasks/bugs*.md` grep hits one short PASS row per claim.
- Shape facts: section names inside modules are the original pass-block/bug-batch keys (`sGroup`, `freshOldestForm`, …); longest lines remain ~540–639 chars (single-statement in-page probes); per-file line counts 21–122 vs old monolith 341.

## Task 7.2 — Thresholds from app tokens, not duplicated literals ✅
- [x] `--warn` read through a probe styled with the custom property (`toastColors` compares against the computed token, replacing the hardcoded `rgb(194, 84, 78)` literal), same pattern as the existing `--ok` green probe; tap-target floor single-sourced as `H.TAP`.
- [x] LANDED 2026-10-25: banner z (`TOAST_Z_MIN`=9), settings input cap (`CTRL_W_MAX`=120), left-hug bound (`LEFT_MAX`=48), meter-row min width (`ROW_W_MIN`=300) and rhythm floor (`GAP_MIN`=4) now live ONCE in `harness.mjs` next to `TAP`, each named with the style.css rule it guards; `month-entry/settings-config/charts-toggle/tap-and-toast` modules read the constants. S4's intra-row rhythm floor is a separate inline 2px literal (not a shared constant).

## Task 7.3 — Delete near-duplicate helpers and sequential round-trips ✅
- [x] Acceptance: `vGaps`/`stackGaps` collapsed to one `gaps(list)`; per-ref loops replaced by batched probes (`rowKidsAll(selectors)`, `visInputs` map inside a single evaluate, geometry read once per selector set) — no per-row await chains left; `[elapsed]`: green runs 12.0–12.2s, pre-split baseline 12.9s.

## Task 7.4 — `diag()` evidence prints only on failure ✅
- [x] Acceptance: `diag()` pushes into `DIAGS`; only a RED run flushes them (`report()` prints `[DIAG]` lines when `bad.length` > 0), so a green run's stdout is just PASS rows + summary. The app-error trail chk prints console-failure lines only when they exist.

## Task 7.5 — Fresh OPFS profile becomes setup code, not out-of-band ritual
- [ ] Unimplemented: fresh-profile scenarios use the manual ritual (kill `msedge.exe` children + delete `E2E_PROFILE` dir); precondition `chk` guards those runs; cross-launch persistence reuses one profile.

### Checkpoint: Phase 7 — tasks 7.1–7.4 landed, 7.5 unimplemented; re-run after threshold move: ALL 153 GREEN, exit 0, [elapsed] 12.1s (2026-10-25T09:17 evidence in `test-results/e2e-run.txt`)
- [x] Single runner invocation (`node tests/e2e/run.mjs`), ALL acceptance checks green, `[elapsed]` not regressed; `tasks/bugs*.md` repro labels resolve to named checks unchanged. Evidence 2026-10-25: **ALL 153 acceptance checks GREEN in Edge phone viewport, exit 0, [elapsed] 12.2s** (was 148 checks / 12.9s before the split), captured in `test-results/e2e-run.txt`; stale-profile run: exit 1, FAIL rows precondition + B3 + B10.
- [x] Ledger cross-check inline (not a new gate file): every bug id named in `tasks/bugs.md` + `tasks/bugs-2.md` resolves either to a green PASS row in the acceptance evidence or to its unit-layer case in `tests/test.mjs` — 31 ids checked, 0 orphaned by the split.

