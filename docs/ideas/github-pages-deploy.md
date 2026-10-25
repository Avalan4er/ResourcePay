# ResourcePay on GitHub Pages — facts only (2026-10-25)

## Hosting layout (implemented, matches SPEC)
- Repo `main` at https://github.com/Avalan4er/ResourcePay; enabling **Settings → Pages → Source: main, root (`/`)** is a manual click (gh CLI not used). Phase 4 record confirms the Pages link was checked once over https.
- Root `index.html` = meta-refresh stub → `./src/index.html`; app page is `src/index.html`; all code under `src/`; `src/manifest.webmanifest` paths relative, `display: standalone`. One stable https origin keeps one OPFS vault.
- Bills never live in the repo or on GitHub Pages: data sits in each browser's OPFS vault keyed to origin + path (`navigator.storage.getDirectory()`). Different browser or origin = different vault.

## Persistence evidence (verified vs unobserved)
- Verified desktop Edge @ 127.0.0.1: in-pass hard reload + cross-launch boot read of History rows survive via OPFS — `persistence-reload.mjs` claims in `test-results/e2e-run.txt`.
- Never observed on real iPhone Safari as of 2026-10-25 (see pending checks below).

## Export button current behavior (`src/ui.js:69`)
- Chromium → `window.showSaveFilePicker` (save-file chooser; harness cannot click the chooser — filename `resourcepay-backup-YYYY-MM-DD.csv` + bytes verified by hand in Chrome, see tasks/test-deps.md).
- Everything else → `<a download>` attribute, which iOS Safari ignores (attribute unsupported there).
- Code contains NO `navigator.share` / clipboard fallback — on iPhone there is no working CSV save path today.

## Pending manual checks on the phone
- [ ] OPFS vault survives same-day and next-day reopen at `…/src/index.html` (enter one month, install via home screen, relaunch). If it fails, the monthly CSV export becomes mandatory rather than nice-to-have.
- [ ] Installed PWA resolves `start_url: "./index.html"` + `scope: "./"` under the `/ResourcePay/` sub-path — check the installed app's URL after tapping from the home screen.
- [ ] Pages serves `src/**` and `manifest.webmanifest` verbatim (no Jekyll front matter → no processing) — open the raw Pages URLs.
- [ ] Chromium OPFS may partition by top-level path: `/ResourcePay/` entry vs a bookmark at `/src/index.html` can be different vaults; the home-screen install is the intended single entry point.
