# Spec: ResourcePay — monthly bills tracker PWA

## Objective

A personal bills-tracker PWA for one person's flat, used primarily from an iPhone (mobile-first, minimal desktop compatibility), hosted as free static files on GitHub Pages. Tracks monthly bills and their history so the user can see what they spend per month without Excel.

User stories:
1. **Monthly entry tab** — for each configured meter (gas/electricity/water) show previous reading from history; user enters new *integer* meter value; app shows volume diff and money spent (= diff × ₽/unit price stored in that month's record, editable). Garbage is a fixed monthly ₽ amount entered per month. Saving the month appends a self-contained history record (readings + prices used for that month, all editable afterwards). Unit price can be changed during entry (but by default - use previous) and saved to history.
2. **History tab** — list of past months; header has one button to save/share full backup as CSV via browser save-file dialog (`showSaveFilePicker`), with `<a download>` fallback where the picker doesn't exist.
3. **Charts tab** (its own tab) — one bar chart per active resource, x-axis = months; a single toggle in the page header switches **all** charts on that page between volume bars (m³/kWh) and money bars (₽). Value labels above bars. Pure DOM/CSS bars, no chart library.
4. **Settings tab** — configure meters: rename, unit price, enable/disable (e.g. two gas meters, no water).

Data model (JSON state):
- `config`: list of resources `{id, name, unit, price, active}`; garbage is a fixed-cost resource (`unit` = ₽/month); meter prices default from config but each history record snapshots its own prices.
- `history`: entries `{month: "YYYY-MM", rows: [{ref → config id, prev (int|null), curr (int for meters | monthly ₽ for garbage), price}]}`; newest first; a month's `prev` is the latest stored reading of that meter in an earlier month (null if none).

Persistence requirement: all app data lives persistently in **OPFS** via the standard `navigator.storage.getDirectory()` (File System API), supported by Chrome/Edge/Firefox/Safari iOS 15.2+ — works on iPhone, no service worker needed. File read/write runs in a dedicated Web Worker (`createSyncAccessHandle` is only legal there). OPFS survives reloads/restarts; Safari lets users view/clear it via Settings. No IndexedDB fallback (modern-browser assumption ≥ iOS 15.2 / Chrome 86 / Firefox 111, see research note). CSV exports the full state (config + history) either way.

Interface: all UI strings come from one `STR` dictionary of English values — user hand-translates to Russian later; code must not hardcode display text elsewhere. Currency shown as rubles with exactly 2 decimals after a **comma** (`58,10 ₽`); volumes are integers.

## Tech stack

- Static files only: HTML + CSS + vanilla ES modules, no framework, no dependencies, no build step, GitHub Pages compatible (same-origin, https).
- Storage: OPFS (`navigator.storage.getDirectory()` + dedicated Web Worker for sync-handle writes); no external deps, everything same-origin. NO service worker, NO IndexedDB.
- Tests: Node built-in `node:test`/assert against the logic module; browser flows verified with the `control-ui` skill harness.

## Commands

```
Dev server :  python -m http.server 8000   (any static server; OPFS needs a secure context — localhost or https, not file://)
Unit tests :  node tests/test.mjs          (run before declaring done)
Browser test:  control-ui skill harness against the dev server
```

## Project structure

Source and tests live in their own directories, not scattered at the repo root:

```
src/
  index.html              → app shell: tabs UI, rendering, STR string dictionary; entry stub redirect at /<repo>/src/… (see note below)
  style.css               → mobile-first cute styling
  app.js                  → pure logic + state handling (config defaults, month calc, CSV build); testable in Node; imported by index via <script type="module" src="./app.js">
  storage.js              → OPFS: load/save bills.json via navigator.storage.getDirectory() (+ Web Worker createSyncAccessHandle for writes)
  manifest.webmanifest    → PWA manifest (start_url "./", display standalone)
tests/
  test.mjs                → node:test against ../src/app.js exports + CSV shape builder
SPEC.md AGENTS.md README.md   → docs at repo root only
```

GH Pages note: the bare project link `/<repo>/` needs an entry — either keep a ~6-line meta-refresh `index.html` stub in the root pointing to `./src/index.html`, OR use the GitHub Pages custom-404 trick (`404.json` with `{"permalink": "/src/index.html"}`). Either way all real code stays under `src/`. DECIDED 2026-10-24: meta-refresh stub in root.

## Code style

```js
// Pure, stateless helpers; UI only reads results. No classes unless they carry real behavior.
const diff = (rec.prev ?? 0), vol = rec.curr - prev;
const money = vol * rec.price;                 // meters
// garbage row: vol is null, money = rec.curr

STR.garbageTab || fallback…                    // NEVER inline display text in templates
```
- Naming: `lowerCamelCase` js ids, kebab for css classes/ids, `SCREAMING_SNAKE` for constants like `STR`.
- Numbers: UI via `Intl.NumberFormat('ru-RU', {minimumFractionDigits: 2, maximumFractionDigits: 2})` + literal `" ₽"` suffix → `"1 234,50 ₽"` (narrow-nbsp thousands); CSV numbers ungrouped with comma decimal (`1234,50`) so RU Excel parses them; `fmtInt()` plain integer.

## Testing strategy

- Unit tests (`node tests/test.mjs`): month calculation (diff, money incl. garbage), first-ever reading (prev=null), price edit of a past month, CSV line building (month;name;unit;volume;price;money with comma decimals + `;` sep), config enable/disable filtering, gap months (month without an entry skipped).
- Integration/e2e: browser flow via control-ui — save a month → appears in history/charts after reload (OPFS persistence proven across reload, not just SPA state); header toggle switches all charts between volume/money mode; CSV picker path on Chromium and `<a download>` fallback elsewhere.

## Boundaries

- **Always:** run unit tests green before "done"; keep everything same-origin static; keep strings only in `STR`; no external deps/CDN/Google Fonts.
- **Ask first:** adding any dependency, changing storage model (OPFS-native decision settled 2026-10-24 — see research note).
- **Never:** commit secrets, edit vendor code (there is none), add a build step, put UI strings outside `STR`.

## Success criteria

1. Entering readings for a month computes per-meter volume + ₽ instantly and saves a history record that survives a reload, tab switch and PWA relaunch (OPFS persists across sessions until the user clears browser storage; "survives OS-app reinstall" is NOT required — out of scope).
2. Re-entering the same month updates its record rather than duplicating.
3. Charts tab shows exactly one chart per active resource; header toggle flips every chart between m³/kWh bars and ₽ bars; heights proportional to values; garbage bar = monthly cost.
4. Settings enable/disable + rename + price changes reflected in entry form, history CSV row set and charts (e.g. 2 gas meters, no water).
5. History-tab button triggers `showSaveFilePicker` CSV save in Chromium; on Safari produces the same CSV via anchor download; file contains config rows + all month rows with prices used.
6. Rubles render `d,d0` (2 decimals, comma); meter values are integers everywhere.

## Open questions

(none — all finalized 2026-10-24, see Resolved decisions below)

## Decisions log

- Charts separate from history tab; single volume/money toggle for all charts on the chart page (user correction).
- Multi-file static hosting (index.html + css/js/manifest files in repo), not single self-contained file — user choice.
- Structure: app sources under `src/`, tests under `tests/` (user directive 2026-10-24); GH Pages entry stub in root via meta-refresh redirect (DECIDED).

## Research note & resolved decisions (OPFS + formatting, verified 2026-10-24)

- Standard OPFS `navigator.storage.getDirectory()` has full support per MDN compat: Chrome ≥86, Edge, Firefox ≥111, Safari iOS ≥15.2 (WebKit blog #12257 confirms iOS 15.2+). Sync access handles (`createSyncAccessHandle`) only inside a dedicated Web Worker; that's the cross-browser write path. So OPFS works on iPhone natively — earlier "Chromium-only / IndexedDB fallback" decision is superseded: NO service worker, NO IndexedDB (superseded 2026-10-24).
- Picker APIs (`showSaveFilePicker`/`showOpenFilePicker`) remain Chromium-only (WebKit ships OPFS only, no pickers) — History-tab CSV button tries picker first, falls back to `<a download>` blob link; on iOS the downloaded file lands in the Files/downloads app, which is acceptable for backup UX.
- Resolved formatting decisions: CSV = UTF-8 BOM + `;` separator, comma decimals (DECIDED). UI thousands sep = Intl ru-RU narrow nbsp (DECIDED); CSV numbers ungrouped so Excel RU parses them. Backup filename `resourcepay-backup-YYYY-MM-DD.csv`, prefix string lives in `STR` for translation (DECIDED). Reinstall-survival out of scope (DECIDED).
