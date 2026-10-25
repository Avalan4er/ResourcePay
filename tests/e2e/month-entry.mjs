// Bills-tab acceptance claims for month-entry.feature. Statements keep the original order; H.SCEN carries facts across tab switches (settings-only markers vanish when another tab renders).
import { STR as AP } from '../../src/app.js'; // acceptance copy comes from the app's dictionary — no literals that can drift from what the UI paints
import * as H from './harness.mjs';

export async function freshOldestForm() { // needs a CLEAN OPFS profile: nothing predates OLDEST, so B3/B10 previews must be honest hints not faked zeros
  await H.tab('tabBills'); await H.selectMonth(H.OLDEST);
  const refsA = await H.fieldRefs(); H.SCEN.refsA = refsA; // consumed by previews + tap-size sections below
  const optTexts = await H.ev(() => [...(document.querySelector('select[data-el=month]')?.options ?? [])].map((o) => o.textContent)); // arrow form: complex option-list accessors stay readable, Playwright deserializes the array
  // B1: options need visible text (empty box was the bug); the 24-window + newest-first rule asserted from the DOM, so ui.js drift goes RED not silent-green
  H.chk('B1 every month <select> option shows its month text and the window is the rolling 24 months newest-first', H.all(optTexts, 24, (x) => /^\d{4}-\d{2}$/.test(String(x))) && optTexts[0] === H.M1 && optTexts[H.OPT.length - 1] === H.OLDEST);
  await H.frames(); const rowGeo = await H.rowKidsAll(refsA.map((ref) => 'div.field[data-ref=' + ref + ']')); // B2/B4/B5 evidence: the row rect + its input rects (one round-trip batch, no per-ref awaits)
  H.chk('B2 meter rows keep vertical margin (>=4px gaps, nothing touching)', H.gaps(rowGeo.map((g) => g.r)).every((gap) => gap >= H.GAP_MIN));
  H.chk('B4 every input sits inside its meter row (nothing sticks out)', H.all(rowGeo, refsA.length, (g) => g.r && g.kids.length > 0 && g.kids.every((k) => H.inside(g.r, k, 4))));
  H.chk('B4 nothing inside a meter row overlaps (controls + labels stacked clear)', H.all(rowGeo, refsA.length, (g) => { const a = g.all; for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) if (H.overlaps(a[i], a[j])) return false; return a.length > 1; }));
  H.chk('B4 meter rows full-width one-per-row (not half the screen)', H.all(rowGeo, 2, (g) => g.r && g.r[2] >= H.ROW_W_MIN));
  H.chk('B4 meter rows do not sit side by side (same left edge)', H.all(rowGeo, 2, (g, i) => !g.r || i === 0 || Math.abs(g.r[0] - rowGeo[i - 1].r[0]) < 8));
  const inpStyle = await H.ev(() => { const i = document.querySelector('div.field input'); return i ? [getComputedStyle(i).borderWidth, getComputedStyle(i).paddingInline] : ['0px', '0px']; });
  H.chk('B5 inputs styled (border+padding computed) and their row keeps >=4px vertical rhythm', inpStyle[0] !== '0px' && inpStyle[1] !== '0px' && H.all(rowGeo, refsA.length, (g) => g.all.length > 1 && H.gaps(g.all).every((x) => x >= H.GAP_MIN)));
  const lblStats = await H.labelStats('div.field[data-ref]'); // G6 changed what a row holds: every INPUT must own a label, rows need no label for controls they don't carry
  H.chk('B7 every meter row labels its own inputs with STR copy', lblStats?.unlabeled === 0 && (lblStats?.labeled ?? 0) >= refsA.length + 1); // one label per input; garbage needs only its reading label
  const visPerRow = await H.ev((sels) => sels.map((sel) => [...document.querySelectorAll(sel)].filter((i) => !i.hidden).map((i) => i.dataset.role)), refsA.map((ref) => 'div.field[data-ref=' + ref + '] input')); // one batched probe; price input hides while it equals its default (B8)
  H.chk('B8 only the reading input is visible while price equals its default', H.all(visPerRow, refsA.length, (arr) => arr.length === 1 && arr[0] === 'curr'));
  await H.setVal(`[data-ref=${refsA[0]}] [data-role=price]`, 7); await H.beat(); // B8: previews/hidden flags recompute synchronously on the attribute mutation, so one round-trip is enough
  const visAfter = await H.visInputs(`div.field[data-ref=${refsA[0]}] input`);
  H.chk('B8 price field becomes visible once edited away from its default (still editable per month)', visAfter.length === 2);
  await H.setVal(`[data-ref=${refsA[0]}] [data-role=price]`, 0);
  // B6: the save path bails out before persist, so its banner is the completion signal
  await H.click('[data-el=saveBtn]'); await H.bannerPainted('empty-form refusal banner painted');
  H.chk('B6 save with no readings refused by STR.nothingEntered banner', (await H.snap()).banner === AP.nothingEntered);
  await H.tab('tabHistory');
  H.chk('B6 refused save created no empty month row', !((await H.snap()).rows.map((r) => r.m).includes(H.OLDEST)));
}

