// iPhone-fidelity claims for tap-and-toast.feature (bug batch C: viewport lock, full-size taps, toast kind/colour/pinning, iOS mode switch)
import { STR as AP } from '../../src/app.js'; // copy compared against the app's dictionary only
import * as H from './harness.mjs';

export async function viewportMeta() { const meta = await H.ev(() => document.querySelector('meta[name=viewport]')?.getAttribute('content') ?? ''); H.chk('G2 viewport meta locks width (iOS shrink-to-fit off)', /width=device-width/.test(meta) && /shrink-to-fit=no/.test(meta)); }

export async function billsTyping() { // G5/G6b: the garbage row is an absolute monthly ruble amount with its own label and no baseline line; every visible control is a full tap target
  await H.tab('tabBills'); await H.selectMonth(H.M1);
  for (const [ref, v] of [['gas', 1105], ['electricity', 5505], ['water', 760], ['trash', 305]]) await H.setVal('[data-ref=' + ref + '] [data-role=curr]', v); // all Δ positive ⇒ the save paints a plain success toast for the G1 block to read
  await H.beat();
  const gshape = await H.ev(() => { const r = document.querySelector('div.field[data-ref=trash]'); if (!r) return null; return { hasPrev: r.querySelector('i.prev') !== null, prevTxt: String(r.querySelector('i.prev')?.textContent ?? ''), head: String(r.querySelector('b')?.textContent ?? '') }; });
  H.chk('G5 fixed-cost garbage row prints no odometer baseline copy at all', gshape?.hasPrev === false);
  const gLabel = await H.ev(() => document.querySelector('div.field[data-ref=trash] [data-for=curr]')?.textContent ?? ''); // G6b: the value typed in IS rubles
  H.chk('G6b garbage field is labelled as its absolute monthly cost and no ₽/unit multiplier sits in the row', gLabel === AP.lblAmount && (await H.ev(() => document.querySelector('div.field[data-ref=trash] [data-role=price]') !== null)) === false);
  const billsTap = await H.rects('.field input'); // visible controls only (B8 hides an untouched price, so it has no rect)
  H.chk('G2 every Bills field is a full-size tap target (nothing undersized for iOS to zoom onto)', H.all(billsTap, 4, ([, , w, h]) => w >= H.TAP && h >= H.TAP));
}

export async function noZoom() { // Z1 (tasks/bugs-3.md): the page behaves like an app — NO zoom gesture anywhere at all
  const meta = await H.ev(() => document.querySelector('meta[name=viewport]')?.getAttribute('content') ?? '');
  H.chk('Z1a viewport meta pins the scale both ways (minimum/maximum-scale=1) so pinch-zoom has nothing to do', /initial-scale=1/.test(meta) && /minimum-scale=1/.test(meta) && /maximum-scale=1/.test(meta));
  const acts = await H.ev(() => [...document.querySelectorAll('.field input, .cfgRow input, .card button, .tabs button')].filter((e) => { const c = getComputedStyle(e); return c.display !== 'none' && c.visibility !== 'hidden'; }).map((e) => String(getComputedStyle(e).touchAction))); // painted controls only (same visibility rule as rects()); per MDN, touch-action:none also kills iOS double-tap-to-zoom, which meta caps alone do not
  H.chk('Z1b every tappable control opts out of browser zoom gestures (computed touch-action none)', H.all(acts, 4, (t) => t === 'none'));
}

export async function toastColors() { // G1: a good save reports its round-trip via rpSaved and paints the success copy in the app's own --ok token; an error banner keeps --warn and stays persistent
  const nOk = await H.saves0(); await H.click('[data-el=saveBtn]');
  H.chk('G1 save round-trip reported by rpSaved before the toast is read', await H.afterSave(nOk) === true);
  const okRgb = await H.tokenColor('--ok'); // colour read from the app's own token (no rgb literal in a claim)
  const bOk = await H.ev((ok) => { const b = document.querySelector('b.banner'); if (!b) return null; const c = getComputedStyle(b); return { kind: b.dataset.kind, pos: c.position, z: Number(c.zIndex), isOkGreen: c.backgroundColor === ok, txt: b.textContent }; }, okRgb); // G1/G3: toast marked as success + lifted above content + pinned
  H.chk('G1 success toast carries an ok kind and paints the app\'s green (--ok)', bOk?.kind === 'ok' && bOk?.isOkGreen === true); // GREEN evidence 2026-10-25: {"kind":"ok","pos":"fixed","z":9,"isOkGreen":true}
  H.chk('G1/G3 toast is taken out of document flow above content (fixed + z-index over the tab strip)', bOk?.pos === 'fixed' && (bOk?.z ?? 0) >= H.TOAST_Z_MIN);
  await H.setVal('[data-ref=gas] [data-role=curr]', '12.5'); await H.click('[data-el=saveBtn]'); await H.beat(); // a rejected save paints an error banner that must stay warn-coloured and persistent
  const bErr = await H.ev(() => { const b = document.querySelector('b.banner'); if (!b) return null; const c = getComputedStyle(b); return { kind: b.dataset.kind, bg: c.backgroundColor }; });
  const warnRgb = await H.tokenColor('--warn'); // same token-read as --ok above, no hardcoded rgb literal
  H.chk('G1 error banners keep the warn colour (only success copy turns green)', bErr?.kind === 'err' && bErr?.bg === warnRgb);
}

