// ResourcePay unit tests: every export needs a case, gate enforced at end.
import * as A from '../src/app.js';
import { strictEqual as eq } from 'node:assert/strict';
// pin: importing `{ strict as eq } from 'node:assert'` binds node's TRUTHINESS assert (eq(1,2) passes);
// strictEqual actually compares — verified 2026-10-25: eq(1,'1') and eq(0,false) both throw.

let fails = []; const ran = new Set();
const ok = (c, m) => { if (!c) fails.push(m); };
const site = (e) => (e?.stack ?? '').split('\n')[1]?.trim() ?? ''; // throw line, so a RED names its case AND where it blew up
const failLine = (names, e) => `[${names.join(',')}] ${e.message || String(e)} | ${site(e)}`;
const run = (names, fn) => { names.forEach(n => ran.add(n)); try { fn(); } catch (e) { fails.push(failLine(names, e)); } };

// ---- fmt helpers
run(['fmtRub', 'fmtInt'], () => {
  ok(/,\d{2}\s?\u20bd$/.test(A.fmtRub(1234.5)), `fmtRub keeps comma decimals + ₽: ${A.fmtRub(1234.5)}`);
  eq(A.fmtInt(0), '0');
});

run(['csvMoney'], () => {
  eq(A.csvMoney(1234.5), '1234,50');
  eq(A.csvMoney(-3), '-3,00');
});

// ---- constants gate coverage
run(['DEFAULT_CONFIG', 'STR'], () => {
  ok(A.DEFAULT_CONFIG.some(c => c.id === 'trash' && c.fixed === true), 'trash fixed-cost default exists');
  ok(Object.keys(A.STR).length >= 6, 'STR has UI copy keys');
  ok(['nothingEntered', 'priceMissing', 'lblReading', 'lblPrice', 'lblName', 'lblUnit', 'lblSeedBase',
     'lblActive', 'lblFixed', 'applyChanges', 'saveMonth', 'savedOk', 'lblAmount', 'addMeterTitle',
     'clearHistory', 'confirmClear'].every(k => k in A.STR),
  'every label/copy the DOM glue paints lives in STR (translation lever)');
});

const st = { config: [
  { id: 'g1', name: 'Gas A', unit: 'm³', price: 10, active: true, seed: 100 },
  { id: 'w1', name: 'Water', unit: 'm³', price: 2, active: false, seed: null },
], history: [{ month: '2026-08', rows: [{ ref: 'g1', name: 'Gas A', unit: 'm³', fixed: false, curr: 130, price: 10 }] }] };

run(['resolvePrev', 'calcRows'], () => {
  // gap months inherit last-known (no Sep row → Oct prev=130)
  const rows = A.calcRows(st, '2026-10');
  ok(rows.length === 1 && rows[0].ref === 'g1', 'inactive meter excluded from form; active computed');
  eq(rows[0].prev, 130);
  // first-ever uses seed baseline not zero
  const fresh = { config: [{ id: 'e', name: 'ELEC', unit: 'kWh', price: 5, active: true, seed: 20 }], history: [] };
  const f = A.calcRows(fresh, '2026-11');
  ok(f.some(r => r.ref === 'e' && r.prev === 20), 'first run seeds baseline as prev not null/zero');
});

// G5/G6 rule: a fixed-cost row is never an odometer baseline (app.js resolvePrev `&& !r.fixed`).
// Teeth: dropping that guard would return the garbage amount 410 instead of no-baseline.
run(['resolvePrev'], () => {
  const gs = { config: [
    { id: 'g', name: 'Gas', unit: 'm³', price: 5, active: true, seed: null },
    { id: 't', name: 'Trash', unit: '\u20bd/month', fixed: true, price: 1, active: true, seed: null },
  ], history: [{ month: '2026-08', rows: [{ ref: 't', name: 'Trash', unit: '\u20bd/month', fixed: true, curr: 410, price: 1 }] }] };
  eq(A.resolvePrev(gs.history, 'g', '2026-09', null), null, 'no meter row + seedless ⇒ no baseline (garbage 410 must not become prev)');
});