export async function previewsFresh() { // B3/B10 honest-preview rule lives once in describeMonthForm; here we prove the UI never fakes a 0-figure money line
  await H.tab('tabBills'); const refsA = H.SCEN.refsA;
  for (const ref of refsA) await H.setVal(`[data-ref=${ref}] [data-role=curr]`, 50);
  await H.beat();
  const pvA = await H.ev(() => [...document.querySelectorAll('[data-role=pv]')].map((e) => e.textContent));
  const hintRows = pvA.filter((t) => String(t).includes('\u0394')); // previews that speak in words (hint copy), not numbers
  const moneyShown = pvA.filter((t) => /\d[.,]\d{2}\s*\u20bd/.test(String(t))); // any "n,nn ₽" figure painted into a preview
  const form = await H.snap(); const meterOnly = form.fields.filter((f) => !/\/month/.test(f.name)); // fixed-cost rows (garbage) carry no Δ math line, so hints belong to meters only
  H.chk('B3 no-baseline month never shows faked 0 money (pv holds hint copy per meter, not a ₽ figure)', meterOnly.length >= 3 && hintRows.length >= meterOnly.length && moneyShown.length === 0);
  for (const ref of refsA) await H.setVal(`[data-ref=${ref}] [data-role=curr]`, ''); // leave the form as clean as it arrived
}

export async function priceMissingRepro() { // B10: odometer baseline IS known (Settings seeded water above) but ₽/unit still default 0 → preview must name the missing price, never paint 0,00 rubles
  await H.tab('tabBills'); await H.selectMonth(H.OLDEST); await H.setVal('[data-ref=water] [data-role=curr]', 740); await H.beat();
  const wrow = await H.ev(() => { const r = document.querySelector('[data-ref=water]'); return r ? { prev: r.querySelector('i.prev')?.textContent ?? '', pv: r.querySelector('[data-role=pv]')?.textContent ?? '' } : null; });
  H.chk('B10 baseline known but ₽/unit unset ⇒ preview names the missing price, never a 0,00 ruble figure', H.re(AP.priceMissing).test(wrow?.pv ?? '') && !/\d[.,]\d{2}\s*\u20bd/.test(wrow?.pv ?? '')); // copy read from STR (escaped), so a reworded hint is still checked against what the app owns
}

