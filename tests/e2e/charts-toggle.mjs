// Charts-tab acceptance claims for charts-toggle.feature (volume/money switch). SCEN carries facts read on tabs whose markers vanish elsewhere.
import { STR as AP } from '../../src/app.js'; // one rule, no counted literals: the money-agreement copy comes from app-owned numbers only
import * as H from './harness.mjs';

export async function volumeMode() { // charts-toggle.feature bullets 1/3/4 + C2/G-adjacent card shape; reads H.SCEN.activeIds captured in settings addNewMeter
  await H.tab('tabCharts');
  const s = await H.snap(); await H.diag('chartsVol', s.cards.map((c) => c.res + ':' + c.bars.map((b) => b.mo + '=' + b.v + '@' + b.h + (b.neg ? '!neg' : '')).join(',')));
  H.chk('charts: exactly one card per ACTIVE resource', s.cards.length >= H.SCEN.activeIds.length && s.cards.map((c) => c.res).sort().join() === [...H.SCEN.activeIds].sort().join());
  H.chk('charts(volume): garbage fixed-cost card carries no volume bars', (s.cards.find((c) => c.res === 'trash')?.bars.length ?? 0) === 0);
  H.chk('charts: every resource with a non-zero \u0394 reaches full height for its biggest month', H.all(s.cards.filter((c) => c.bars.some((b) => b.h > 2)), 1, (c) => Math.max(...c.bars.map((b) => b.h)) >= 98)); // an all-zero-\u0394 meter legitimately renders stub bars
  H.chk('charts: negative-\u0394 bar is flagged .neg and its label keeps the minus sign', s.cards.some((c) => c.bars.some((b) => b.neg && (b.v ?? '').startsWith('-'))));
}

export async function moneyMode() { // one header toggle flips EVERY card; garbage card gets ruble bars in money mode (bullets 3+6). Money sums go to SCEN for the history-agreement check
  await H.click('[data-el=modeToggle]'); await H.beat(); // the onclick flips `mode` and repaints synchronously
  const s = await H.snap();
  H.chk('charts: one page-header toggle flips EVERY card to money mode at once', s.cards.length >= 2 && s.cards.every((c) => c.bars.every((b) => (b.v ?? '').includes('\u20bd'))));
  H.chk('charts(money): garbage fixed-cost card now renders its monthly ruble bars', (s.cards.find((c) => c.res === 'trash')?.bars.length ?? 0) > 0);
  H.SCEN.moneySum = {}; for (const c of s.cards) for (const b of c.bars) H.SCEN.moneySum[b.mo] = (H.SCEN.moneySum[b.mo] ?? 0) + H.parseMoney(b.v); // Intl ru-RU uses U+2212 for negatives and NNBSP thousands: keep the sign, drop separators
}

export async function radioSwitch() { // C2 ids from tasks/bugs.md: the volume/money control must read as an iOS-style switch, and C1 card margins
  await H.tab('tabCharts'); await H.frames();
  const tgl = await H.ev(() => { const t = document.querySelector('[data-el=modeToggle]'); return (t?.tagName ?? '') + '/' + (t?.type ?? ''); });
  H.chk('C2 volume/money control is a radio element, not a plain button', tgl.startsWith('INPUT/') && tgl.endsWith('radio'));
  const modeLbls = await H.ev(() => { const t = document.querySelector('[data-el=modeToggle]'); if (!t) return []; const card = t.closest('div.card') ?? t.parentElement; return [...card.querySelectorAll(':scope > i.lbl')].map((e) => e.textContent); }); // labels sharing the toggle's card: C2 evidence
  H.chk('C2 both mode labels sit next to the radio so its meaning is visible', H.all(modeLbls, 2, (t) => String(t).trim() !== ''));
  await H.frames(); const cGeo = await H.rects('div.chart[data-res]'); // C1: chart boxes need painted frames before measuring
  H.chk('C1 chart cards keep vertical margin (>=4px stacked gaps)', cGeo.length >= 2 && H.gaps(cGeo).every((g) => g >= H.GAP_MIN));
}