run(['upsertMonth'], () => {
  const [s, w] = A.upsertMonth(st, '2026-10', { g1: 140 }, { g1: 9 });
  ok(w.length === 0, 'no warnings on normal upsert');
  eq(s.history.length, 2);
  ok(s.history[0].month === '2026-10', 'history stays newest-first desc sorted');
  const row = s.history.find(h => h.month === '2026-10').rows.find(r => r.ref === 'g1');
  eq(row.price, 9); eq(row.curr, 140);
  // same month updates not duplicates
  const [s2] = A.upsertMonth(s, '2026-10', { g1: 150 });
  eq(s2.history.length, 2);
  const row2 = s2.history.find(h => h.month === '2026-10').rows.find(r => r.ref === 'g1');
  eq(row2.curr, 150);
  // negative diff (meter replaced) warns but saves; garbage amount decimals allowed on fixed rows
  const [s3, w3] = A.upsertMonth(st, '2026-10', { g1: 5, trash: 390.5 });
  ok(w3.some(x => x.ref === 'g1'), `negative Δ flags ${w3.length} warning(s) w/ ref g1`);
  eq(s3.history.length, 2);
  ok(s3.history.find(h => h.month === '2026-10').rows.some(r => r.ref === 'trash' && r.curr === 390.5),
  'fixed garbage row keeps decimal amount (no int coercion)');
});

run(['updateConfig'], () => {
  const patched = A.updateConfig(st, { id: 'g1', price: 7, active: false });
  ok(patched.config.some(c => c.id === 'g1' && c.price === 7 && c.active === false), 'patch existing meter price+disable');
  eq(patched.history, st.history);
  // seed required when creating a NEW non-fixed meter
  const added = A.updateConfig(st, { id: 'x', name: 'Gas B', unit: 'm³', price: 3, active: true, seed: 5 });
  ok(added.config.some(c => c.id === 'x' && c.seed === 5), 'new meter added w required seed');
  let threw = false;
  try { A.updateConfig(st, { id: 'y', name: 'NoSeed', unit: 'm³', price: 1, active: true }); } catch (e) { threw = true; }
  ok(threw, 'seed mandatory for new meters');
});

run(['buildCsv'], () => {
  const wide = { config: [
    { id: 'g1', name: 'Gas A', unit: 'm³', price: 10, active: true, seed: 100 },
    { id: 'w1', name: 'Water', unit: 'm³', price: 2, active: false, seed: null },
    { id: 'trash', name: 'Trash', unit: '\u20bd/month', fixed: true, price: 1, active: true, seed: null },
  ], history: [
    { month: '2026-08', rows: [
      { ref: 'g1', name: 'Gas A', unit: 'm³', fixed: false, curr: 130, price: 10 },
      { ref: 'trash', name: 'Trash', unit: '\u20bd/month', fixed: true, curr: 250.25, price: 1 }] },
    { month: '2026-09', rows: [{ ref: 'g1', name: 'Gas A', unit: 'm³', fixed: false, curr: 150, price: 8 }] },
  ] };
  const csv = A.buildCsv(wide);
  ok(csv.startsWith('\uFEFF'), 'BOM first');
  const lines = csv.split('\n');
  eq(lines[1], 'date;Gas A;Δ Gas A;Gas A ₽;Water;Δ Water;Water ₽;Trash;Δ Trash;Trash ₽;total ₽',
  'wide header groups in config order + uniform labels + total column');
  ok(lines.some(l => l.startsWith('2026-08;') && l.includes(';130;30;300,00')),
  'Aug row: absolute 130, Δ from seed(100)=30, money=Δ*stored price 10');
  ok(lines.some(l => /^2026-08/.test(l) && l.includes(';;250,25')),
  'garbage fills money-only cell (absolute+Δ blank) incl amount decimals');
  const iA = lines.findIndex(l => /^2026-08/.test(l)), iS = lines.findIndex(l => /^2026-09/.test(l));
  ok(iS > iA && iA > 1, 'chronological oldest→newest (Aug line before Sep)');
  ok(!lines.some(l => l.startsWith('#cfg')), 'H1 no settings values leak into the backup file (history-only)');
});

