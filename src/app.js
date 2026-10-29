// ResourcePay pure logic module — DOM-free descriptors/calcs only (browser glue lives in index.html, integration-tested).
export const STR = {
  tabBills: 'Показания', tabHistory: 'История', tabCharts: 'Графики', tabSettings: 'Настройки',
  enterReading: 'Текущие показания счетчиков', prevLabel: 'Предыдущие показания', monthTotal: 'Итого за месяц (₽)',
  exportCsv: 'Сохранить в CSV', chartVolume: 'Объем', chartMoney: 'Оплачено',
  negativeDiff: 'показания счетчика ниже чем предыдущие — новый счетчик?', noSeedPrev: 'не заданы начальные показания счетчика (см. настройки)',
  seedRequired: 'Введите последние показания этого счетчика', badNumber: 'Показания счетчика должны быть целым числом',
  csvDate: 'дата', csvTotal: 'итого ₽', ruble: '₽', deltaMark: 'Δ ',
  noStorage: 'этот браузер не может хранить показания', saved: 'сохранено ✓',
  saveMonth: 'Сохранить показания за этот месяц', applyChanges: 'Применить изменения', savedOk: 'Сохранено ✓',
  nothingEntered: 'Показания не заполнены', priceMissing: 'цена не указана (см. настройки)',
  lblAmount: 'месячная стоимость ₽', addMeterTitle: 'Добавить новый счетчик', addMeter: 'Добавить', clearHistory: 'Отчистить историю', confirmClear: 'Нажмите еще раз чтобы подтвердить отчистку истории',
  lblReading: 'текущие показания', lblPrice: '₽ за ед.', lblName: 'название', lblUnit: 'единицы измерения', lblSeedBase: 'последние показания', lblActive: 'активный', lblFixed: 'фиксированная месячная плата',
  lblPriceOf: '{x} за {unit}', colMeter: 'счетчик', colReading: 'показания', colDelta: '\u0394 показаний', colPrice: '\u20bd за ед', colMoney: '\u20bd сумма', // P4 readout + P7 table headings (placeholders stay translatable); colMoney added with the History money-per-meter column (P7-re-pin)
  emptyHistory: 'Сохранённых месяцев пока нет', emptyCharts: 'Нет данных — сохраните показания за месяц', // design v2 empty states (History tab / bar-less charts on a fresh profile)
};
export const DEFAULT_CONFIG = [
  { id: 'gas', name: 'Газ', unit: 'м³', price: 0, active: true, seed: null },
  { id: 'electricity', name: 'Электричество', unit: 'кВт/ч', price: 0, active: true, seed: null },
  { id: 'water', name: 'Вода', unit: 'м³', price: 0, active: true, seed: null },
  { id: 'trash', name: 'Сбор мусора', unit: STR.ruble + '/month', price: 1, active: true, fixed: true, seed: null },
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

// single source for row delta/money given state+entry month; garbage = absolute monthly ₽ as typed (bug G6: no ₽/unit multiplier — the entered number already IS rubles, and it may differ per month). shortcut: unknown Δ (seed-less first-ever month) contributes 0 money — form/Settings prompt prevents this in normal UI flow.
function rowDelta(state, row, month) { if (row.fixed) return null; const c = state.config.find(c => c.id === row.ref); const prev = resolvePrev(state.history, row.ref, month, c?.seed ?? null); return prev == null ? null : row.curr - prev; }
function rowMoneyOf(state, row, month) { if (row.fixed) return row.curr; const d = rowDelta(state, row, month); return d == null ? 0 : d * row.price; }

// form rows: active meters only, prev resolved w/ placeholders until curr entered. `saved`/`savedPrice` carry the month's existing row so re-entering a month keeps untouched readings instead of silently dropping them.
export function calcRows(state, month) {
  const saved = state.history.find((e) => e.month === month);
  return state.config.filter((c) => c.active !== false).map((c) => ({
    ref: c.id, name: c.name, unit: c.unit, fixed: !!c.fixed, curr: null,
    prev: resolvePrev(state.history, c.id, month, c.seed), diff: null, money: null, warn: false,
    saved: saved?.rows.find((r) => r.ref === c.id)?.curr ?? null, savedPrice: saved?.rows.find((r) => r.ref === c.id)?.price ?? null,
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

// G7 task: wipe saved months only (config/meters untouched); CSV of a cleared state is marker+header only
export function clearHistory(state) { return { ...state, history: [] }; }

// settings: patch by id OR add new; new non-fixed meters require seed baseline (enforced)
export function updateConfig(state, patch) {
  const cfg = state.config.map(c => c.id === patch.id ? { ...c, ...patch } : c);
  if (!cfg.some(c => c.id === patch.id)) {
    if (!patch.fixed && (patch.seed == null || !Number.isFinite(patch.seed))) throw Error(STR.seedRequired);
    cfg.push({ ...patch });
  }
  return { ...state, config: cfg };
}

// CSV wide table per Success#5 — one row/month oldest→newest, meter groups uniform labels (garbage money-only cells); HISTORY-ONLY file (bug H1: no #cfg settings block — a fresh-device import would need an importer, out of scope; orphan refs keep columns forever).
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
  // H1: no config/seed metadata block — the backup is history-only (restoring onto a fresh device would need an importer, out of scope)
  return lines.join('\n');
}

// form descriptor incl optional current form values/price edits → pure data for DOM glue (one contract drives both blank form & live preview):
export function describeMonthForm(state, month, vals = {}, prices = {}) {
  const rows = calcRows(state, month).map(f => {
    const curr = vals[f.ref] ?? f.saved; // untouched fields fall back to the month's stored reading so a re-save never silently drops other meters
    if (curr == null) return f;
    f.curr = curr;
    const row = { ref: f.ref, fixed: f.fixed, curr, price: prices[f.ref] ?? f.savedPrice ?? state.config.find((c) => c.id === f.ref)?.price ?? 1 };
    f.priceUsed = row.price; // P4: the DOM paints which ₽/unit figure this month's money actually used
  const d = rowDelta(state, row, month); f.diff = d; f.money = rowMoneyOf(state, row, month); f.warn = d != null && d < 0;
    // honest preview copy: unknown baseline or unset ₽/unit must not read as a real 0 figure (bug cases B3/B10)
    f.hint = f.fixed ? null : f.prev == null ? STR.noSeedPrev : row.price === 0 ? STR.priceMissing : null;
    return f;
  });
  return { fields: rows, totalMoney: rows.reduce((t, f) => t + (f.money ?? 0), 0), totalMoneyLabel: STR.monthTotal };
}
export function describeHistoryRows(state) { // H2: each line carries a per-meter breakdown (name/unit/Δ/₽), not just the total — totals come from that row's stored prices
  return state.history.map((e) => {
    let total = 0; const parts = []; const cells = [];
    for (const r of e.rows) {
      const money = rowMoneyOf(state, r, e.month); total += money;
      const d = rowDelta(state, r, e.month);
      cells.push(r.fixed ? fmtInt(r.curr) : fmtInt(d ?? 0));
      parts.push({ name: r.name, unit: r.unit, fixed: !!r.fixed, curr: r.curr, price: r.price, delta: d, money }); // P7: a History table also prints that month's own reading + the per-unit figure used (self-contained)
    }
    return { month: e.month, parts, cells, total, fmt: fmtRub(total) };
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
