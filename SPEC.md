# Spec: ResourcePay — monthly bills tracker PWA

## Objective

A personal bills-tracker PWA for one person's flat, used primarily from an iPhone (mobile-first, minimal desktop compatibility), hosted as free static files on GitHub Pages. Tracks monthly bills and their history so the user can see what they spend per month without Excel.

User stories:
1. **Monthly entry tab** — for each configured meter (gas/electricity/water) show previous reading from history; user enters new *integer* meter value; app shows volume diff and money spent (= diff × ₽/unit price stored in that month's record, editable). Garbage is a fixed monthly ₽ amount entered per month. Saving the month appends a self-contained history record (readings + prices used for that month, all editable afterwards). Unit price can be changed during entry (but by default - use previous) and saved to history.
2. **History tab** — list of past months; header has one button to save/share full backup as CSV via browser save-file dialog (`showSaveFilePicker`), with `<a download>` fallback where the picker doesn't exist.
3. **Charts tab** (its own tab) — one bar chart per active resource, x-axis = months; a single toggle in the page header switches **all** charts on that page between volume bars (m³/kWh) and money bars (₽). Value labels above bars. Pure DOM/CSS bars, no chart library.
4. **Settings tab** — configure meters: rename, unit price, enable/disable (e.g. two gas meters, no water); enabling a meter requires its baseline "latest known reading" (`seed`), which first bills are computed against.

Data model (JSON state):
- `config`: list of resources `{id, name, unit, price, active, seed}`; garbage is a fixed-cost resource (`unit` = ₽/month); meter prices default from config but each history record snapshots its own prices. `seed` = latest known meter reading captured when the meter was created/enabled (int|null; required for meters at creation — Settings form makes it non-skippable), used as their baseline `prev`.
- `history`: entries `{month: "YYYY-MM", rows: [{ref → config id, prev (int|null), curr (int for meters | monthly ₽ for garbage), price}]}`; newest first; a row's `prev` = latest stored reading of that meter in an earlier month regardless of gaps, falling back to its `seed` if no history predates it — so first run and newly configured meters still bill real money (never lifetime-total bug).

Persistence requirement: all app data lives persistently in **OPFS** via the standard `navigator.storage.getDirectory()` (File System API), supported by Chrome/Edge/Firefox/Safari iOS 15.2+ — works on iPhone, no service worker needed. File read/write runs in a dedicated Web Worker (`createSyncAccessHandle` is only legal there). OPFS survives reloads/restarts; Safari lets users view/clear it via Settings. No IndexedDB fallback (modern-browser assumption ≥ iOS 15.2 / Chrome 86 / Firefox 111, see research note). CSV exports the full state (config + history) either way.

CSV layout (wide table, one line per month — for direct Excel use):
- Encoding: UTF-8 **BOM**, `;` separator, comma decimals everywhere (2 dp money); integer readings/volumes ungrouped. Chronological oldest→newest rows.
- Column order is a union of current config meters ∪ every meter ref ever seen in history rows (deleted/disabled ones keep their columns — orphan safety), stable per export sorted by first appearance; header cells are language-symbol based: `<meter name>`, `Δ <meter name>`, `<meter name> ₽` repeated, plus trailing `₽ = total`. Meter names come from config/name-dictionary so RU translation flows through data automatically.
- Per meter group three columns `(absolute reading at that month ; consumed Δ ; money)`. Garbage fixed-cost resource has only its money column filled (`<garbage name> ₽`) with the other two cells left blank.
- Money values are always computed from **that row's stored price snapshot**, never current config prices — editing prices or seeds later cannot mutate historical CSV numbers. Total cell = Σ of that row's meter+garbage money (same snapshots). Negative Δ rows export raw negatives (UI warns only, data intact).
- After the month rows, `#`-prefixed metadata lines hold settings for restore use: one line per config entry `#cfg <id>;<name>;<unit>;active;<price>;<seed>` plus schema/datestamp header line. Marker prefix keeps them out of Excel's numeric table while a future importer can parse them (import feature itself remains out of scope).

Interface: all UI strings come from one `STR` dictionary of English values — user hand-translates to Russian later; code must not hardcode display text elsewhere. Currency shown as rubles with exactly 2 decimals after a **comma** (`58,10 ₽`); volumes are integers.

## Tech stack

- Static files only: HTML + CSS + vanilla ES modules, no framework, no dependencies, no build step, GitHub Pages compatible (same-origin, https).
- Storage: OPFS (`navigator.storage.getDirectory()` + dedicated Web Worker for sync-handle writes); no external deps, everything same-origin. NO service worker, NO IndexedDB.
- Tests: Node built-in `node:test`/assert against every exported `src/app.js` function (pure logic + render *descriptors*); acceptance scenarios (BDD-style) executed through the `control-ui` skill harness. Coverage gate inside `tests/test.mjs` fails if any export lacks a unit case.

## Commands

```
Dev server :  python -m http.server 8000   (any static server; OPFS needs a secure context — localhost or https, not file://)
Unit tests :  node tests/test.mjs          (run before declaring done; includes export-coverage gate)
Browser test:  control-ui skill harness against the dev server
```

## Project structure

Source and tests live in their own directories, not scattered at the repo root:

```
src/
  index.html              → app shell: tabs UI, rendering, STR string dictionary; entry stub redirect at /<repo>/src/… (see note below)
  style.css               → mobile-first cute styling
  app.js                  → pure logic + state handling (config defaults, month calc, CSV build) AND render *descriptors* (`describeMonthForm`, `describeHistoryRows`, `describeCharts(mode)` — state → data, DOM-free); testable in Node; imported by index via <script type="module" src="./app.js">
  storage.js              → OPFS: load/save bills.json via navigator.storage.getDirectory() (+ Web Worker createSyncAccessHandle for writes)
  manifest.webmanifest    → PWA manifest (start_url "./", display standalone)
tests/
  test.mjs                → node:test against ../src/app.js exports + CSV shape builder; carries the export-coverage manifest (every exported fn listed → must have ≥1 case)
  e2e/                    → Gherkin-flavored acceptance features (month-entry.feature, history+csv-export.feature, charts-toggle.feature, settings-config.feature, first-run-seed.feature, persistence-reload.feature…) executed via control-ui against the dev server
SPEC.md AGENTS.md README.md   → docs at repo root only
```

GH Pages note: the bare project link `/<repo>/` needs an entry — either keep a ~6-line meta-refresh `index.html` stub in the root pointing to `./src/index.html`, OR use the GitHub Pages custom-404 trick (`404.json` with `{"permalink": "/src/index.html"}`). Either way all real code stays under `src/`. DECIDED 2026-10-24: meta-refresh stub in root.

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

- **Unit layer (fast, headless, most of the pyramid):** `node tests/test.mjs` must exercise *every* exported function from `src/app.js` incl pure render-descriptors and CSV builder — enforced by a manifest constant: an export not present in its list fails the run. Existing cases to keep green: month calculation (diff, money incl garbage), first-ever reading uses `seed` baseline not zero, newly enabled meter mid-history seeds correctly, price edit of a past month, CSV line building (one row per month: `(absolute;Δ;money)` group per meter in config∪history order + total rubles column; garbage blanks reading/Δ cells; money/total computed from each row's stored prices; negative Δ exported raw), config enable/disable filtering, gap months inherit last-known prev, negative diff (`curr < prev`) returns a warning flag while saving.
- **Browser/BDD layer (small, ~5% pyramid top):** acceptance features in `tests/e2e/*.feature` written Gherkin-style and executed by the `control-ui` skill harness on the running dev server — each Success criterion 1–7 gets its own scenario: month-entry→saves+instant diff/₽; re-entering same month updates not duplicates; charts toggle volume/money everywhere + one chart/active meter incl garbage bar = monthly cost; settings enable/disable/rename/price visible in entry form & CSV column set (e.g. 2 gas meters, no water); History-tab button → `showSaveFilePicker` on Chromium vs `<a download>` elsewhere, file layout as specced + orphan meter columns kept; rubles render `d,d0` comma, volumes integer everywhere.
- **Named integration-only glue (honest exceptions to "every function unit-tested"):** DOM apply fns (`applyDescriptor`), picker trigger flow, OPFS read/write wrappers + Web Worker sync-handle bridge in `storage.js`, event/tab binding in index.html script — covered solely by the BDD features; their internal logic is already delegated to pure units above. A new untested export added to app.js or a new glue fn not tied to any e2e scenario both fail "done" (unit gate or review note).
- Gate order per AGENTS reminder: unit tests green → then browser flow run before declaring done/commit.

## Boundaries

- **Always:** run unit tests green before "done" (coverage manifest included), then execute the `tests/e2e/*.feature` acceptance runs through control-ui; keep everything same-origin static; keep strings only in `STR`; no external deps/CDN/Google Fonts.
- **Ask first:** adding any dependency, changing storage model (OPFS-native decision settled 2026-10-24 — see research note).
- **Never:** commit secrets, edit vendor code (there is none), add a build step, put UI strings outside `STR`.

## Success criteria

1. Entering readings for a month computes per-meter volume + ₽ instantly and saves a history record that survives a reload, tab switch and PWA relaunch (OPFS persists across sessions until the user clears browser storage; "survives OS-app reinstall" is NOT required — out of scope).
2. Re-entering the same month updates its record rather than duplicating.
3. Charts tab shows exactly one chart per active resource; header toggle flips every chart between m³/kWh bars and ₽ bars; heights proportional to values; garbage bar = monthly cost.
4. Settings enable/disable + rename + price changes reflected in entry form, history CSV row set and charts (e.g. 2 gas meters, no water).
5. History-tab button triggers `showSaveFilePicker` CSV save in Chromium; on Safari produces the same CSV via anchor download; file follows the wide-table layout above (meter groups `(absolute;Δ;money)` ordered by config∪history, total ₽ column per row, garbage money-only cells) and keeps deleted/disabled meters' historical columns intact.
6. Rubles render `d,d0` (2 decimals, comma); meter values are integers everywhere.
7. First-ever or newly configured meter bills from its seed baseline (no lifetime-total bug); gap months inherit the latest known reading; if a saved row has `curr < prev`, a per-row inline warning shows but the save still succeeds (meter replaced mid-history).

## Open questions

(none — all finalized 2026-10-24, see Resolved decisions below)

## Decisions log

- Charts separate from history tab; single volume/money toggle for all charts on the chart page (user correction).
- Structure: app sources under `src/`, tests under `tests/` (user directive 2026-10-24); GH Pages entry stub in root via meta-refresh redirect (DECIDED); static multi-file hosting (not single self-contained file) — user choice.
- Multi-file static hosting (index.html + css/js/manifest files in repo), not single self-contained file — user choice.
- Tests layering refined (idea-refine session 2026-10-24): unit pyramid = every `src/app.js` export incl pure render-descriptor fns enforced by coverage manifest in `tests/test.mjs`; top of pyramid = Gherkin-flavored acceptance features under `tests/e2e/` run through the **control-ui CDP harness** (no external runner deps); DOM/OPFS/picker glue gets a named integration-only list instead of fake-DOM units — user picks confirmed on both engine + layering forks. DECIDED: same-commit rule that any new app.js export must appear in tests (gate fails otherwise).
- Meter first-run/baseline semantics (idea-refine session 2026-10-24): each meter carries `seed` = latest known reading required at creation; `prev` resolves as last earlier row else seed — covers first run, newly enabled meters and gap months uniformly. DECIDED: user phrased "not current but latest reading" so seed is self-declared baseline, not forced to today.
- Negative diff (`curr < prev`) shows inline warning but still saves (meter replaced mid-history); no auto-correction of data. DECIDED.
- Betting assumption (unvalidated against physical devices): household gas/water/electricity registers are cumulative odometer-style values, so seed baseline is the correct zero-point model — if any meter logs *per-period* volumes instead, that meter's flow needs revisiting.
- CSV switched from one narrow line per meter-row to Excel-ready wide table (one row per month; per-meter `(absolute reading;Δ consumed;money)` groups in config∪history order; total ₽ column) — user directive 2026-10-24 idea-refine session; garbage fixed-cost fills money cell only. Union columns guarantee deleted/disabled meters keep historical cells on re-export. DECIDED.

## Research note & resolved decisions (OPFS + formatting, verified 2026-10-24)

- Standard OPFS `navigator.storage.getDirectory()` has full support per MDN compat: Chrome ≥86, Edge, Firefox ≥111, Safari iOS ≥15.2 (WebKit blog #12257 confirms iOS 15.2+). Sync access handles (`createSyncAccessHandle`) only inside a dedicated Web Worker; that's the cross-browser write path. So OPFS works on iPhone natively — earlier "Chromium-only / IndexedDB fallback" decision is superseded: NO service worker, NO IndexedDB (superseded 2026-10-24).
- Picker APIs (`showSaveFilePicker`/`showOpenFilePicker`) remain Chromium-only (WebKit ships OPFS only, no pickers) — History-tab CSV button tries picker first, falls back to `<a download>` blob link; on iOS the downloaded file lands in the Files/downloads app, which is acceptable for backup UX.
- Resolved formatting decisions: CSV = UTF-8 BOM + `;` separator, comma decimals (DECIDED). UI thousands sep = Intl ru-RU narrow nbsp (DECIDED); CSV numbers ungrouped so Excel RU parses them. Backup filename `resourcepay-backup-YYYY-MM-DD.csv`, prefix string lives in `STR` for translation (DECIDED). Reinstall-survival out of scope (DECIDED).
