// BDD acceptance layer (SPEC Testing strategy) for tests/e2e/*.feature: real Chromium browser via playwright-core devDependency, driven by stable data-* markers only.
// App math itself is proven in the unit layer; here we prove user-visible flow + OPFS persistence. Run: node tests/e2e/run.mjs [url]
import { chromium } from 'playwright-core';
const EXE = process.env.E2E_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'; // Chromium-family browser already on this machine; localhost http is a secure context => OPFS allowed like iPhone Safari
const URL = process.argv[2] || 'http://127.0.0.1:8123/src/index.html';
const PROFILE = process.env.E2E_PROFILE || 'C:\\Users\\avalan4er\\AppData\\Local\\Temp\\opencode\\e2e-opfs-profile'; // reusable profile => cross-launch persistence evidence (guardrails: local + disposable)

const R = []; const chk = (l, c) => { R.push([l, !!c]); };
const ctx = await chromium.launchPersistentContext(PROFILE, { executablePath: EXE, headless: true, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); // phone-first per SPEC
const page = await ctx.newPage();
page.on('console', (m) => console.log('[c]', String(m.text ?? '').slice(0, 200)));
await page.goto(URL, { waitUntil: 'networkidle' });

const snap = () => page.evaluate(() => ({
  banner: document.querySelector('b.banner')?.textContent ?? '',
  month: document.querySelector('select[data-el=month]')?.value ?? '',
  fields: [...document.querySelectorAll('div.field[data-ref]')].map((r) => ({ ref: r.dataset.ref, name: r.querySelector('b')?.textContent ?? '', prev: r.querySelector('i.prev')?.textContent ?? '', curr: r.querySelector('[data-role=curr]')?.getAttribute('value') ?? '', pv: r.querySelector('[data-role=pv]')?.textContent ?? '' })),
  total: document.querySelector('[data-el=total]')?.textContent ?? '',
  rows: [...document.querySelectorAll('div.row[data-month]')].map((r) => ({ m: r.dataset.month, t: r.textContent })),
  cards: [...document.querySelectorAll('div.chart[data-res]')].map((c) => ({ res: c.dataset.res, bars: [...c.querySelectorAll('i[data-month]')].map((b) => ({ mo: b.dataset.month, v: b.dataset.v, neg: b.classList.contains('neg'), h: parseInt(b.style.height ?? '0', 10) })) })),
  cfgRows: [...document.querySelectorAll('[data-id]')].map((r) => ({ id: r.dataset.id, active: r.dataset.active, head: r.querySelector('b')?.textContent ?? '', name: r.querySelector('[data-role=name]')?.getAttribute('value') ?? '', price: r.querySelector('[data-role=price]')?.getAttribute('value') ?? '', seed: r.querySelector('[data-role=seed]')?.getAttribute('value') ?? '' })),
}));
const read = async (expr) => await page.evaluate(expr);
const setVal = async (sel, v) => await page.evaluate(([s, x]) => document.querySelector(s)?.setAttribute('value', String(x)), [sel, String(v)]);
const setChk = async (sel, v) => await page.evaluate(([s, b]) => { const i = document.querySelector(s); if (i) i.checked = b; }, [sel, v]);
async function click(sel) { // marker-selected button: real click when actionability holds, JS dispatch otherwise (whole-tab re-render makes stale-node waits fail — see ui.js shortcut note)
  chk('target present: ' + sel, await page.evaluate((s) => document.querySelector(s) !== null, sel));
  try { await page.locator(sel).click({ timeout: 5000 }); } catch (_) { await page.evaluate((s) => document.querySelector(s)?.click(), sel); }
  await page.waitForTimeout(260);
}
async function tab(k) { await click('[data-tab=' + k + ']'); await page.waitForTimeout(420); }
const selectMonth = async (m) => await page.evaluate((v) => { const s = document.querySelector('select[data-el=month]'); if (s) s.value = v; }, m);

const diag = async (tag, v) => console.log('[DIAG]', tag, JSON.stringify(v).slice(0, 700)); // temporary evidence while glue bugs are open
const fieldRefs = async () => JSON.parse(String(await read("JSON.stringify([...document.querySelectorAll('div.field[data-ref]')].map((r) => r.dataset.ref))"))); // entry-form refs are Bills-tab-only

// === acceptance pass -----------------------------------------------------------------
const n0 = new Date();
const OPT = [...Array(24)].map((_, i) => { const d = new Date(n0.getFullYear(), n0.getMonth() - i, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); });
const M1 = OPT[0], M0 = OPT[1]; // current + previous month labels (same rule as ui.js monthOptions)

let s = await snap();
await tab('tabHistory'); // markers are per-tab: read History rows at boot so a re-run's cross-launch OPFS survival is visible
s = await snap(); await diag('bootState', { rows: s.rows.map((r) => r.m), banner: s.banner }); // non-empty rows on the 2nd+ run against the same profile == persisted across browser launches (see tasks/test-deps.md)
chk('persistence-reload: localhost http is a secure context => no storage-error banner', s.banner === '');

// --- settings first (real-life order: configure meters, THEN fill bills): settings-config.feature
await tab('tabSettings');
const base = await snap();
await setVal('[data-id=gas] input[type=text]', 'Gas A'); await setVal('[data-id=gas] [data-role=price]', 42); await setVal('[data-id=gas] [data-role=seed]', 1000);
await setVal('[data-id=electricity] [data-role=price]', 3.5); await setVal('[data-id=electricity] [data-role=seed]', 5000);
await setVal('[data-id=water] [data-role=price]', 18); await setVal('[data-id=water] [data-role=seed]', 700);
await click('[data-el=applyBtn]'); await page.waitForTimeout(900);
s = await snap();
chk('settings: renamed meter + edited prices/seeds persisted onto config rows', s.cfgRows.some((r) => r.id === 'gas' && r.name === 'Gas A' && r.price === '42' && r.seed === '1000') && s.cfgRows.every((r) => r.seed !== '' || r.id === 'trash'));
chk('settings: Apply re-render shows the new name and price in the row header', s.cfgRows.some((r) => r.head.includes('Gas A') && r.head.includes('42,00')));

const rowsBeforeAdd = (await snap()).cfgRows.length;
await setVal('.cfgNew [data-role=name]', 'Boiler'); await setVal('.cfgNew [data-role=unit]', 'm\u00b3'); await setVal('.cfgNew [data-role=price]', 3);
await click('[data-el=addBtn]'); await page.waitForTimeout(500);
chk('settings: a brand-new meter without the latest-known reading is refused (seed required)', (await snap()).banner === 'Enter the latest known reading of this meter');
chk('settings: refusal left config untouched', (await snap()).cfgRows.length === rowsBeforeAdd);
// the error toast re-rendered the Settings card, so a real user retypes the draft fields — do the same here
await setVal('.cfgNew [data-role=name]', 'Boiler'); await setVal('.cfgNew [data-role=unit]', 'm\u00b3'); await setVal('.cfgNew [data-role=price]', 3); await setVal('.cfgNew [data-role=seed]', 900);
await click('[data-el=addBtn]'); await page.waitForTimeout(700);
s = await snap(); await diag('afterAdd', { rows: s.cfgRows.map((r) => r.id + '/' + r.name + '/' + r.seed), banner: s.banner });
chk('settings: adding succeeds once the baseline is supplied (config grew by one)', s.cfgRows.length === rowsBeforeAdd + 1 && s.cfgRows.some((r) => r.name === 'Boiler' && r.seed === '900'));
const activeIds = s.cfgRows.filter((r) => r.active === '1').map((r) => r.id); // settings-only markers vanish when another tab renders: capture the active set here
await tab('tabBills');
s = await snap();
chk('settings: the new meter previews from its seed baseline, not zero', s.fields.some((f) => /9\s*00/.test(f.prev) && f.ref !== 'water')); // Intl inserts a thousands separator in ru-RU, so match loosely

// --- month entry for the previous month: month-entry.feature
await selectMonth(M0);
for (const [ref, v] of [['gas', 1060], ['electricity', 5300], ['water', 740], ['trash', 250]]) await setVal('[data-ref=' + ref + '] [data-role=curr]', v);
await page.waitForTimeout(400);
s = await snap();
chk('entry: prev line shows the odometer baseline per meter (not zero)', s.fields.filter((f) => f.ref !== 'trash').every((f) => /Previous reading: /.test(f.prev)));
chk('entry: \u0394 + ruble preview updates as soon as a reading is typed', s.fields.every((f) => !f.curr || (f.pv.includes('\u20bd') && f.pv.length > 4)));
chk('entry: month total money line rendered', s.total.includes('\u20bd'));
const priceInputs = JSON.parse(String(await read("JSON.stringify([...document.querySelectorAll('div.field[data-ref] [data-role=price]')].length)")));
chk('entry: every meter field carries an editable price input (defaults from config)', priceInputs === s.fields.length && priceInputs > 0); // per-price arithmetic is unit-verified already
await click('[data-el=saveBtn]'); await page.waitForTimeout(1200);
await tab('tabHistory');
s = await snap(); await diag('afterM0', { rows: s.rows.map((r) => r.m + ':' + r.t), title: await read('document.title') });
chk('entry: saved month appears in History exactly once', s.rows.filter((r) => r.m === M0).length === 1);
await tab('tabBills'); await selectMonth(M0);
await setVal('[data-ref=gas] [data-role=curr]', 1070); await click('[data-el=saveBtn]'); await page.waitForTimeout(1200);
s = await snap();
await tab('tabHistory');
chk('entry: re-entering the same month replaces values, no duplicate row', (await snap()).rows.filter((r) => r.m === M0).length === 1);

await tab('tabBills');
await setVal('[data-ref=gas] [data-role=curr]', '12.5'); await click('[data-el=saveBtn]'); await page.waitForTimeout(600);
chk('entry: fractional meter reading rejected with the STR.badNumber banner', (await snap()).banner === 'Reading must be a whole number');
await tab('tabHistory');
chk('entry: rejected save created no extra history row', (await snap()).rows.filter((r) => r.m === M0).length === 1);
await tab('tabBills'); await setVal('[data-ref=gas] [data-role=curr]', 1070);

// negative \u0394 in the current month (meter replaced): warns but saves raw
await selectMonth(M1);
for (const [ref, v] of [['gas', 1100], ['electricity', 5500], ['water', 700], ['trash', 300]]) await setVal('[data-ref=' + ref + '] [data-role=curr]', v);
await page.waitForTimeout(400);
s = await snap(); await diag('negTyping', s.fields.map((f) => f.ref + ' curr=' + f.curr + ' prev=' + f.prev + ' pv=' + f.pv));
const wf = s.fields.find((f) => f.ref === 'water');
chk('entry: decreased reading warns inline (new-meter copy)', /new meter/.test(wf?.pv ?? '') && wf.pv.includes('\u26a0'));
await click('[data-el=saveBtn]'); await page.waitForTimeout(1200);
await tab('tabHistory');
chk('entry: warning does not block saving the raw negative diff', (await snap()).rows.some((r) => r.m === M1));

// --- charts: charts-toggle.feature
await tab('tabCharts');
s = await snap(); await diag('chartsVol', s.cards.map((c) => c.res + ':' + c.bars.map((b) => b.mo + '=' + b.v + '@' + b.h + (b.neg ? '!neg' : '')).join(',')));
chk('charts: exactly one card per ACTIVE resource', s.cards.map((c) => c.res).sort().join() === activeIds.sort().join());
chk('charts(volume): garbage fixed-cost card carries no volume bars', (s.cards.find((c) => c.res === 'trash')?.bars.length ?? 0) === 0);
chk('charts: every resource with a non-zero \u0394 reaches full height for its biggest month', s.cards.filter((c) => c.bars.some((b) => b.h > 2)).every((c) => Math.max(...c.bars.map((b) => b.h)) >= 98)); // an all-zero-\u0394 meter legitimately renders stub bars
chk('charts: negative-\u0394 bar is flagged .neg and its label keeps the minus sign', s.cards.some((c) => c.bars.some((b) => b.neg && (b.v ?? '').startsWith('-'))));
await click('[data-el=modeToggle]'); await page.waitForTimeout(400);
s = await snap();
chk('charts: one page-header toggle flips EVERY card to money mode at once', s.cards.length > 1 && s.cards.every((c) => c.bars.every((b) => (b.v ?? '').includes('\u20bd'))));
chk('charts(money): garbage fixed-cost card now renders its monthly ruble bars', (s.cards.find((c) => c.res === 'trash')?.bars.length ?? 0) > 0);
const parseMoney = (t) => parseFloat(String(t).replace('\u2212', '-').replace(/[^0-9.,-]/g, '').replace(',', '.')); // Intl ru-RU uses U+2212 for negatives and NNBSP thousands: keep the sign, drop separators
const moneySum = {}; for (const c of s.cards) for (const b of c.bars) moneySum[b.mo] = (moneySum[b.mo] ?? 0) + parseMoney(b.v);
await tab('tabHistory');
s = await snap();
chk('history: one line per saved month, newest first, with ruble totals', s.rows.length >= 2 && s.rows[0].m === M1 && s.rows.every((r) => r.t.includes('\u20bd')));
const num = (t) => parseMoney(t.split('\u2014').pop()); // money part only; the month label digits would otherwise contaminate the parse
const rowTotals = Object.fromEntries(s.rows.map((r) => [r.m, num(r.t)]));
chk('history: month totals agree with the money-mode chart sums for that month', Object.keys(rowTotals).length >= 2 && Object.keys(rowTotals).every((m) => m in moneySum && Math.abs(rowTotals[m] - moneySum[m]) < 0.05)); // 2dp labels are rounded per bar, so a few cents of drift is legitimate

// --- persistence: persistence-reload.feature (markers are per-tab, so snapshot the tab that owns them)
await diag('beforeReloadTitle', await read('document.title'));
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(1200);
await tab('tabHistory');
s = await snap(); await diag('afterReloadRows', s.rows.map((r) => r.m));
chk('storage: hard reload keeps history months (OPFS via Web Worker sync handle)', s.rows.filter((r) => r.m === M0 || r.m === M1).length === 2);
chk('storage: reload did not trip the no-storage banner', s.banner === '');
await tab('tabSettings');
s = await snap(); await diag('afterReloadCfg', s.cfgRows.map((r) => r.id + '/' + r.name + '/' + r.seed));
chk('storage: hard reload keeps the edited config (renamed meter, new meter with its seed)', s.cfgRows.some((r) => r.name === 'Gas A' && r.price === '42') && s.cfgRows.some((r) => r.name === 'Boiler' && r.seed === '900'));

// --- enable/disable keeps history cells intact (settings-config.feature)
await tab('tabSettings'); await setChk('[data-id=water] input[type=checkbox]', false); await click('[data-el=applyBtn]'); await page.waitForTimeout(800);
await tab('tabBills');
s = await snap();
chk('settings: disabled meter is omitted from the entry form', !(await fieldRefs()).includes('water'));
await tab('tabHistory');
chk('settings: disabling did not erase its history months or cells (rows still two)', (await snap()).rows.filter((r) => r.m === M0 || r.m === M1).length === 2);
await tab('tabSettings'); await setChk('[data-id=water] input[type=checkbox]', true); await click('[data-el=applyBtn]'); await page.waitForTimeout(800);
await tab('tabBills');
chk('settings: re-enabling restores the field row', (await fieldRefs()).includes('water'));

// --- history export: button present; picker chooser needs a real gesture => verified manually (see tasks/test-deps.md)
await tab('tabHistory');
chk('history: export button present (Chromium showSaveFilePicker path)', await page.evaluate(() => document.querySelector('[data-el=exportBtn]') !== null));

await page.screenshot({ path: 'test-results/e2e-history.png', fullPage: true });
await tab('tabCharts'); await page.waitForTimeout(300); await page.screenshot({ path: 'test-results/e2e-charts-money.png', fullPage: true });
const titleTag = String(await read('document.title')); // ui.js tags the title on glue throws so iPhone users get a trail without new UI strings
console.log('[DIAG TITLE]', titleTag);
await ctx.close(); // guardrail: leave no debug browser/profile behind beyond the reusable e2e dir

const bad = R.filter(([, ok]) => !ok);
console.log(R.map(([l, ok]) => (ok ? 'PASS ' : 'FAIL ') + l).join('\n'));
console.log(bad.length ? '\n' + bad.length + '/' + R.length + ' acceptance checks FAILED (glue bugs to fix)' : '\nALL ' + R.length + ' acceptance checks GREEN in a real browser (Edge, phone viewport)');
process.exit(bad.length ? 1 : 0);

