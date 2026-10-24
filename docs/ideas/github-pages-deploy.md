# ResourcePay on GitHub Pages

## Problem Statement
How might we put this OPFS-persisted bills PWA on one stable https origin so a single iPhone home-screen entry keeps its bills across months — without ever putting bills in a repo?

Reality check: the data is not on GitHub Pages at all. It lives in that browser's OPFS vault, keyed to origin + path. Deploying is three settings clicks; what matters is the **iOS export ritual** and **one-minute iOS persistence test**, both unverifiable from desktop Edge.

## Recommended Direction
Keep exactly what SPEC already decided: project page `avalan4er.github.io/ResourcePay/`, root meta-refresh stub → `./src/index.html`, all code under `src/`. Do not restructure hosting, do not buy a custom domain — the user's monthly CSV→Files export makes vault continuity nice-to-have rather than load-bearing.

The one thing that must change before iOS works: the History tab's export button in `src/ui.js` branches on `window.showSaveFilePicker` (Chromium) and otherwise does `<a download>`, which **iOS Safari ignores** (`download` attr unsupported there). For a user whose durability ritual is "export CSV to Files/Drive every month," that ritual currently has no path on their primary device. Smallest fix that solves it: where the picker is absent, try `navigator.share({ files: [File(blob,'text/csv',name)] })` (iOS 16+ Web Share Level 2, gesture-initiated → share sheet → Save to Files/Drive), and if `navigator.share` is missing, fall back to the existing anchor path with a toast that also writes the CSV text via `navigator.clipboard.writeText` so a person can paste it into Notes/Files. Any new copy lives only in the `STR` dictionary per SPEC — no build step, no deps stays true.

Second thing: validate the vault assumption on the phone itself (save one month → close → reopen next day). Desktop Edge proved reload + cross-launch; iPhonOS has never been observed here.

## Key Assumptions to Validate
- [ ] OPFS in an iPhone Safari tab survives a same-day and a next-day reopen at `…/src/index.html` (test: one month entered, home-screen install, relaunch). If it fails → the export ritual is mandatory, not optional.
- [ ] iOS share sheet accepts a `.csv` File from `navigator.share` to Files/Drive (validate by hand; if refused, clipboard fallback becomes primary).
- [ ] `start_url: "./index.html"` + `scope: "./"` resolve correctly under the `/ResourcePay/` sub-path for the PWA install (check the installed app's URL after tapping home screen).
- [ ] Jekyll/Pages copies `src/**` and `manifest.webmanifest` verbatim (no front matter → no processing) — verify by opening the raw Pages URLs.
- [ ] Chromium OPFS may partition by top-level path, so `/ResourcePay/` vs a bookmark at `/src/index.html` could be different vaults; nobody should bookmark the inner URL after install.

## MVP Scope (this deploy)
In: enable Pages from `main` / root; verify stub redirect on desktop + iPhone; install on iPhone; run the 1-minute persistence test; fix the export branch so iOS Safari can save a real `.csv`; rerun both gates after that one-file change.
Out: repo restructure to serve at root, custom domain, IndexedDB fallback, service worker, CSV import/re-import, any server-side anything.

## Not Doing (and Why)
- Custom domain / user-site hosting — vault continuity is covered by the monthly CSV; a rename risk nobody has hit.
- Serve app at repo root, drop `src/` hosting view — contradicts SPEC line 59 DECIDED stub + tests-dir convention; buys nothing given the above.
- `404.json` permalink trick instead of the stub — the alternative already listed in SPEC; stub is shorter and survives GitHub's Jekyll build.
- "Self-contained single-file index.html" bundling — user chose multi-file hosting deliberately (SPEC line 106); a build step would break the no-build promise.
- CSV re-import / sync between devices — not asked for, and inventing it now would make the app's data model carry a second source of truth.
- Automating Pages via gh CLI/API — user explicitly chose to click Settings in the browser.

## Open Questions (answer before/while building)
1. If iOS refuses `.csv` in its share sheet, what does the fallback toast say — and is it worth adding a STR key for it? (name one string, don't invent UI copy in code)
2. Do you reopen from the home-screen PWA or by typing the URL into Safari history? The vault may differ between them (path assumption above), so this determines whether the install button is optional or mandatory.
