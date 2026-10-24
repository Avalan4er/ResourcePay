// ResourcePay pure logic module — DOM-free descriptors/calcs only (browser glue lives in index.html, integration-tested).
export const STR = {
  tabBills: 'Bills', tabHistory: 'History', tabCharts: 'Charts', tabSettings: 'Settings',
  enterReading: 'Current meter reading', prevLabel: 'Previous reading', monthTotal: 'Month total ₽',
  exportCsv: 'Save history as CSV', chartVolume: 'By volume', chartMoney: 'By money',
  negativeDiff: 'reading decreased vs previous — new meter?', noSeedPrev: 'no baseline yet (set seed in Settings)',
  seedRequired: 'Enter the latest known reading of this meter', badNumber: 'Reading must be a whole number',
  csvDate: 'date', csvTotal: 'total ₽', ruble: '₽', deltaMark: 'Δ ',
};
export const DEFAULT_CONFIG = [
  { id: 'gas', name: 'Gas', unit: 'm³', price: 0, active: true, seed: null },
  { id: 'electricity', name: 'Electricity', unit: 'kWh', price: 0, active: true, seed: null },
  { id: 'water', name: 'Water', unit: 'm³', price: 0, active: true, seed: null },
  { id: 'trash', name: 'Garbage', unit: STR.ruble + '/month', price: 1, active: true, fixed: true, seed: null },
];

const numFmt = Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function fmtRub(n) { return `${numFmt.format(n)} ${STR.ruble}`; }
export function fmtInt(n) { return String(Math.round(n)); }
export function csvMoney(n) { return n.toFixed(2).replace('.', ','); }

// prev = latest earlier stored reading else configured seed baseline (gap months inherit last-known):
export function resolvePrev(history, id, month, seed) {
  const prior = history.filter(e => e.month < month);
  for (const e of prior.sort((a, b) => b.month.localeCompare(a.month))) {
    const row = e.rows.find(r => r.ref === id && !r.fixed); if (row) return row.curr;
  }
  return seed;
}

// single source for row delta/money given state+entry month; garbage = amount×snapshot price everywhere. shortcut: unknown Δ (seed-less first-ever month) contributes 0 money — form/Settings prompt prevents this in normal UI flow.
function rowDelta(state, row, month) { if (row.fixed) return null; const c = state.config.find(c => c.id === row.ref); const prev = resolvePrev(state.history, row.ref, month, c?.seed ?? null); return prev == null ? null : row.curr - prev; }
function rowMoneyOf(state, row, month) { if (row.fixed) return row.curr * row.price; const d = rowDelta(state, row, month); return d == null ? 0 : d * row.price; }

// form rows: active meters only, prev resolved w/ placeholders until curr entered
export function calcRows(state, month) {
  return state.config.filter(c => c.active !== false).map(c => ({
    ref: c.id, name: c.name, unit: c.unit, fixed: !!c.fixed, curr: null,
    prev: resolvePrev(state.history, c.id, month, c.seed), diff: null, money: null, warn: false,
  }));
}

// upsert replaces same-month entry (never duplicates); warns on negative Δ but still saves. shortcut: integers enforced only for known non-fixed meters; unknown refs = fixed/garbage semantics w/ decimal amounts — tighten if UI ever submits decimals to a meter field.
export function upsertMonth(state, month, vals, prices = {}) {
  const warnings = [];
  const rows = Object.entries(vals).map(([ref, curr]) => {
    const cfg = state.config.find(c => c.id === ref);
    if (cfg && !cfg.fixed && !Number.isInteger(Number(curr))) throw Error(STR.badNumber);
    if (!Number.isFinite(Number(curr))) throw Error(STR.badNumber);
    const fixed = cfg ? !!cfg.fixed : false;
    const row = { ref, name: cfg?.name ?? ref, unit: cfg?.unit ?? '', fixed, curr: Number(curr), price: prices[ref] ?? cfg?.price ?? 1 };
    const d = rowDelta(state, row, month);
    if (d != null && d < 0) warnings.push({ ref });
    return row;
  });
  const entry = { month, rows };
  const history = state.history.filter(e => e.month !== month).concat([entry]).sort((a, b) => b.month.localeCompare(a.month));
  return [{ ...state, history }, warnings];
}

