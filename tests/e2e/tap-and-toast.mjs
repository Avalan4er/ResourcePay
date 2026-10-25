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

export async function toastColors() { // G1: a good save reports its round-trip via rpSaved and paints the success copy in the app's own --ok token; an error banner keeps --warn and stays persistent
  const nOk = await H.saves0(); await H.click('[data-el=saveBtn]');
  H.chk('G1 save round-trip reported by rpSaved before the toast is read', (await H.until('OPFS save round-trip done', (x) => (window.rpSaved ?? 0) > x, nOk, 8000)) === true);
  const bOk = await H.ev(() => { const b = document.querySelector('b.banner'); if (!b) return null; const c = getComputedStyle(b); const probe = document.createElement('p'); probe.style.color = 'var(--ok)'; document.body.append(probe); const okRgb = getComputedStyle(probe).color; probe.remove(); return { kind: b.dataset.kind, pos: c.position, z: Number(c.zIndex), isOkGreen: c.backgroundColor === okRgb, txt: b.textContent }; }); // G1/G3: toast marked as success + lifted above content + pinned (green read from the app's own --ok token)
  H.chk('G1 success toast carries an ok kind and paints the app\'s green (--ok)', bOk?.kind === 'ok' && bOk?.isOkGreen === true); // GREEN evidence 2026-10-25: {"kind":"ok","pos":"fixed","z":9,"isOkGreen":true}
  H.chk('G1/G3 toast is taken out of document flow above content (fixed + z-index over the tab strip)', bOk?.pos === 'fixed' && (bOk?.z ?? 0) >= H.TOAST_Z_MIN);
  await H.setVal('[data-ref=gas] [data-role=curr]', '12.5'); await H.click('[data-el=saveBtn]'); await H.beat(); // a rejected save paints an error banner that must stay warn-coloured and persistent
  const bErr = await H.ev(() => { const b = document.querySelector('b.banner'); if (!b) return null; const c = getComputedStyle(b); return { kind: b.dataset.kind, bg: c.backgroundColor }; });
  const warnRgb = await H.ev(() => { const p = document.createElement('p'); p.style.color = 'var(--warn)'; document.body.append(p); const v = getComputedStyle(p).color; p.remove(); return v; }); // same token-read as --ok above, no hardcoded rgb literal
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
  const pairOk = await H.ev(() => { const kids = [...document.querySelector('.card')?.children ?? []]; return ['chartVolume', 'chartMoney'].every((f) => { const i = kids.findIndex((k) => k.dataset.for === f); return i >= 0 && kids[i + 1]?.tagName === 'INPUT' && String(kids[i].textContent).trim() !== ''; }); });
  H.chk('G4b each knob owns its own STR mode label right above it', pairOk === true);
  const knobRects = await H.rects('.card input[type=radio]');
  H.chk('G4 both switch knobs render as full tap targets (>=40px pill tracks)', knobRects.length === 2 && knobRects.every(([, , w, h]) => w >= H.TAP && h >= H.TAP));
  await H.click('[data-el=modeToggle]'); await H.beat(); // tapping the knob the switch already sits on must be a no-op
  H.chk('G4 tapping the checked knob leaves mode where it is', (await H.ev(() => document.querySelector('.card input[type=radio][data-for=chartMoney]')?.checked)) === true);
  await H.click('[data-for=chartVolume][type=radio]'); await H.beat(); // iOS switch: tapping the other end picks that mode
  const volBack = await H.snap();
  H.chk('G4 tapping the volume knob flips every chart back to volume bars', volBack.cards.some((c) => c.bars.length > 0) && volBack.cards.every((c) => c.bars.every((b) => !String(b.v ?? '').includes('\u20bd'))));
}
