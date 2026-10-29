# Spec: ResourcePay — monthly bills tracker PWA

## Objective

A personal bills-tracker PWA for one person's flat, used primarily from an iPhone (mobile-first, minimal desktop compatibility), hosted as free static files on GitHub Pages. Tracks monthly bills and their history so the user can see what they spend per month without Excel.

User stories:
1. **Monthly entry tab** — for each configured meter (gas/electricity/water) show previous reading from history; user enters new *integer* meter value; app shows volume diff and money spent (= diff × ₽/unit price stored in that month's record, editable). Garbage is a fixed monthly ₽ amount entered per month. Saving the month appends a self-contained history record (readings + prices used for that month, all editable afterwards). Unit price can be changed during entry (by default — previous month's) and saved to history.
2. **History tab** — list of past months; header has one button to save/share full backup as CSV via browser save-file dialog (`showSaveFilePicker`), with `<a download>` fallback where the picker doesn't exist. Backup filename `resourcepay-backup-YYYY-MM-DD.csv`, prefix string lives in `STR`.
3. **Charts tab** (its own tab) — one bar chart per active resource, x-axis = months; a single switch in the page header flips **all** charts on that page between volume bars (m³/kWh) and money bars (₽). Value labels: volume mode paints each integer value above its bar; money mode lists month→₽ values in a horizontal legend line under the chart (long ₽ figures don't fit above 42px slots). Pure DOM/CSS bars, no chart library.
4. **Settings tab** — configure meters: rename, unit price, enable/disable (e.g. two gas meters, no water); enabling a meter requires its baseline "latest known reading" (`seed`), which first bills are computed against. Also a **Clear saved months** action (`clearHistory` pure export + DOM glue): wipes `history` only, never config/meters; needs two consecutive taps inside the Settings tab (first tap arms and paints the confirm copy, leaving Settings disarms) so a phone tap can't lose every month by accident.

Data model (JSON state):
- `config`: list of resources `{id, name, unit, price, active, seed}`; garbage is a fixed-cost resource (`unit` = ₽/month). `seed` = latest known meter reading captured when the meter was created/enabled (int|null; required for meters at creation — Settings form makes it non-skippable), used as its baseline `prev`; self-declared baseline, not forced to today.
- `history`: entries `{month: "YYYY-MM", rows: [{ref → config id, prev (int|null), curr (int for meters | monthly ₽ for garbage), price}]}`; newest first; a row's `prev` = latest stored reading of that meter in an earlier month regardless of gaps, falling back to its `seed` if no history predates it — so first run and newly configured meters still bill real money (never lifetime-total bug). Household meters are assumed cumulative odometer-style registers; if any meter logs *per-period* volumes instead, that meter's flow needs revisiting.
- Fixed-cost rows have no price multiplier anywhere: `rowMoneyOf` returns the entered absolute `curr`, neither the Bills row nor its Settings row exposes a `@ price` control, and `fieldRow` omits the prev/baseline line for them so build and refresh paths agree (no "no baseline yet" noise). Historical garbage rows keep their entered amounts.

Persistence: all app data lives persistently in **OPFS** via standard `navigator.storage.getDirectory()` — supported natively on Chrome ≥86, Edge, Firefox ≥111, Safari iOS ≥15.2 (iPhone works; no service worker, no IndexedDB fallback). File read/write runs in a dedicated Web Worker (`createSyncAccessHandle` is only legal there). OPFS survives reloads/restarts until the user clears browser storage; reinstall-survival is out of scope.

CSV layout (wide table, one line per month — direct Excel use):
- History-only file: one schema/datestamp marker line + header + month rows; **no `#cfg` metadata lines** (settings/seed values read as noise on the iPhone, and a fresh-device restore would need an out-of-scope importer). A cleared state's CSV is marker+header only.
- Encoding: UTF-8 **BOM**, `;` separator, comma decimals everywhere (2 dp money), integer readings/volumes ungrouped, chronological oldest→newest.
- Column set = current config meters ∪ every meter ref ever seen in history rows (deleted/disabled keep their columns — orphan safety), stable per export by first appearance; headers are language-symbol based (`<meter name>`, `Δ <meter name>`, `<meter name> ₽`…, trailing `₽ = total`); names come from config so RU translation flows through data.
- Per meter three columns `(absolute reading ; consumed Δ ; money)`. Garbage fills only its money column, the other two cells blank.
- Meter money is computed from **that row's stored price snapshot**, never current config — later edits cannot mutate historical numbers; garbage money is its entered `curr` (no multiplier). Total cell = Σ that row's meter+garbage money. Negative Δ rows export raw negatives (UI warns only, data intact).

Interface: all UI strings come from one `STR` dictionary of English values — user hand-translates to Russian later; code must not hardcode display text elsewhere. Currency shown as rubles with exactly 2 decimals after a **comma** (`58,10 ₽`); volumes are integers. Color: dual MD3 schemes on one role ladder — balanced bluish light (default) + dark via `prefers-color-scheme` (design v2, tasks/design-v2.md); `theme-color` meta carries matching light/dark media variants.
- Toasts carry an honest kind: `data-kind=ok|err`; success copy paints the app's green `--ok`, error copy keeps `--warn` and stays until acted on; toast is `position:fixed` with safe-area inset above the tab strip (z-index) and `pointer-events:none` so it never covers a tappable control.
- The volume/money control is one flex row (`.card .swRow`) of two CSS-drawn pills (`.modeSw`): each pill owns its STR label plus a CSS dot (`i.knob`) that turns the app's `--ok` green when selected; an invisible full-track radio (`appearance:none`, transparent) is the tap target and keeps `data-el=modeToggle` a real radio (exactly one checked; tapping the other flips every chart).
- Viewport pins zoom like an app: `width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=1,shrink-to-fit=no,viewport-fit=cover`, and every painted control (Bills/Settings inputs, month `<select>`, Settings checkboxes, tab/card buttons, switch tracks) carries `touch-action:none`. Accessibility tradeoff recorded honestly: WCAG 1.4.4 "zoom" is no longer served by browser pinch; low-vision users rely on OS-level accessibility zoom (iOS applies it regardless of this meta) plus the app's own clamp() type scale (tasks/bugs-3.md Z1).

## Tech stack

- Static files only: HTML + CSS + vanilla ES modules, no framework, no dependencies, no build step, GitHub Pages compatible (same-origin, https); multi-file hosting, not single self-contained file.
- Storage: OPFS (`navigator.storage.getDirectory()` + dedicated Web Worker for sync-handle writes); everything same-origin. NO service worker, NO IndexedDB.
- CSV download button: `showSaveFilePicker` first (Chromium), falls back to `<a download>` blob link (Safari has OPFS but no pickers); on iOS the file lands in Files/downloads app — acceptable backup UX.
- Tests: Node built-in `node:test`/assert against every exported `src/app.js` function (pure logic + render *descriptors*); acceptance scenarios (BDD-style) executed through the `control-ui` skill harness. Coverage gate inside `tests/test.mjs` fails if any export lacks a unit case.

## Commands

```
Dev server :  python -m http.server 8123 --bind 127.0.0.1   (any static server; OPFS needs a secure context — localhost or https, not file://)
Unit tests :  node tests/test.mjs          (run before declaring done; includes export-coverage gate)
Browser test:  control-ui skill harness against the dev server
```

## Project structure

Source and tests live in their own directories, not scattered at the repo root:

```
src/
  index.html              → app shell only: viewport/theme meta, stylesheet links (tokens before components), module scripts
  tokens.css              → MD3 design-token layer: vendored Material Icons @font-face (src/material-icons.woff2) + one balanced bluish scheme as md.sys-style color roles (--surface/--primary/--ok/--warn…) + 8dp spacing scale, shape tokens, --tap — zero component selectors
  style.css               → MD3 component layer on those tokens: flat edge-to-edge sheets (no card containers/gradients/shadows), navigation-bar tabs strip with underline active indicator, outlined fields, segmented pills — no UI strings
  ui.js                   → integration-only DOM/picker/event glue (tabs render, ICON ligature spans, mode switch): imports app.js descriptors + storage.js; the STR dictionary lives in app.js
  app.js                  → pure logic + state handling (config defaults, month calc, CSV build) AND render *descriptors* (`describeMonthForm`, `describeHistoryRows`, `describeCharts(mode)` — state → data, DOM-free); testable in Node; imported by ui via <script type="module" src="./app.js">
  storage.js              → OPFS: load/save bills.json via navigator.storage.getDirectory() (+ Web Worker createSyncAccessHandle for writes)
  material-icons.woff2    → vendored Google Material Icons font (v145), self-hosted — SPEC bans CDN fonts and build steps
  manifest.webmanifest    → PWA manifest (start_url "./", display standalone)
index.html                → root entry: ~6-line meta-refresh stub redirecting to ./src/index.html (GH Pages bare /<repo>/ needs an entry; all real code stays under src/)
tests/
  test.mjs                → node:test against ../src/app.js exports + CSV shape builder; carries the export-coverage manifest (every exported fn listed → must have ≥1 case)
  e2e/                    → Gherkin-flavored acceptance features (month-entry.feature, history+csv-export.feature, charts-toggle.feature, settings-config.feature, first-run-seed.feature, persistence-reload.feature…) executed via control-ui against the dev server
SPEC.md AGENTS.md README.md   → docs at repo root only
```

## Code style

```js
// Pure, stateless helpers; UI only reads results. No classes unless they carry real behavior.
// prev = latest earlier row for that meter, else config seed (first run / newly added meter — never lifetime-total):
const prevRow = history.find(r => r.month < month && r.ref === cfg.id);
const prev = prevRow?.curr ?? cfg.seed;
const vol = rec.curr - prev;                     // meters; garbage: vol null, money = rec.curr
if (vol < 0) row.warnings.push(STR.negativeDiff); // warn-but-save OK — replaced meter; never silently fix data

STR.garbageTab || fallback…                      // NEVER inline display text in templates
```
- Naming: `lowerCamelCase` js ids, kebab for css classes/ids, `SCREAMING_SNAKE` for constants like `STR`.
- Numbers: UI via `Intl.NumberFormat('ru-RU', {minimumFractionDigits: 2, maximumFractionDigits: 2})` + literal `" ₽"` suffix → `"1 234,50 ₽"` (narrow-nbsp thousands); CSV numbers ungrouped with comma decimal (`1234,50`) so RU Excel parses them; `fmtInt()` plain integer.

## Testing strategy

- **Unit layer (fast, headless, most of the pyramid):** `node tests/test.mjs` must exercise *every* exported function from `src/app.js` incl pure render-descriptors and CSV builder — enforced by a manifest constant: an export not present in its list fails the run (same-commit rule: any new app.js export must appear in tests). Cases to keep green: month calculation (diff, money incl garbage), first-ever reading uses `seed` baseline not zero, newly enabled meter mid-history seeds correctly, price edit of a past month, CSV line building (one row per month `(absolute;Δ;money)` group per meter in config∪history order + total ₽ column; garbage blanks reading/Δ cells; money/total from each row's stored prices; negative Δ exported raw), config enable/disable filtering, gap months inherit last-known prev, negative diff (`curr < prev`) returns a warning flag while saving.
- **Browser/BDD layer (small, ~5% pyramid top):** acceptance features in `tests/e2e/*.feature` written Gherkin-style and executed by the `control-ui` skill harness on the running dev server — each Success criterion gets its own scenario: month-entry→saves+instant diff/₽; re-entering same month updates not duplicates; charts toggle volume/money everywhere + one chart/active meter incl garbage bar = monthly cost; settings enable/disable/rename/price visible in entry form & CSV column set (e.g. 2 gas meters, no water); clear-months two-tap confirm; History-tab button → `showSaveFilePicker` on Chromium vs `<a download>` elsewhere, file layout as specced + orphan meter columns kept; rubles render `d,d0` comma, volumes integer everywhere.
- **Named integration-only glue (honest exceptions to "every function unit-tested"):** DOM apply fns (`applyDescriptor`), picker trigger flow, OPFS read/write wrappers + Web Worker sync-handle bridge in `storage.js`, event/tab binding in index.html script — covered solely by the BDD features; their internal logic is already delegated to pure units above. A new untested export added to app.js or a new glue fn not tied to any e2e scenario both fail "done" (unit gate or review note).
- Paint/geometry claims read **computed styles** (`appearance`, background, knob colour vs the app's own `--ok` token, pill rects side-by-side) so a future WebKit/Edge paint regression goes RED locally instead of silently; only Safari's real zoom gesture stays manual-verify (tasks/test-deps.md + tasks/bugs-3.md Z1).
- Gate order: unit tests green → then browser flow run before declaring done/commit.

## Boundaries

- **Always:** run unit tests green before "done" (coverage manifest included), then execute the `tests/e2e/*.feature` acceptance runs through control-ui; keep everything same-origin static; keep strings only in `STR`; no external deps/CDN/Google Fonts.
- **Ask first:** adding any dependency, changing storage model (OPFS-native decision settled).
- **Never:** commit secrets, edit vendor code (there is none), add a build step, put UI strings outside `STR`.

## Success criteria

1. Entering readings for a month computes per-meter volume + ₽ instantly and saves a history record that survives a reload, tab switch and PWA relaunch (OPFS persists across sessions until the user clears browser storage; reinstall-survival out of scope).
2. Re-entering the same month updates its record rather than duplicating.
3. Charts tab shows exactly one chart per active resource; header switch flips every chart between m³/kWh bars and ₽ bars; heights proportional to values; garbage bar = monthly cost.
4. Settings enable/disable + rename + price changes reflected in entry form, history CSV row set and charts (e.g. 2 gas meters, no water).
5. History-tab button triggers `showSaveFilePicker` CSV save in Chromium; on Safari produces the same CSV via anchor download; file follows the wide-table layout above (meter groups `(absolute;Δ;money)` ordered by config∪history, total ₽ column per row, garbage money-only cells) and keeps deleted/disabled meters' historical columns intact.
6. Rubles render `d,d0` (2 decimals, comma); meter values are integers everywhere.
7. First-ever or newly configured meter bills from its seed baseline (no lifetime-total bug); gap months inherit the latest known reading; if a saved row has `curr < prev`, a per-row inline warning shows but the save still succeeds (meter replaced mid-history).
8. Clear saved months needs two consecutive Settings-tab taps and wipes history only; after clearing, config/meters stay intact and the CSV is marker+header only.
