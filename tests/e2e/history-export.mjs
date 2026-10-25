// History-tab acceptance claims for history-export.feature (row shape, money-agreement with charts, export-button presence).
import * as H from './harness.mjs';

export async function rowsBasicsMoneyAgree() { // one line per saved month newest-first w/ ruble totals, agreeing with the money-mode chart sums for that month (H.SCEN.moneySum recorded in charts moneyMode)
  await H.tab('tabHistory');
  const s = await H.snap();
  H.chk('history: one line per saved month, newest first, with ruble totals', H.all(s.rows, 2, (r) => r.t.includes('\u20bd')) && s.rows[0].m === H.M1);
  const num = (t) => H.parseMoney(t.split('\u2014').pop()); // money part only; the month label digits would otherwise contaminate the parse
  const rowTotals = Object.fromEntries(s.rows.map((r) => [r.m, num(r.t)]));
  H.chk('history: month totals agree with the money-mode chart sums for that month', Object.keys(rowTotals).length >= 2 && Object.keys(rowTotals).every((m) => m in H.SCEN.moneySum && Math.abs(rowTotals[m] - H.SCEN.moneySum[m]) < 0.05)); // 2dp labels are rounded per bar, so a few cents of drift is legitimate
}

export async function exportBtnPresent() { // picker chooser needs a real user gesture => verified manually (tasks/test-deps.md); here only presence on the Chromium path is claimable
  await H.tab('tabHistory');
  H.chk('history: export button present (Chromium showSaveFilePicker path)', await H.ev(() => document.querySelector('[data-el=exportBtn]') !== null));
}

export async function breakdown() { // H2 id: a history line must break the month down per meter, not only print the total
  await H.tab('tabHistory');
  const s = await H.snap();
  H.chk('H2 a history line breaks the month down per meter, not just the total', H.all(s.rows, 2, (r) => String(r.t).includes('\u0394') && (String(r.t).match(/\u20bd/g) ?? []).length >= 3));
}
