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
- CSV export uses `showSaveFilePicker` where supported (Chromium) and an `<a download>` fallback elsewhere; the harness cannot click the picker chooser (real gesture required), so verify filename `resourcepay-backup-YYYY-MM-DD.csv` and bytes by hand in Chrome.
- UI strings come only from the `STR` dictionary in `src/app.js` — hand-translate that one object for Russian, nothing else holds copy.