export async function enterPreviousMonth() { // month-entry.feature: prev line + live previews + save persistence; water keeps its price UNSET here so B10's honest repro above is what the user saw
  await H.tab('tabBills'); await H.selectMonth(H.M0);
  for (const [ref, v] of [['gas', 1060], ['electricity', 5300], ['water', 740], ['trash', 250]]) await H.setVal('[data-ref=' + ref + '] [data-role=curr]', v);
  await H.beat();
  let s = await H.snap();
  H.chk('entry: prev line shows the odometer baseline per meter (not zero)', H.all(s.fields.filter((f) => f.ref !== 'trash'), 3, (f) => String(f.prev ?? '').includes(AP.prevLabel))); // re-pin for RU translation round: copy comes from AP.prevLabel, never an English literal
  H.chk('entry: \u0394 + ruble preview updates as soon as a reading is typed', H.all(s.fields.filter((f) => f.curr && !/\/month/.test(f.name)), 3, (f) => (f.pv.includes('\u20bd') || f.pv.includes(AP.priceMissing) || f.pv.includes(AP.noSeedPrev)) && f.pv.length > 4)); // re-pin for RU copy: substring reads replace new RegExp — translated strings carry literal ( ) that would break an unescaped pattern
  H.chk('entry: month total money line rendered', s.total.includes('\u20bd'));
  const priceInputs = await H.ev(() => document.querySelectorAll('div.field[data-ref] [data-role=price]').length);
  const meterFields = s.fields.filter((f) => !/\/month/.test(f.name)); // G6: a fixed-cost row has no ₽/unit multiplier at all, so only meters carry one
  H.chk('entry: every meter field carries an editable price input (defaults from config)', priceInputs === meterFields.length && meterFields.length > 0); // per-price arithmetic is unit-verified already
  await H.clickAndSave('[data-el=saveBtn]');
  await H.tab('tabHistory'); s = await H.snap(); await H.diag('afterM0', { rows: s.rows.map((r) => r.m + ':' + r.t), title: await H.ev(() => document.title) });
  H.chk('entry: saved month appears in History exactly once', s.rows.filter((r) => r.m === H.M0).length === 1);
  // B9: after saving, leaving-then-re-entering must show that month's values again so a typo can be corrected in place (the STR prefill from saved rows)
  await H.tab('tabBills'); await H.selectMonth(H.M0);
  const s2 = await H.snap();
  H.chk('B9 re-entered month keeps its stored readings visible for correction', s2.fields.filter((f) => f.curr).length >= 4);
  await H.toastCleared('success toast cleared itself'); // B9/S6: expiry rule is polled by the harness helper; a never-clearing banner times out and the chk below stays red
  H.chk('B9 success banner self-clears after ~4s (no permanent saved ✓ line)', (await H.snap()).banner === '');
  await H.setVal('[data-ref=gas] [data-role=curr]', 1070); await H.clickAndSave('[data-el=saveBtn]');
  await H.tab('tabHistory');
  H.chk('entry: re-entering the same month replaces values, no duplicate row', (await H.snap()).rows.filter((r) => r.m === H.M0).length === 1);
}

export async function rejectFractional() { // entry.feature last bullet + B6-adjacent: fractional/NaN reading refused with STR.badNumber copy and no history row created
  await H.tab('tabBills');
  await H.setVal('[data-ref=gas] [data-role=curr]', '12.5'); await H.click('[data-el=saveBtn]'); await H.beat(); // rejected upsert throws before persist, so the banner is painted synchronously inside the click handler
  H.chk('entry: fractional meter reading rejected with the STR.badNumber banner', (await H.snap()).banner === AP.badNumber);
  await H.tab('tabHistory');
  H.chk('entry: rejected save created no extra history row', (await H.snap()).rows.filter((r) => r.m === H.M0).length === 1);
  await H.tab('tabBills'); await H.setVal('[data-ref=gas] [data-role=curr]', 1070); // restore the typed value so later sections see the same form a user would
}

export async function negativeDelta() { // decreased reading (meter replaced): warns inline but still stores the raw negative diff, and Charts flag it
  await H.tab('tabBills'); await H.selectMonth(H.M1);
  for (const [ref, v] of [['gas', 1100], ['electricity', 5500], ['water', 700], ['trash', 300]]) await H.setVal('[data-ref=' + ref + '] [data-role=curr]', v);
  await H.beat();
  const s = await H.snap(); await H.diag('negTyping', s.fields.map((f) => f.ref + ' curr=' + f.curr + ' prev=' + f.prev + ' pv=' + f.pv));
  const wf = s.fields.find((f) => f.ref === 'water');
  H.chk('entry: decreased reading warns inline (new-meter copy)', new RegExp(AP.negativeDiff).test(wf?.pv ?? '') && wf.pv.includes('\u26a0')); // warn marker U+26A0; hint copy read from STR so a reworded message is still checked against what the app owns
  await H.clickAndSave('[data-el=saveBtn]'); // negative Δ warns but must still persist the raw month
  await H.tab('tabHistory');
  H.chk('entry: warning does not block saving the raw negative diff', (await H.snap()).rows.some((r) => r.m === H.M1));
}