// history-export.feature bullet 7: a warning does not clamp saved data — raw negative Δ survives in the CSV Δ cell.
run(['buildCsv'], () => {
  const replaced = { config: [{ id: 'g', name: 'Gas', unit: 'm³', price: 5, active: true, seed: 100 }], history: [
    { month: '2026-08', rows: [{ ref: 'g', name: 'Gas', unit: 'm³', fixed: false, curr: 70, price: 5 }] },
  ] };
  const line = A.buildCsv(replaced).split('\n')[2];
  ok(line.startsWith('2026-08;70;-30;-150,00;-150,00'),
  `negative Δ exported raw: ${line} (curr 70, seed 100 ⇒ Δ -30, money -150,00 not clamped)`);
});

// descriptors DOM-free render contracts
run(['describeMonthForm'], () => {
  const f = A.describeMonthForm(st, '2026-10', { g1: 140 }).fields[0];
  eq(f.diff, 10); eq(f.money, 100);
  ok(!f.warn, 'positive Δ no warning');
  const w = A.describeMonthForm(st, '2026-10', { g1: 5 }).fields[0];
  ok(w.warn === true, 'negative Δ sets warn flag');
  // re-entering an already-saved month with nothing typed must keep its stored readings (upsertMonth replaces the whole entry)
  const c = A.calcRows(st, '2026-08')[0];
  eq(c.saved, 130); eq(c.savedPrice, 10);
  const sf = A.describeMonthForm(st, '2026-08').fields[0];
  eq(sf.curr, 130); eq(sf.diff, 30); eq(sf.money, 300);
});

run(['describeCharts'], () => {
  const vol = A.describeCharts(st, 'volume')[0], mny = A.describeCharts(st, 'money')[0];
  eq(vol.bars.length, 1); eq(mny.bars.length, 1);
  eq(vol.bars[0].v, 30); eq(vol.pctOf, 30); eq(mny.bars[0].v, 300);
});

run(['describeHistoryRows'], () => {
  const h = A.describeHistoryRows({ ...st, config: [...st.config, { id: 'trash', name: 'T', unit: '', fixed: true, price: 1, active: true, seed: null }] });
  eq(h.length, 1); eq(h[0].month, '2026-08');
  const p = h[0].parts[0];
  eq(p.name, 'Gas A'); eq(p.unit, 'm\u00b3'); eq(p.delta, 30); eq(p.money, 300);
  eq(p.fixed, false, 'H2 meter part carries its fixed flag (non-fixed)');
  ok(h.every(r => r.month && r.total != undefined && r.parts && r.fmt),
  'H2 month lines expose per-meter breakdown + total for DOM glue');
});

// ---- bug batch 2 pure-logic cases
run(['describeMonthForm', 'describeCharts'], () => { // G6: a fixed-cost row's entered number IS rubles — no ₽/unit multiplier anywhere in the math
  const gs = { config: [{ id: 't', name: 'Trash', unit: '\u20bd/month', price: 2, active: true, fixed: true, seed: null }], history: [
    { month: '2026-08', rows: [{ ref: 't', name: 'Trash', unit: '\u20bd/month', fixed: true, curr: 310.5, price: 2 }] },
  ] };
  eq(A.describeCharts(gs, 'money')[0].bars[0].v, 310.5, 'G6 garbage money bar = the absolute monthly ₽ typed (not ×2 config price)');
  const live = A.describeMonthForm(gs, '2026-09', { t: 400 }).fields[0];
  eq(live.money, 400, 'G6 a fixed row previews its entered rubles as-is even when config price is 2');
  eq(live.hint, null, 'fixed row carries no baseline/price hint copy');
});

run(['clearHistory'], () => {
  const s = A.clearHistory(st);
  eq(s.history.length, 0, 'G7 history emptied by clearHistory');
  ok(s.config.length === st.config.length && s.config.every((c, i) => c.id === st.config[i].id), 'clearHistory never touches config/meters');
  eq(A.buildCsv(s).split('\n').length, 2, 'cleared state exports marker+header only (config untouched by a history wipe)');
});

// gate: every export must appear in ≥1 case above
const EXPORTS = Object.keys(A); const missing = EXPORTS.filter(n => !ran.has(n));
if (missing.length) fails.push(`coverage gate: exports without unit case: ${missing.join(', ')}`);
if (fails.length) { console.error('FAILURES\n' + fails.map((f, i) => `${i + 1}. ${f}`).join('\n')); process.exit(1); }
console.log(`OK unit layer — ${ran.size}/${EXPORTS.length} exports exercised (${EXPORTS.join(',')})`);
