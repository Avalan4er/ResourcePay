# ResourcePay

Monthly bills tracker PWA (bills / history+CSV backup / charts / settings tabs), static single-page app for GitHub Pages, data persisted in OPFS via `navigator.storage.getDirectory()` (+ Web Worker sync handle; works on iPhone Safari — no IndexedDB, no service worker). Source under `src/`, tests under `tests/`. Mobile-first iPhone UI, rubles with comma decimals, all UI strings only via the `STR` English dictionary (hand-translated to Russian later).

**SPEC.md is the source of truth — read it before doing anything.**

## Running the tests (gate order: unit green first, then browser, only then "done"/commit)

```sh
node tests/test.mjs                                  # unit layer: every src/app.js export + coverage gate
python -m http.server 8123 --bind 127.0.0.1          # one long-lived dev server for the acceptance layer
node tests/e2e/run.mjs                               # BDD acceptance in a real browser (Edge, 390x844 phone viewport)
```

- Unit gate prints `OK unit layer — N/N exports exercised`; it fails if any export lacks a case (`test-results/unit.txt`). Import `{ strictEqual as eq } from 'node:assert/strict'` in new cases — node's `strict as eq` binding is a truthiness assert and lauds wrong values.
- The acceptance runner serves from `http://127.0.0.1:8123/src/index.html`; it launches the installed browser once (`playwright-core` is a devDependency only, nothing shipped depends on it), prints `PASS`/`FAIL` lines plus `[elapsed]`, and exits non-zero when anything is red. Keep ONE runner invocation per verification pass — one persistent browser context, waits on structural conditions (`tab()` markers, `rpSaved` counter, banner polls), never fixed sleeps.
- Fresh-state runs (the B3/B10/G-style "no baseline" cases) need the OPFS profile deleted first and no browser holding it: kill `msedge.exe`, then delete `test-results\e2e-opfs-profile` (workspace, gitignored). A stale profile makes that precondition chk RED on purpose — never weaken the check instead.
- Ledger rule: every bug case gets one named repro check that is RED before its fix, ticked only on green evidence (`tasks/bugs.md`, `tasks/bugs-2.md`, `tasks/bugs-3.md`, `tasks/bugs-4.md`). Harness/tooling traps live in `tasks/test-deps.md` - read it before touching the runner.


Workflow reminders:
- use skills @using-agent-skills for development flow (prefer spec-driven-development)
- UI work: @frontend-ui-engineering + @control-ui; real-browser checks: @browser-testing-with-devtools — the acceptance layer itself is `node tests/e2e/run.mjs` per tasks/test-deps.md
- use skill @thermo-nuclear-code-quality-review (falls back to @code-review-and-quality) for code review after each phase
- prefer using tools instead of using commands
- remember of ponytail skill

## Context map — what to load per task (read only what the task needs)

- Any behavior question → `SPEC.md` first (source of truth; 106 lines, read it, it's small)
- Bug fix → the ledger row in `tasks/bugs*.md` + its named unit case in `tests/test.mjs` OR its e2e section; the repro check must be RED before the fix, ticked only on green evidence
- Test/harness work → `tasks/test-deps.md` BEFORE touching `tests/e2e/` (traps: rAF hangs, cold-boot race, profile lock, tab-scoped markers)
- Pure logic / money / CSV → `src/app.js` + `tests/test.mjs` (coverage manifest: a new export needs a same-commit case, `{ strictEqual as eq }`)
- DOM / paint / layout → `src/ui.js` + `src/style.css` + `src/tokens.css` (tokens before components; thresholds live ONCE in `tests/e2e/harness.mjs`); UI strings live in `STR` in `src/app.js`
- Persistence → `src/storage.js` (OPFS + Web Worker sync handle; never IndexedDB/service worker)
- Cache-bust rule applies to every src/ edit: bump all 5 `?v=` tokens in the same commit (3 in `src/index.html` + 2 in `src/ui.js`)
- Keep every month's calculations and CSV rows self-contained; don't add dependencies or a build step.
- Dont write temp files
- Cache-bust on every src asset change: GH Pages serves js/css with ~10min cache; bump EVERY `?v=` token (3 in src/index.html + 2 in src/ui.js static imports, kept in lockstep) in the same commit that touches app/storage/ui/tokens/style — a half-bumped graph ships stale mixed code
- Prefer research api-layers before guesing
- Never git push with --force flag
- Never take screenshots