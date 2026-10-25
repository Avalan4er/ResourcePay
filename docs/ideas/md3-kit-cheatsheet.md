# MD3 design-kit cheatsheet (for the UI redesign) — gathered 2026-10-25

Verified from m3.material.io content JSON (`m3.material.io/_dsm/content/m3/<ver>/<carbonFileId>`; discovered via `exportedCarbonFileId` in main.js) + the site's own compiled CSS bundle (main.js embeds `--mio-theme-*` / `--mdc-*` custom props).

## Tabs — primary variant (spec table, exact values)
- Container height: **48dp** label-only; **64dp** icon+label. Icons vertically centered; divider included in container height.
- Icon size **24dp**; divider **1dp**, color `outline-variant`; inline padding icon↔text **8dp**.
- Active indicator (primary): underline bar **3dp** tall, **inset 2dp** each side, **min length 24dp**, corner radii **3,3,0,0**; secondary variant is 2dp.
- Ink roles: active destination label/icon = `primary`; inactive = `on-surface-variant`; container = `surface`.
- MD3 labels are NOT all-caps; tab label ≈ type `label-l` (14px/500).

## Segmented buttons (closest match to our mode-switch; exact values)
- Height **40dp**, outline **1dp** `outline`; selected segment fill = `secondary-container`, ink = `on-secondary-container`; unselected ink = `on-surface`.
- L/R padding min **12dp**; gap between elements **8dp**; tap **target size 48dp**; density: each step −4dp height.
- Note: M3 Expressive (May 2025) deprecates segmented buttons in favor of "connected button group" — we keep the pill shape because e2e Z4/G4 claims pin pills+radio, just re-tokenized to MD3 roles.

## Spacing scale (styles/spacing page, exact)
- Base `md.sys.measurement.space100 = 8dp`; main units are multiples of 8; nested recommended: 2, 4, 6, 10dp. Components map padding tokens → system tokens.

## Shape / corner radii (styles/shape page, Expressive-refresh deltas exact)
- L bumped to **20dp**, XL **32dp**, XXL **48dp** added; "fully rounded" now = token `full` (not 50% of size). Standard ladder xs/s/m ≈ 4/8/12/16 (older values, not re-listed on the page — medium confidence).

## Type scale (site CSS vars, exact)
- body-s/m/l: 12/14/16px, lh 16/20/24, weight 400 · label-s/m/l: 11/12/14px w500 ls 0/.1px · title-s/m/l: 14/16/22px.

## Color roles + elevation (site CSS vars, exact names & light-theme pattern)
- Names seen: `surface`, `surface-0..5` (tinted ladder), `surface-variant`, `on-surface`, `on-surface-variant`, `inverse-surface/on-surface`, `primary(+80/30/20, container, on-primary-container)`, `utility-outline`.
- elevation-1: `0 1px 2px 0 rgb(0 0 0/.30), 0 1px 3px 1px rgb(0 0 0/.15)`; elevation-2/3 grow the second layer. Shadows only on *elevated* surfaces — our redesign is edge-to-edge (no cards), so shadows stay minimal.
- Site ships purple scheme; we re-hue the same role ladder to blue (one balanced scheme, solid fills, no gradients).

## Icons (from site head CSS, exact)
- Legacy class: `font-family:'Material Icons'`, `-webkit-font-feature-settings:'liga'`, woff2 at `fonts.gstatic.com/s/materialicons/v145/....woff2`. SPEC bans runtime CDN/Google Fonts → **vendor the file**: download once to `src/material-icons.woff2`, self-host via relative `@font-face`. Validate every ligature name against `google/material-design-icons` font/MaterialIcons-Regular.codepoints before use.

## Contracts the acceptance layer pins (must survive the redesign)
- Element/class selectors hardcoded in tests: `b.banner`, `.tabs button`, `.field input`, `.cfgRow input`, `.card button[data-el=…]`, `.modeSw`, `.card .swRow` pill children with `data-mode`, `i.lbl[data-for]`, `i.knob`, radio `appearance:none`+transparent, `div.field[data-ref]` (flat: transparent bg, no shadow), `div.row[data-month]`, `div.chart[data-res]` (`display:flex/column`, header `h4` above bars, bar kids only under baseline), `small.legend`, table `th/td data-col`, `[data-id]`, `.cfgNew`.
- Geometry thresholds (harness.mjs): TAP=40, GAP_MIN=4, CTRL_W_MAX=120, LEFT_MAX=48, ROW_W_MIN=300, BTN_W_MAX=200, TOAST_Z_MIN=9; intra-row kid gaps ≥2; NO overlapping descendant rects inside `.field` (icons must not nest inside elements that the B4 overlap loop sees), inputs ≥40×40 with computed `touch-action:none`.
- Token reads: harness resolves `--ok`/`--warn` via getComputedStyle — keep those custom props defined; banner bg must equal computed `--ok` when kind=ok.
