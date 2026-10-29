# Design v2 contract (full UI redesign, approved 2026-10-29)

Decisions taken (user): full redesign · dark scheme added · chart value labels above bars.
Scope: `src/tokens.css` `src/style.css` `src/ui.js` + new `STR` keys only — `src/app.js` math/CSV untouched
except descriptor fields the new states need (unit gate must stay 14/14, coverage manifest unchanged unless a
new export is deliberately added). No deps, no build step, flat tonal MD3, all strings via `STR`.

## The screen's job
One-handed monthly meter entry on an iPhone (390×844, zoom locked, safe-area aware) with an instant, unmissable
answer to "what did I spend this month". Primary action: **Save**. Secondary: Export CSV, Apply settings,
Add meter. Destructive: Clear history (always two-tap, G7).

## Design contract
- **Navigation**: MD3 bottom navigation bar (thumb zone), full-bleed, 64dp icon-over-label cells, surface-variant
  container, 1dp dividers between cells. Active cell: primary ink + `secondary-container` pill behind the icon
  (Navigation-Bar active indicator — the primary-tab 3dp underline belongs to top tabs and dies with them).
- **Toast**: lifts to sit above the nav bar (`bottom = bar height + safe-area + gap`); keeps `data-kind`,
  `--ok`/`--warn` paints, z ≥ 9, `pointer-events:none`.
- **Buttons**: filled-primary pill only for Save/Apply; **Export = outlined** (1dp `--outline`, transparent fill,
  primary ink); **Clear = error fill** (`--warn` bg / `--on-warn` ink, still two-tap armed copy). All keep
  ≥44px tap height. Widths hug copy (BTN_W_MAX contract survives).
- **Month total**: promoted to a tonal block — `secondary-container` rounded `--shape-l`, large figure
  (~1.9em/600) + small caption; it is the visual anchor of the Bills tab.
- **Empty states** (new STR keys): no-history History tab, bar-less Charts, and the zero total all paint a
  centered `on-surface-variant` caption (+ icon where cheap) instead of a blank sheet.
