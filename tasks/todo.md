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