export async function toastOnScrolledPage() { // G3: scroll a page taller than the phone viewport and keep reading the toast pinned there
  await H.tab('tabCharts'); await H.frames();
  const scrolled = await H.ev(() => { window.scrollTo(0, document.body.scrollHeight); return window.scrollY; });
  H.chk('G3 evidence holds weight: the Charts page really does overflow one screen', scrolled > 0);
  const onScreen = await H.ev(() => { const b = document.querySelector('b.banner'); if (!b) return false; const r = b.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight; });
  H.chk('G3 toast stays inside the viewport once scrolled', onScreen === true);
}

export async function iosModeSwitch() { // G4: an iOS segmented switch — two radio knobs, one checked, each under its own label, both full tap targets, and tapping is mode-stable
  const knobs = await H.ev(() => [...document.querySelectorAll('.card input[type=radio]')].map((k) => ({ for: k.dataset.for ?? '', checked: k.checked }))); // G4: a switch showing both states, not one bare knob
  H.chk('G4a the mode switch paints BOTH states (two radio knobs, exactly one checked)', knobs.length === 2 && knobs.filter((k) => k.checked).length === 1);
  const pairOk = await H.ev(() => { const kids = [...document.querySelector('.card .swRow')?.children ?? []]; return ['chartVolume', 'chartMoney'].every((f) => { const i = kids.findIndex((k) => k.dataset.mode === f); return i >= 0 && kids[i].querySelector('i.lbl[data-for=' + f + ']')?.textContent?.trim() && kids[i].querySelector('input[type=radio][data-for=' + f + ']') !== null; }); }); // G4b reworded for Z2's DOM (one pill per mode holding label+knob): label pairing now lives inside the track, so this reads the pill children of .swRow
  H.chk('G4b each knob owns its own STR mode label right above it', pairOk === true);
  const knobRects = await H.rects('.card input[type=radio]');
  H.chk('G4 both switch knobs render as full tap targets (>=40px pill tracks)', knobRects.length === 2 && knobRects.every(([, , w, h]) => w >= H.TAP && h >= H.TAP));
  await H.click('[data-el=modeToggle]'); await H.beat(); // tapping the knob the switch already sits on must be a no-op
  H.chk('G4 tapping the checked knob leaves mode where it is', (await H.ev(() => document.querySelector('.card input[type=radio][data-for=chartMoney]')?.checked)) === true);
  await H.click('[data-for=chartVolume][type=radio]'); await H.beat(); // iOS switch: tapping the other end picks that mode
  const volBack = await H.snap();
  H.chk('G4 tapping the volume knob flips every chart back to volume bars', volBack.cards.some((c) => c.bars.length > 0) && volBack.cards.every((c) => c.bars.every((b) => !String(b.v ?? '').includes('\u20bd'))));
}

export async function switchRow() { // Z2 (tasks/bugs-3.md) + segmented re-pin batch: the control must paint as ONE MD3 segmented button — contiguous option cells inside a single outlined pill whose selected cell carries secondary-container, not stacked native radios
  await H.tab('tabCharts'); await H.frames();
  const segs = await H.rects('.modeSw');
  const adjacency = (() => { if (segs.length !== 2) return false; const [a, b] = [...segs].sort((x, y) => x[0] - y[0]); return Math.abs(a[1] - b[1]) <= 2 && b[0] - (a[0] + a[2]) >= -2 && b[0] - (a[0] + a[2]) <= H.GAP_MIN; })(); // segmented re-pin: cells are CONTIGUOUS on one y-line (hairline divider between), so the old "real pill gap" floor became an adjacency tolerance — stacked radios still spike this RED
  H.chk('Z2a the mode tracks paint as two contiguous cells of ONE segmented control and each is a full tap target', adjacency && segs.every(([, , w, h]) => w >= H.TAP && h >= H.TAP));
  const paint = await H.ev(() => [...document.querySelectorAll('.modeSw')].map((p) => { const i = p.querySelector('input[type=radio]'); const c = getComputedStyle(i); const s = getComputedStyle(p); return { for: i?.dataset.for ?? '', checked: !!i?.checked, dataOn: p.hasAttribute('data-on'), appearance: c.appearance, bg: String(c.backgroundColor), segBg: String(s.backgroundColor), ink: String(s.color) }; }));
  H.chk('Z2b no native radio control may paint on the switch (appearance none + transparent tap layer)', H.all(paint, 2, (p) => p.appearance === 'none' && (p.bg === 'transparent' || p.bg === 'rgba(0, 0, 0, 0)')));
  const secFill = await H.tokenColor('--secondary-container'); // colours read from the app's own tokens, no rgb literals
  const onInk = await H.tokenColor('--on-secondary-container');
  const on = paint.filter((p) => p.checked), off = paint.filter((p) => !p.checked);
  H.chk('Z2c (segmented re-pin) exactly one cell is selected — its fill carries the app secondary-container role with on-secondary-container ink, unselected cells show only hairlines, and data-on always agrees with the checked radio (state readable without tapping; replaces the old painted dot)', on.length === 1 && off.length === 1 && paint.every((p) => p.dataOn === p.checked) && on[0].segBg === secFill && on[0].ink === onInk && off.every((p) => p.segBg === 'transparent' || p.segBg === 'rgba(0, 0, 0, 0)'));
}
