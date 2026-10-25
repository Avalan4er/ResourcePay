# ResourcePay

Monthly bills tracker PWA: gas/electricity/water meter diffs × price, fixed garbage cost, rubles with comma decimals. Static single page for GitHub Pages, all data persisted in OPFS (`navigator.storage.getDirectory()`) through a dedicated Web Worker sync access handle — no IndexedDB, no service worker, no build step, zero runtime dependencies.

Read [`SPEC.md`](SPEC.md) — it is the source of truth; [`tasks/todo.md`](tasks/todo.md) tracks phases.

## Layout

```
index.html              GitHub Pages entry stub (meta-refresh → ./src/)
src/index.html          the app page
src/style.css           mobile-first styles
src/ui.js               DOM/picker/event glue (integration-only, no math)
src/app.js              all pure logic + STR string dictionary (unit-covered exports)
src/storage.js          OPFS load/save via Web Worker sync access handle
src/manifest.webmanifest  PWA manifest (display: standalone)
tests/test.mjs          unit gate: every src/app.js export exercised + coverage gate
tests/e2e/*.feature     BDD acceptance lists   tests/e2e/run.mjs  real-browser runner
```

## Run it locally

No build, no install for the app itself (`package.json` holds `playwright-core` as a **devDependency** for the test harness only):

```sh
python -m http.server 8123 --bind 127.0.0.1
# open http://127.0.0.1:8123/src/index.html
node tests/test.mjs        # unit layer
node tests/e2e/run.mjs     # acceptance layer in a real browser (uses installed Edge; see tasks/test-deps.md)
```

`navigator.storage` needs a secure context: `http://localhost`/`127.0.0.1` and `https:` both qualify, `file://` and LAN-IP over plain http do not — then the app shows the `noStorage` banner and keeps data in memory.

## Deploy (GitHub Pages)

1. Push this repo's `main` branch to GitHub and enable **Settings → Pages → Source: main, root (`/`)** — the root `index.html` stub redirects browsers to `./src/`, which is what keeps the OPFS origin stable.
2. Open the Pages URL once over https and add it to home screen on iPhone; state survives reloads and relaunches inside that browser/origin (different browser or origin = different OPFS vault).
3. Keep the `start_url` at `/src/` and `display: standalone` from `src/manifest.webmanifest`; if Pages is served under a sub-path, prefix manifest paths accordingly.

## Caveats to check with real meters / Chrome

- Meter readings are treated as odometer registers: first-ever month diffs against the `seed` baseline entered in Settings — confirm your meters do not reset monthly.
- CSV export uses `showSaveFilePicker` where supported (Chromium) and an `<a download>` fallback elsewhere; the harness cannot click the picker chooser (real gesture required), so verify filename `resourcepay-backup-YYYY-MM-DD.csv` and bytes by hand in Chrome. iOS Safari ignores the `download` attribute — check what iOS does with that tap before shipping.
- The History tab lists each month as per-meter groups (`name Δvolume unit · money`) plus the month total, and the backup file holds only the format marker + header + one row per month — no settings/seed lines (DECIDED: restoring onto another device would need an importer, out of scope).
- UI strings come only from the `STR` dictionary in `src/app.js` — hand-translate that one object for Russian, nothing else holds copy.
- Garbage (fixed-cost) rows hold an **absolute monthly ₽ amount** (no ₽/unit multiplier, no baseline line on either the Bills row or its Settings row); it may differ month to month, and CSV keeps it in the money-only cell only.
- Settings' `Clear saved months` wipes history only — meters/config survive; it needs two consecutive taps inside Settings (a tab switch re-arms), so browsing away can never leave a one-tap wipe.
- Toasts are pinned to the screen bottom (`position:fixed`, `pointer-events:none`) and paint green for success vs warn-red for errors; the viewport meta declares `width=device-width,initial-scale=1,...,shrink-to-fit=no` so iOS does not re-fit/zoom when a field is tapped.
- Zooming is **off page-wide on demand** (user asked for app-like behavior): the meta pins the scale both ways (`minimum-scale=1,maximum-scale=1`) and every control sets `touch-action:none`, so neither pinch-zoom nor iOS double-tap/smart-pinch zoom can fire. Accessibility tradeoff: WCAG 1.4.4 browser-zoom is gone — rely on iOS' own accessibility text zoom + the app's clamp() type scale (DECIDED 2026-10-25, see tasks/bugs-3.md Z1).
- The Charts "by volume / by money" control paints as one row of two CSS-drawn pills with a green dot on the selected mode (`appearance:none` radios). WebKit otherwise keeps painting its native radio control and `.card`'s column flex stacks children — if the switch ever renders stacked or as a bare dot on iPhone, check `-webkit-appearance:none` and `.card .swRow{display:flex}` first; the acceptance claims read computed styles for exactly that (tasks/bugs-3.md Z2).