// settings: patch by id OR add new; new non-fixed meters require seed baseline (enforced)
export function updateConfig(state, patch) {
  const cfg = state.config.map(c => c.id === patch.id ? { ...c, ...patch } : c);
  if (!cfg.some(c => c.id === patch.id)) {
    if (!patch.fixed && (patch.seed == null || !Number.isFinite(patch.seed))) throw Error(STR.seedRequired);
    cfg.push({ ...patch });
  }
  return { ...state, config: cfg };
}

// CSV wide table per Success#5 — one row/month oldest→newest, meter groups uniform labels (garbage money-only cells), #cfg marker block after rows incl seed; orphan refs keep columns forever.
export function buildCsv(state) {
  const months = state.history.map(e => e.month).sort();
  const groups = []; const seen = new Set();
  for (const c of state.config) if (!seen.has(c.id)) { seen.add(c.id); groups.push(c.id); }
  for (const e of [...state.history].sort((a, b) => a.month.localeCompare(b.month))) for (const r of e.rows) if (!seen.has(r.ref)) { seen.add(r.ref); groups.push(r.ref); }
  const label = id => { const c = state.config.find(x => x.id === id); if (c) return c.name; const rows = state.history.flatMap(e => e.rows.filter(r => r.ref === id)); return rows.length ? rows[rows.length - 1].name : id; };
  const header = [STR.csvDate, ...groups.flatMap(id => [label(id), STR.deltaMark + label(id), `${label(id)} ${STR.ruble}`]), STR.csvTotal];
  const lines = ['\uFEFF#resourcepay-v1', header.join(';')];
  for (const month of months) {
    const entry = state.history.find(e => e.month === month); if (!entry) continue;
    const cells = [month]; let total = 0;
    for (const id of groups) {
      const row = entry.rows.find(r => r.ref === id); if (!row) { cells.push('', '', ''); continue; }
      const money = rowMoneyOf(state, row, month); total += money;
      if (row.fixed) cells.push('', '', csvMoney(money));
      else { const d = rowDelta(state, row, month); cells.push(String(Math.round(row.curr)), d == null ? '' : String(d), csvMoney(money)); }
    }
    cells.push(csvMoney(total)); lines.push(cells.join(';'));
  }
  for (const c of state.config) lines.push(['#cfg', c.id, label(c.id), c.unit, c.active !== false ? '1' : '0', String(c.price).replace('.', ','), c.seed == null ? '' : String(c.seed)].join(';'));
  return lines.join('\n');
}

export function describeMonthForm(state, month) {
  return { fields: calcRows(state, month), totalMoneyLabel: STR.monthTotal };
}
export function describeHistoryRows(state) {
  return state.history.map(e => {
    let total = 0; const cells = [];
    for (const r of e.rows) {
      total += rowMoneyOf(state, r, e.month);
      cells.push(r.fixed ? fmtInt(r.curr) : fmtInt(rowDelta(state, r, e.month) ?? 0));
    }
    return { month: e.month, cells, total, fmt: fmtRub(total) };
  }).sort((a, b) => b.month.localeCompare(a.month));
}
export function describeCharts(state, mode) {
  return state.config.filter(c => c.active !== false).map(c => {
    const bars = [];
    for (const e of [...state.history].sort((a, b) => a.month.localeCompare(b.month))) {
      const row = e.rows.find(r => r.ref === c.id); if (!row) continue;
      const v = mode === 'money' ? rowMoneyOf(state, row, e.month) : (row.fixed ? null : rowDelta(state, row, e.month));
      if (v != null) bars.push({ month: e.month, v });
    }
    const max = Math.max(...bars.map(b => Math.abs(b.v)), 0);
    return { id: c.id, name: c.name, unit: c.unit, fixed: !!c.fixed, bars, pctOf: max, empty: bars.length === 0 };
  });
}