- **Charts**: plotting area ~9rem; **volume mode paints the integer value above each bar** (readable size,
  horizontal); **money mode keeps the horizontal month→₽ legend line** (long ₽ figures don't fit 42px slots).
  `YY-MM` caption stays under the baseline; bars stay pill-topped, same blue arc, `--bar-neg` for negative Δ.
- **Focus**: `:focus-visible` ring 2px `--primary`, offset 2px, on every painted control (tabs, buttons,
  inputs, select, switch tracks). Zero focus style today — this is an a11y fix, not decoration.
- **Dark scheme**: `@media (prefers-color-scheme: dark)` token override in tokens.css — same role ladder,
  dark surface stack (`#10141c`/`#161b26`-ish), same `--ok`/`--warn` hues re-toned for contrast. `theme-color`
  meta in index.html gets matching light/dark media variants. Both schemes verifiable via computed-style probes.
- **Rhythm**: 8dp scale as today; hairline row accents kept; section gaps stay ≥4dp (GAP_MIN).

## Patterns rejected (do not reintroduce)
Shadows/gradients/card containers · top tab strip · rainbow bar hues · micro-text inside paint ·
default-rounded everything · any UI string outside `STR` · any new dependency or build step.

## Re-pin surface (e2e contracts that must move with fresh green evidence)
- `tap-and-toast`: banner bottom offset vs nav bar; z-order vs bar.
- `ui-polish`: `buttonSize` (new outlined/error roles), `labelsOutside`/`headersTop` (above-bar labels, P2 re-pin),
  `flatRows` (tonal total block is a container, not a nested card — keep transparent-bg/no-shadow rule scoped to rows).
- `charts-toggle`: value-label presence per mode; legend scoping to money mode.
- `month-entry`: total block markers (keep `[data-el=total]` contract or move it deliberately with the feature doc).
- harness thresholds: keep TAP/GAP_MIN/CTRL_W_MAX/LEFT_MAX/ROW_W_MIN/BTN_W_MAX/TOAST_Z_MIN single-sourced;
  add bar-top label constants beside them if new geometry is asserted.
- Cache-bust: bump all 5 `?v=` tokens in the same commit as any src asset change.

## Gate order per slice
`node tests/test.mjs` green → fresh-profile `node tests/e2e/run.mjs` green (kill msedge + delete
`test-results/e2e-opfs-profile` first for the fresh-state pass) → only then next slice.

## Evidence (2026-10-29) — landed in one pass, all five slices together

- [x] **D1 bottom navigation bar** — `nav.tabs` fixed full-bleed bottom (z 6 < toast 9), active tab = secondary-container pill behind the icon (`::before` pseudo keeps the pinned 24px glyph box, MD1b), toast rule lifts ≥ NAV_H+8. Named checks: `design-v2: navBottom` ×3 GREEN.
- [x] **D2 button roles** — Export outlined (transparent + 1dp outline + primary ink), Clear error-toned (`--warn`/`--on-warn`, two-tap logic untouched), Save/Apply filled-primary; all ≥ TAP. Named checks: `design-v2: buttonRoles` ×4 GREEN.
- [x] **D3 dark scheme** — `@media (prefers-color-scheme: dark)` token block + dual `theme-color` meta; emulated-scheme probe shows surface/primary/ok re-toned, then restores light. Named checks: `design-v2: darkScheme` ×2 GREEN.
- [x] **D4 month-total anchor block** — `.totBlock` on `--secondary-container`, STR caption + ≥24px figure; `[data-el=total]` marker kept (month-entry total chk untouched). Named check: `design-v2: totalBlock` GREEN.
- [x] **D5 chart value labels** — volume mode paints each integer ABOVE its pill (`b.v`, horizontal); money mode keeps the month→₽ legend; `YY-MM` caption stays under the baseline; plot area 7.6→9rem with headroom. P2 re-pin probes BOTH modes deterministically (no reliance on suite order). Named checks: `ui-polish: labelsOutside` ×3 GREEN.
- [x] **D6 empty states** — `STR.emptyHistory`/`STR.emptyCharts` painted on a clean profile (markers `data-el=emptyHistory/emptyCharts`). Named checks: `design-v2: emptyStates` ×2 GREEN.
- [x] Slice 2 focus rings — `:focus-visible` 2px `--primary` ring on every painted control (no dedicated claim row yet; verified by inspection, zero regressions in the 206-row pass).
- [x] Cache-bust: all 5 `?v=` tokens bumped 2→3 in the same change (3 in `src/index.html` + 2 in `src/ui.js` imports).

## v2.1 amendments (bug batch 5, live-usage report — tasks/bugs-5.md)

- **Scroll clearance lives on the scroll container**: `#app` owns the 64px+ nav-bar clearance; body keeps
  its page gutter only (double-painting would inflate the tail gap).
- **Settings = MD3 list groups**: per-meter full-width lines (label left / control right, hairline-divided,
  ≥44px) with a switch-painted active toggle; the add-new block keeps its pinned grid.
- **Button family**: one pill family, root-relative font, role by paint only — filled primary /
  outlined secondary / error TEXT destructive (16px inline padding family-wide so long Cyrillic copy stays
  inside the P6 hug bound).
- **Scheme-aware native controls**: `color-scheme` on `:root` per scheme + `color:inherit` input ink.

Batch-5 evidence 2026-10-29 (U1–U4): pre-fix RED 7/218 (exactly the U-claims); post-fix **unit 14/14 +
acceptance ALL 218 checks GREEN, exit 0, [elapsed] 18.0s** on a fresh OPFS profile; regressions found by
the post-fix pass fixed in-batch and re-verified (details: tasks/bugs-5.md Evidence).
Review pass fixed two nits (body bottom-padding calc, labelsOutside leaves the suite back in volume mode).
All 182 pre-redesign checks stayed green —
the P2 legend claim was re-pinned mode-aware (stronger, not weaker: it now covers both modes). Harness additions:
`tests/e2e/design-v2.mjs` + `design-v2.feature`, `H.withDark`, `H.NAV_H`; `ui-polish.labelsOutside` re-pin.
SPEC.md amended in the same pass (dual scheme note + chart-label wording) per the source-of-truth rule.
Uncommitted pending human review; commit needs the user's go-ahead.
