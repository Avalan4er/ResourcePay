# Bug batch 5 (manual report, round three, 2026-10-29, after design v2 shipped) — one case = one repro check = one fix

Same rule as [`tasks/bugs.md`](bugs.md) / `-2` / `-3` / `-4`: every case gets a named repro check that is RED
before its fix, ticked only on green evidence. Ledger ids are `U1`…`U4` (report order). Checks live in
`tests/e2e/design-v2.mjs` (sections wired in `run.mjs`); the harness sections print the ids.

Report (user, live phone/dark usage): 1) can't scroll to the bottom — footer tabs overlay the page tail;
2) Settings page UX is terrible; 3) buttons all look different; 4) input text is black on the dark background.

## U1 — footer tabs overlay the bottom of the page (can't reach the tail)
- [x] **U1** The clearance for the fixed 64px bottom nav bar was painted as `padding-bottom` on `body` only.
  On iPhone Safari the reliable scroll container is the content column (`#app` carries `overflow-y:auto`), and
  body padding does not extend the *internal* scroll range there — the page tail hid under the bar.
  Fix: the clearance must live on the scroll container itself (`#app`); body keeps its pre-design gutter
  (painting both would double the tail gap in the document-scroll path).
  e2e `U1`: `#app`'s computed bottom padding ≥ NAV_H (the harness proves the rule; the true iOS scroll
  behavior stays manual-verify like the other iPhone-only claims, see tasks/test-deps.md).

## U2 — Settings page UX is terrible
- [x] **U2** Meters rendered as a 4-column auto grid of label/input pairs at .86em — cramped, no list rhythm,
  read like a form dumped on the sheet. Redesign inside the flat MD3 contract (no nested cards, P5 holds):
  each meter is a **list group** — full-width header line (name · unit @ price + seed/fixed tags), then
  MD3 list lines with a hairline divider each: label left, control right-aligned, one line per field,
  ≥44px line height, .95em. The active checkbox becomes a real **MD3 switch** (appearance none, 52×32
  track, knob via ::after, `--primary` when on) — iOS users expect a switch in settings, not a checkbox.
  Markers preserved: `[data-id]`/data-active, `i.lbl[data-for]` pairing (S3), inputs ≤120px inside the row
  (S2), controls reach right (S4 re-worded, same bound), cfgNew add-block untouched (G8 adjacency pinned).
  e2e `U2`: list-line shape + switch paint claims.

## U3 — buttons all look different
- [x] **U3** No button SYSTEM: bare "+" Add button, filled error Clear, outlined Export, two filled primaries,
  ad-hoc sizes. System (design v2.1): one pill family, one height (`--tap + 2px`), one font size (root-relative
  rem); roles by paint only — primary = filled `--primary` (Save, Apply, Add), secondary = outlined (Export),
  destructive = **error TEXT button** (transparent, `--warn` ink; quieter than a third fill). Add gets a real
  STR label (`STR.addMeter`) with a leading "+". D2 claim re-pinned to the text-button role (error ink is the
  role signal, not the fill). e2e `U3`: uniform metrics + role paints + Add label claims.

## U4 — input text black on the dark background
- [x] **U4** `.field/.cfgRow/.cfgNew input` never set `color`, so input ink fell back to the UA default
  (`CanvasText` — always dark). In the dark scheme that painted near-black text on a dark sheet.
  Fix: `color:inherit` on all text inputs + `color-scheme` on `:root` (light/dark blocks) so native
  controls (select, spinners) follow the scheme too. e2e `U4`: under an emulated dark scheme an input's
  computed color equals the app's own `--on-surface` token (read inside the emulation).

## Evidence
- Pre-fix RED 2026-10-29: exactly 7 FAIL rows (U1, U2×2, U3×2 + D2/U3 re-pin, U4); all other 211 checks
  green (`7/218 FAILED`, fresh OPFS profile).
- Post-fix GREEN 2026-10-29: unit `OK unit layer — 14/14 exports`; acceptance **ALL 218 checks GREEN**,
  exit 0, `[elapsed] 18.0s`, fresh OPFS profile.
- Regressions caught by the post-fix pass and fixed inside the same batch (each now guarded by a named
  check): the U3 edit accidentally commented out the add-meter `onclick` (clicks landed on the button,
  handler never bound — 8 cascade FAILs traced via temp `diag()` hit-tests); the generic input
  `min-height:44px` floor stretched the 32px switch track (pinned with `min-height:32px`); `.95em` button
  font multiplied inside `.cfgNew`'s `.86em` (family broke — root-relative `.9375rem` now); 24px inline
  padding pushed 'Применить изменения' to 205px, over the P6 `BTN_W_MAX` hug bound (16px inline padding,
  bound untouched).
