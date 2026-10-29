// Design v2 claims (tasks/design-v2.md, approved 2026-10-29): bottom navigation bar, button roles, dual scheme,
// month-total anchor block, empty states. All read computed styles/geometry against the app's own tokens.
import { STR as AP } from '../../src/app.js';
import * as H from './harness.mjs';

export async function emptyStates() { // D6 — clean profile: History and Charts paint STR empty states instead of a blank sheet (runs before anything saves)
  await H.tab('tabHistory'); await H.frames();
  const hist = await H.ev((copy) => { const e = document.querySelector('[data-el=emptyHistory]'); const rows = document.querySelectorAll('div.row[data-month]').length; return { txt: e ? e.textContent.trim() : null, match: e?.textContent.trim() === copy, rows }; }, AP.emptyHistory);
  H.chk('D6 an empty History paints the STR empty state (and no month rows exist on a clean profile)', hist.match === true && hist.rows === 0);
  await H.tab('tabCharts'); await H.frames();
  const ch = await H.ev((copy) => [...document.querySelectorAll('div.chart[data-res]')].map((c) => ({ e: c.querySelector('[data-el=emptyCharts]')?.textContent.trim() ?? null, bars: c.querySelectorAll('i[data-month]').length })), AP.emptyCharts);
  H.chk('D6 every bar-less chart paints the STR empty state and no phantom bars', ch.length >= 3 && ch.every((c) => c.e === AP.emptyCharts && c.bars === 0));
}

export async function navBottom() { // D1 — the navigation bar lives in the thumb zone and the toast clears it
  const nav = await H.ev(() => { const t = document.querySelector('nav.tabs'); if (!t) return null; const c = getComputedStyle(t); const r = t.getBoundingClientRect(); return { pos: c.position, bottom: c.bottom, z: Number(c.zIndex), vw: window.innerWidth, w: Math.round(r.width), cells: [...t.querySelectorAll('button')].map((b) => Math.round(b.getBoundingClientRect().height)) }; });
  H.chk('D1 the navigation bar is a fixed full-bleed BOTTOM sheet in the thumb zone, z below the toast', nav?.pos === 'fixed' && nav?.bottom === '0px' && nav?.z === 6 && nav?.z < H.TOAST_Z_MIN && nav?.w >= nav?.vw - 2 && nav?.cells.length === 4 && nav.cells.every((h) => h >= 60));
  const pill = await H.ev(() => { const i = document.querySelector('.tabs button.on i.ic'); return i ? String(getComputedStyle(i, '::before').backgroundColor) : null; });
  const sec = await H.tokenColor('--secondary-container');
  H.chk('D1 the active tab carries the MD3 nav-bar indicator (secondary-container pill behind the icon)', pill !== null && pill === sec);
  const ban = await H.ev(() => { const p = document.createElement('b'); p.className = 'banner'; document.body.append(p); const v = getComputedStyle(p).bottom; p.remove(); return v; }); // detached probe element reads the banner rule without needing a painted toast
  H.chk('D1 the toast rule lifts above the 64px bar plus an 8dp breath (never covers a tab cell)', parseFloat(ban) >= H.NAV_H + 8);
}

export async function buttonRoles() { // D2 — filled-primary is for Save/Apply only; Export is outlined; Clear is error-toned; every role keeps the tap floor
  const [pri, onPri, out, warn, onWarn] = [await H.tokenColor('--primary'), await H.tokenColor('--on-primary'), await H.tokenColor('--outline'), await H.tokenColor('--warn'), await H.tokenColor('--on-warn')];
  const grab = async (sels) => await H.ev((list) => list.map((sel) => { const b = document.querySelector(sel); if (!b) return { sel, missing: true }; const c = getComputedStyle(b); const r = b.getBoundingClientRect(); return { sel, bg: String(c.backgroundColor), color: String(c.color), bw: String(c.borderTopWidth), h: Math.round(r.height) }; }), sels);
  await H.tab('tabBills');
  const [save] = await grab(['[data-el=saveBtn]']);
  H.chk('D2 Save stays the filled-primary action (and a full tap target)', !save.missing && save.bg === pri && save.color === onPri && save.h >= H.TAP);
  await H.tab('tabHistory');
  const [exp] = await grab(['[data-el=exportBtn]']);
  H.chk('D2 Export is the outlined secondary action (transparent fill, 1dp outline, primary ink)', !exp.missing && (exp.bg === 'transparent' || exp.bg === 'rgba(0, 0, 0, 0)') && exp.bw === '1px' && exp.color === pri && exp.h >= H.TAP);
  await H.tab('tabSettings');
  const [clr, app] = await grab(['[data-el=clearBtn]', '[data-el=applyBtn]']);
  H.chk('D2 Clear wears the error role so the destructive action cannot pass as primary', !clr.missing && clr.bg === warn && clr.color === onWarn && clr.h >= H.TAP);
  H.chk('D2 Apply stays filled-primary next to the error-toned Clear', !app.missing && app.bg === pri && app.color === onPri && app.h >= H.TAP);
}

export async function darkScheme() { // D3 — the dual scheme re-tones the role ladder under an emulated prefers-color-scheme and restores light afterwards
  const light = { surf: await H.tokenColor('--surface'), pri: await H.tokenColor('--primary'), ok: await H.tokenColor('--ok') };
  const dark = await H.withDark(async () => ({ surf: await H.tokenColor('--surface'), pri: await H.tokenColor('--primary'), ok: await H.tokenColor('--ok') }));
  H.chk('D3 dark scheme re-tones the role ladder (surface/primary/ok all differ from the light defaults)', dark.surf !== light.surf && dark.pri !== light.pri && dark.ok !== light.ok);
  const back = await H.tokenColor('--surface');
  H.chk('D3 the emulation restores the light scheme for the sections that follow', back === light.surf);
}

export async function totalBlock() { // D4 — the month's money is the visual anchor of the Bills tab
  await H.tab('tabBills'); await H.frames();
  const blk = await H.ev((cap) => { const b = document.querySelector('[data-el=total]'); if (!b) return { missing: true }; const w = b.closest('.totBlock'); if (!w) return { noBlock: true }; const c = getComputedStyle(w), bc = getComputedStyle(b); const lab = w.querySelector('i.lbl'); return { bg: String(c.backgroundColor), fs: parseFloat(bc.fontSize), cap: lab?.textContent ?? '', money: b.textContent.includes('\u20bd') }; }, AP.monthTotal);
  const sec = await H.tokenColor('--secondary-container');
  H.chk('D4 the month total paints as the anchor figure (tonal block, STR caption, big number with ₽)', !blk.missing && !blk.noBlock && blk.bg === sec && blk.cap === AP.monthTotal && blk.fs >= 24 && blk.money === true);
}
