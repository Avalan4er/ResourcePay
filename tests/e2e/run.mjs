// BDD acceptance layer (SPEC Testing strategy) for tests/e2e/*.feature: real Chromium browser via playwright-core devDependency, driven by stable data-* markers only.
// App math itself is proven in the unit layer; here we prove user-visible flow + OPFS persistence. Run: node tests/e2e/run.mjs [url]
import { chromium } from 'playwright-core';
import { STR as AP } from '../../src/app.js'; // copies come from the app's STR dictionary so acceptance text can never drift from what the UI paints (no duplicated literals)
const EXE = process.env.E2E_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'; // Chromium-family browser already on this machine; localhost http is a secure context => OPFS allowed like iPhone Safari
const URL = process.argv[2] || 'http://127.0.0.1:8123/src/index.html';
const PROFILE = process.env.E2E_PROFILE || 'C:\\Users\\avalan4er\\AppData\\Local\\Temp\\opencode\\e2e-opfs-profile'; // reusable profile => cross-launch persistence evidence (guardrails: local + disposable)

const R = []; const chk = (l, c) => { R.push([l, !!c]); };
const T0 = Date.now(); // wall clock for the evidence line at the end: with condition-waits instead of fixed beats a green run costs ~Edge launch + real work
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
const read = async (expr) => await page.evaluate(expr); // legacy string-expression reader (kept for simple probes)
const setVal = async (sel, v) => await page.evaluate(([s, x]) => document.querySelector(s)?.setAttribute('value', String(x)), [sel, String(v)]);
const setChk = async (sel, v) => await page.evaluate(([s, b]) => { const i = document.querySelector(s); if (i) i.checked = b; }, [sel, v]);
const beat = async () => await page.evaluate(() => true); // one round-trip: DOM/microtask work the previous call triggered is already applied (previews recompute synchronously on attribute mutation)
const frames = async () => { let prev = -1; for (let i = 0; i < 4; i++) { const h = await page.evaluate(() => document.body.getBoundingClientRect().height); if (h === prev) return true; prev = h; } return true; }; // layout-settled probe by repeated round-trips: requestAnimationFrame never fires reliably in headless Edge, so rAF-based waits hung the run
const until = async (what, fn, arg = null, timeout = 4000) => { const t0 = Date.now(); for (;;) { let v = false; try { v = await page.evaluate(fn, arg); } catch (_) {} if (v) return true; if (Date.now() - t0 > timeout) { console.log('[wait-timeout]', what); return false; } await page.waitForTimeout(120); } }; // polls a structural condition instead of sleeping a fixed beat; timeouts print as evidence, they never launder the chk that follows
const TAB_MARK = { tabBills: '[data-el=formCard]', tabHistory: '[data-el=exportBtn]', tabCharts: 'div.chart[data-res]', tabSettings: '[data-el=applyBtn]' }; // each tab owns at least one marker, so its presence means the re-render finished
const saves0 = async () => await page.evaluate(() => window.rpSaved ?? 0); // ui.js counts every saveState round-trip (rpSaved) so "persist done" is observable
const afterSave = async (n) => await until('OPFS save round-trip done', (x) => (window.rpSaved ?? 0) > x, n, 8000);
const clickAndSave = async (sel) => { const n = await saves0(); await click(sel); return await afterSave(n); }; // clicks a button whose handler persists, then waits for the save round-trip to finish (rpSaved counter), not a fixed sleep
const persistDone = () => until('persist wrote a status banner', () => document.querySelector('b.banner') !== null); // ui.js toasts on every persist branch (savedOk / noStorage), so a banner == the save round-trip completed
async function click(sel) { // marker-selected button: real click when actionability holds, JS dispatch otherwise (whole-tab re-render makes stale-node waits fail — see ui.js shortcut note)
  chk('target present: ' + sel, await page.evaluate((s) => document.querySelector(s) !== null, sel));
  try { await page.locator(sel).click({ timeout: 1200 }); } catch (_) { await page.evaluate((s) => document.querySelector(s)?.click(), sel); }
  await beat(); // the click handler's own DOM work is synchronous; anything async is waited for by a condition below, not a fixed beat
}
async function tab(k) { await click('[data-tab=' + k + ']'); await until('tab ' + k + ' rendered', (s) => document.querySelector(s) !== null, TAB_MARK[k]); console.log('[tab]', k); } // polls the re-rendered tab's own markers: boot/render cost is paid only as fast as it happens
const selectMonth = async (m) => await page.evaluate((v) => { const s = document.querySelector('select[data-el=month]'); if (s) { s.value = v; s.dispatchEvent(new Event('change')); } }, m); // a real option choice fires 'change'; previews follow it, so the harness must mirror that event to measure what a user sees

const diag = async (tag, v) => console.log('[DIAG]', tag, JSON.stringify(v).slice(0, 700)); // temporary evidence while glue bugs are open
const fieldRefs = async () => await page.evaluate(() => [...document.querySelectorAll('div.field[data-ref]')].map((r) => r.dataset.ref)); // entry-form refs are Bills-tab-only
const rects = async (sel) => await page.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => { const c = getComputedStyle(e); return c.display !== 'none' && c.visibility !== 'hidden'; }).map((e) => { const b = e.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; }), sel); // layout evidence measures the VISUAL stack only: a display:none control (B8 hides price at default) has no rect and must not count as overlap/containment
const overlaps = (a, b) => a[0] < b[0] + b[2] - 1 && b[0] < a[0] + a[2] - 1 && a[1] < b[1] + b[3] - 1 && b[1] < a[1] + a[3] - 1;
const inside = (outer, inner, tol) => inner[0] >= outer[0] - tol && inner[1] >= outer[1] - tol && inner[0] + inner[2] <= outer[0] + outer[2] + tol && inner[1] + inner[3] <= outer[1] + outer[3] + tol;
const vGaps = (list) => [...Array(Math.max(0, list.length - 1))].map((_, i) => list[i + 1][1] - (list[i][1] + list[i][3])); // vertical rhythm between stacked cards (B2/C1)
const stackGaps = (ks) => { const b = ks.slice().sort((a, c) => a[1] - c[1]); return [...Array(Math.max(0, b.length - 1))].map((_, i) => b[i + 1][1] - (b[i][1] + b[i][3])); }; // gaps between y-stacked rects (rows are column layouts now: B5/S4)
const leftOff = (rowRect, ks) => Math.max(0, ...ks.map((k) => k[0] - rowRect[0])); // how far the rightmost control sits from its row's left edge — a stranded control (S4) spikes here
const rowKids = async (rowSel) => { const r = (await rects(rowSel))[0]; return { r, kids: await rects(rowSel + ' input'), all: await rects(rowSel + ' *') }; }; // row box + its visible controls + every visible descendant (labels included)

// === acceptance pass -----------------------------------------------------------------
const n0 = new Date();
const OPT = [...Array(24)].map((_, i) => { const d = new Date(n0.getFullYear(), n0.getMonth() - i, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); });
const M1 = OPT[0], M0 = OPT[1]; // current + previous month labels (same rule as ui.js monthOptions)

let s = await snap();
await tab('tabHistory'); // markers are per-tab: read History rows at boot so a re-run's cross-launch OPFS survival is visible
s = await snap(); await diag('bootState', { rows: s.rows.map((r) => r.m), banner: s.banner }); // non-empty rows on the 2nd+ run against the same profile == persisted across browser launches (see tasks/test-deps.md)
chk('persistence-reload: localhost http is a secure context => no storage-error banner', s.banner === '');

const visInputs = async (sel) => await page.evaluate((s) => [...document.querySelectorAll(s)].filter((i) => !i.hidden).map((i) => i.dataset.role), sel); // price input hides while it equals its default (B8)

// === bug batch part A — needs a CLEAN OPFS profile (delete E2E_PROFILE dir before the run): seeds/prices must be untouched so "no baseline" months are real. A stale profile trips the precondition chk below rather than silently mis-reporting B3/B10.
await tab('tabSettings');
const freshCfg = await page.evaluate(() => [...document.querySelectorAll('[data-id]')].map((r) => ({ id: r.dataset.id, price: r.querySelector('[data-role=price]')?.getAttribute('value') ?? '', seed: r.querySelector('[data-role=seed]')?.getAttribute('value') ?? '', head: r.querySelector('b')?.textContent ?? '' })));
chk('precondition: fresh profile (no seeds entered, meter prices still default) so the no-baseline cases apply', freshCfg.length >= 3 && freshCfg.every((r) => r.seed === '') && freshCfg.filter((r) => !/\/month/.test(r.head)).every((r) => +r.price === 0));
const OLDEST = OPT[OPT.length - 1]; // nothing predates it, and with default config prev=null & price=0 → previews must be honest hints (B3/B10), not faked zeros
await tab('tabBills'); await selectMonth(OLDEST);
s = await snap();
const refsA = await fieldRefs();
const optTexts = await page.evaluate(() => [...(document.querySelector('select[data-el=month]')?.options ?? [])].map((o) => o.textContent)); // arrow form: complex option-list accessors stay readable, Playwright deserializes the array
chk('B1 every month <select> option shows its month text (was an empty box)', optTexts.length > 3 && optTexts.every((x) => /^\d{4}-\d{2}$/.test(String(x))));
await frames(); const rowGeo = []; for (const ref of refsA) rowGeo.push(await rowKids('div.field[data-ref=' + ref + ']')); // B2/B4/B5 evidence: the row rect + its input rects
chk('B2 meter rows keep vertical margin (>=4px gaps, nothing touching)', vGaps(rowGeo.map((g) => g.r)).every((gap) => gap >= 4));
chk('B4 every input sits inside its meter row (nothing sticks out)', rowGeo.every((g) => g.kids.length > 0 && g.kids.every((k) => inside(g.r, k, 4))));
chk('B4 nothing inside a meter row overlaps (controls + labels stacked clear)', rowGeo.every((g) => { const a = g.all; for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) if (overlaps(a[i], a[j])) return false; return a.length > 1; }));
chk('B4 meter rows full-width one-per-row (not half the screen)', rowGeo.length >= 2 && rowGeo.every((g) => g.r[2] >= 300));
chk('B4 meter rows do not sit side by side (same left edge)', rowGeo.every((g, i) => i === 0 || Math.abs(g.r[0] - rowGeo[i - 1].r[0]) < 8));
const inpStyle = await page.evaluate(() => { const i = document.querySelector('div.field input'); return i ? [getComputedStyle(i).borderWidth, getComputedStyle(i).paddingInline] : ['0px', '0px']; });
chk('B5 inputs styled (border+padding computed) and their row keeps >=4px vertical rhythm', inpStyle[0] !== '0px' && inpStyle[1] !== '0px' && rowGeo.every((g) => g.all.length > 1 && stackGaps(g.all).every((x) => x >= 4)));
const lblStats = await page.evaluate(() => { const rows = [...document.querySelectorAll('div.field[data-ref]')]; let unlabeled = 0, labeled = 0; rows.forEach((r) => [...r.querySelectorAll('input[data-role]')].forEach((i) => { const t = String(r.querySelector(`i.lbl[data-for=${i.getAttribute('data-role')}`)?.textContent ?? '').trim(); if (t) labeled++; else unlabeled++; })); return { unlabeled, labeled }; }); // G6 changed what a row holds: every INPUT must own a label, rows need no label for controls they don't carry
chk('B7 every meter row labels its own inputs with STR copy', lblStats?.unlabeled === 0 && (lblStats?.labeled ?? 0) >= refsA.length + 1); // one label per input; garbage needs only its reading label
const visPerRow = []; for (const ref of refsA) visPerRow.push(await visInputs('div.field[data-ref=' + ref + '] input'));
chk('B8 only the reading input is visible while price equals its default', visPerRow.length === refsA.length && visPerRow.every((arr) => arr.length === 1 && arr[0] === 'curr'));
await setVal(`[data-ref=${refsA[0]}] [data-role=price]`, 7); await beat(); // B8: previews/hidden flags recompute synchronously on the attribute mutation, so one round-trip is enough
const visAfter = await visInputs(`div.field[data-ref=${refsA[0]}] input`);
chk('B8 price field becomes visible once edited away from its default (still editable per month)', visAfter.length === 2);
await setVal(`[data-ref=${refsA[0]}] [data-role=price]`, 0);
await click('[data-el=saveBtn]'); await until('empty-form refusal banner painted', () => document.querySelector('b.banner') !== null); // B6: the save path bails out before persist, so its banner is the completion signal
chk('B6 save with no readings refused by STR.nothingEntered banner', (await snap()).banner === 'Nothing entered — type at least one reading');
await tab('tabHistory');
chk('B6 refused save created no empty month row', !(await snap()).rows.map((r) => r.m).includes(OLDEST));
await tab('tabBills'); // previews live in the Bills card only, so type the readings there
for (const ref of refsA) await setVal(`[data-ref=${ref}] [data-role=curr]`, 50);
await beat();
const pvA = JSON.parse(String(await read("JSON.stringify([...document.querySelectorAll('[data-role=pv]')].map((e) => e.textContent))")));
// B3/B10 honest-preview rule lives once in describeMonthForm: no baseline → STR.noSeedPrev words, baseline but unset ₽/unit → STR.priceMissing words; neither may fake a 0-figure money line.
const hintRows = pvA.filter((t) => String(t).includes('\u0394')); // previews that speak in words (hint copy), not numbers
const moneyShown = pvA.filter((t) => /\d[.,]\d{2}\s*\u20bd/.test(String(t))); // any "n,nn ₽" figure painted into a preview
chk('B3 no-baseline month never shows faked 0 money (pv holds hint copy, not ₽)', hintRows.length >= 3 && moneyShown.length === 0);
for (const ref of refsA) await setVal(`[data-ref=${ref}] [data-role=curr]`, ''); // leave the form as clean as it arrived

// --- settings first (real-life order: configure meters, THEN fill bills): settings-config.feature — water gets a seed but its price stays at the config default so B10's honest "baseline known, ₽/unit unset" preview is reachable in Bills below
await tab('tabSettings');
const base = await snap();
await setVal('[data-id=gas] input[type=text]', 'Gas A'); await setVal('[data-id=gas] [data-role=price]', 42); await setVal('[data-id=gas] [data-role=seed]', 1000);
await setVal('[data-id=electricity] [data-role=price]', 3.5); await setVal('[data-id=electricity] [data-role=seed]', 5000);
await setVal('[data-id=water] [data-role=seed]', 700);
await clickAndSave('[data-el=applyBtn]');
s = await snap();
chk('settings: renamed meter + edited prices/seeds persisted onto config rows', s.cfgRows.some((r) => r.id === 'gas' && r.name === 'Gas A' && r.price === '42' && r.seed === '1000') && s.cfgRows.every((r) => r.seed !== '' || r.id === 'trash'));
chk('settings: Apply re-render shows the new name and price in the row header', s.cfgRows.some((r) => r.head.includes('Gas A') && r.head.includes('42,00')));

const rowsBeforeAdd = (await snap()).cfgRows.length;
await setVal('.cfgNew [data-role=name]', 'Boiler'); await setVal('.cfgNew [data-role=unit]', 'm\u00b3'); await setVal('.cfgNew [data-role=price]', 3);
await click('[data-el=addBtn]'); await until('seed-required banner painted', () => document.querySelector('b.banner') !== null);
chk('settings: a brand-new meter without the latest-known reading is refused (seed required)', (await snap()).banner === 'Enter the latest known reading of this meter');
chk('settings: refusal left config untouched', (await snap()).cfgRows.length === rowsBeforeAdd);
// the error toast re-rendered the Settings card, so a real user retypes the draft fields — do the same here
await setVal('.cfgNew [data-role=name]', 'Boiler'); await setVal('.cfgNew [data-role=unit]', 'm\u00b3'); await setVal('.cfgNew [data-role=price]', 3); await setVal('.cfgNew [data-role=seed]', 900);
await clickAndSave('[data-el=addBtn]');
s = await snap(); await diag('afterAdd', { rows: s.cfgRows.map((r) => r.id + '/' + r.name + '/' + r.seed), banner: s.banner });
chk('settings: adding succeeds once the baseline is supplied (config grew by one)', s.cfgRows.length === rowsBeforeAdd + 1 && s.cfgRows.some((r) => r.name === 'Boiler' && r.seed === '900'));
const activeIds = s.cfgRows.filter((r) => r.active === '1').map((r) => r.id); // settings-only markers vanish when another tab renders: capture the active set here
await tab('tabBills');
s = await snap();
chk('settings: the new meter previews from its seed baseline, not zero', s.fields.some((f) => /9\s*00/.test(f.prev) && f.ref !== 'water')); // Intl inserts a thousands separator in ru-RU, so match loosely

// B10 honest repro: a meter whose odometer baseline IS known (seed typed in Settings above) but whose ₽/unit is still the config default 0 → the preview must name the missing price, not paint 0,00 rubles. Reachable only after Settings seeded a meter, hence here and not in the fresh-profile group above.
await selectMonth(OLDEST); await setVal('[data-ref=water] [data-role=curr]', 740); await beat();
const wrow = JSON.parse(String(await read("JSON.stringify((() => { const r = document.querySelector('[data-ref=water]'); return r ? { prev: r.querySelector('i.prev')?.textContent ?? '', pv: r.querySelector('[data-role=pv]')?.textContent ?? '' } : null })())")));
chk('B10 baseline known but ₽/unit unset ⇒ preview names the missing price, never a 0,00 ruble figure', /price not set/.test(wrow?.pv ?? '') && !/\d[.,]\d{2}\s*\u20bd/.test(wrow?.pv ?? ''));
// --- month entry for the previous month: month-entry.feature — water keeps its price UNSET here so B10's honest repro above (baseline known, ₽/unit missing) is what the user saw
await selectMonth(M0);
for (const [ref, v] of [['gas', 1060], ['electricity', 5300], ['water', 740], ['trash', 250]]) await setVal('[data-ref=' + ref + '] [data-role=curr]', v);
await beat();
s = await snap();
chk('entry: prev line shows the odometer baseline per meter (not zero)', s.fields.filter((f) => f.ref !== 'trash').every((f) => /Previous reading: /.test(f.prev)));
chk('entry: \u0394 + ruble preview updates as soon as a reading is typed', s.fields.filter((f) => f.curr && !/\/month/.test(f.name)).every((f) => (f.pv.includes('\u20bd') || /price not set|no baseline yet/.test(f.pv)) && f.pv.length > 4)); // fixed-cost rows (garbage) intentionally have no \u20bd line; an unset price reads as words instead
chk('entry: month total money line rendered', s.total.includes('\u20bd'));
const priceInputs = JSON.parse(String(await read("JSON.stringify([...document.querySelectorAll('div.field[data-ref] [data-role=price]')].length)")));
const meterFields = s.fields.filter((f) => !/\/month/.test(f.name)); // G6: a fixed-cost row has no ₽/unit multiplier at all, so only meters carry one
chk('entry: every meter field carries an editable price input (defaults from config)', priceInputs === meterFields.length && meterFields.length > 0); // per-price arithmetic is unit-verified already
await clickAndSave('[data-el=saveBtn]');
await tab('tabHistory');
s = await snap(); await diag('afterM0', { rows: s.rows.map((r) => r.m + ':' + r.t), title: await read('document.title') });
chk('entry: saved month appears in History exactly once', s.rows.filter((r) => r.m === M0).length === 1);
await tab('tabBills'); await selectMonth(M0);
s = await snap(); // B9: after saving, leaving-then-re-entering must show that month's values again so a typo can be corrected in place (the STR prefill from saved rows)
chk("B9 re-entered month keeps its stored readings visible for correction", s.fields.filter((f) => f.curr).length >= 4);
await until('success toast cleared itself', () => document.querySelector('b.banner') === null, null, 5000); // B9/S6: the success copy must expire; polling finds the moment it does (a never-clearing banner times out and the chk below stays red)
chk('B9 success banner self-clears after ~4s (no permanent saved ✓ line)', (await snap()).banner === '');
await setVal('[data-ref=gas] [data-role=curr]', 1070); await clickAndSave('[data-el=saveBtn]');
s = await snap();
await tab('tabHistory');
chk('entry: re-entering the same month replaces values, no duplicate row', (await snap()).rows.filter((r) => r.m === M0).length === 1);

await tab('tabBills');
await setVal('[data-ref=gas] [data-role=curr]', '12.5'); await click('[data-el=saveBtn]'); await beat(); // rejected upsert throws before persist, so the banner is painted synchronously inside the click handler
chk('entry: fractional meter reading rejected with the STR.badNumber banner', (await snap()).banner === 'Reading must be a whole number');
await tab('tabHistory');
chk('entry: rejected save created no extra history row', (await snap()).rows.filter((r) => r.m === M0).length === 1);
await tab('tabBills'); await setVal('[data-ref=gas] [data-role=curr]', 1070);

// negative \u0394 in the current month (meter replaced): warns but saves raw
await selectMonth(M1);
for (const [ref, v] of [['gas', 1100], ['electricity', 5500], ['water', 700], ['trash', 300]]) await setVal('[data-ref=' + ref + '] [data-role=curr]', v);
await beat();
s = await snap(); await diag('negTyping', s.fields.map((f) => f.ref + ' curr=' + f.curr + ' prev=' + f.prev + ' pv=' + f.pv));
const wf = s.fields.find((f) => f.ref === 'water');
chk('entry: decreased reading warns inline (new-meter copy)', /new meter/.test(wf?.pv ?? '') && wf.pv.includes('\u26a0'));
await clickAndSave('[data-el=saveBtn]'); // negative \u0394 warns but must still persist the raw month
await tab('tabHistory');
chk('entry: warning does not block saving the raw negative diff', (await snap()).rows.some((r) => r.m === M1));

// --- charts: charts-toggle.feature
await tab('tabCharts');
s = await snap(); await diag('chartsVol', s.cards.map((c) => c.res + ':' + c.bars.map((b) => b.mo + '=' + b.v + '@' + b.h + (b.neg ? '!neg' : '')).join(',')));
chk('charts: exactly one card per ACTIVE resource', s.cards.map((c) => c.res).sort().join() === activeIds.sort().join());
chk('charts(volume): garbage fixed-cost card carries no volume bars', (s.cards.find((c) => c.res === 'trash')?.bars.length ?? 0) === 0);
chk('charts: every resource with a non-zero \u0394 reaches full height for its biggest month', s.cards.filter((c) => c.bars.some((b) => b.h > 2)).every((c) => Math.max(...c.bars.map((b) => b.h)) >= 98)); // an all-zero-\u0394 meter legitimately renders stub bars
chk('charts: negative-\u0394 bar is flagged .neg and its label keeps the minus sign', s.cards.some((c) => c.bars.some((b) => b.neg && (b.v ?? '').startsWith('-'))));
await click('[data-el=modeToggle]'); await beat(); // the onclick flips `mode` and repaints synchronously
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
await page.reload({ waitUntil: 'networkidle' }); await until('app booted from OPFS', () => document.querySelector('[data-tab=tabBills]') !== null, null, 9000); // renderAll runs only after bootLoad awaited ⇒ markers imply the load completed
await tab('tabHistory');
s = await snap(); await diag('afterReloadRows', s.rows.map((r) => r.m));
chk('storage: hard reload keeps history months (OPFS via Web Worker sync handle)', s.rows.filter((r) => r.m === M0 || r.m === M1).length === 2);
chk('storage: reload did not trip the no-storage banner', s.banner === '');
await tab('tabSettings');
s = await snap(); await diag('afterReloadCfg', s.cfgRows.map((r) => r.id + '/' + r.name + '/' + r.seed));
chk('storage: hard reload keeps the edited config (renamed meter, new meter with its seed)', s.cfgRows.some((r) => r.name === 'Gas A' && r.price === '42') && s.cfgRows.some((r) => r.name === 'Boiler' && r.seed === '900'));

// --- enable/disable keeps history cells intact (settings-config.feature)
await tab('tabSettings'); await setChk('[data-id=water] input[type=checkbox]', false); await clickAndSave('[data-el=applyBtn]');
await tab('tabBills');
s = await snap();
chk('settings: disabled meter is omitted from the entry form', !(await fieldRefs()).includes('water'));
await tab('tabHistory');
chk('settings: disabling did not erase its history months or cells (rows still two)', (await snap()).rows.filter((r) => r.m === M0 || r.m === M1).length === 2);
await tab('tabSettings'); await setChk('[data-id=water] input[type=checkbox]', true); await clickAndSave('[data-el=applyBtn]'); // re-enabling must restore the field row without losing months
await tab('tabBills');
chk('settings: re-enabling restores the field row', (await fieldRefs()).includes('water'));

// --- history export: button present; picker chooser needs a real gesture => verified manually (see tasks/test-deps.md)
await tab('tabHistory');
chk('history: export button present (Chromium showSaveFilePicker path)', await page.evaluate(() => document.querySelector('[data-el=exportBtn]') !== null));

// === bug batch part B — ids needing the other tabs (tasks/bugs.md) ----------------------
await tab('tabSettings');
const cfgIds = await page.evaluate(() => [...document.querySelectorAll('[data-id]')].map((r) => r.dataset.id));
chk('S7 Settings action button reads as an action (STR.applyChanges), not a saved-status', String(await page.evaluate(() => document.querySelector('[data-el=applyBtn]')?.textContent ?? '')) === 'Apply changes');
const cfgHead = await page.evaluate(() => [...document.querySelectorAll('[data-id]')].map((r) => r.querySelector('b')?.textContent ?? ''));
chk('S1 config headers no longer spam "no baseline yet" placeholders', cfgIds.length >= 3 && cfgHead.every((t) => !String(t).includes('no baseline yet')));
const cfgLbl = await page.evaluate(() => [...document.querySelectorAll('[data-id] i.lbl')].map((e) => e.textContent));
chk('S3 every config row labels its inputs (name/price/seed/active copy from STR)', cfgLbl.length >= 3 * cfgIds.length && cfgLbl.every((t) => String(t).trim() !== ''));
await frames(); const cfgGeo = []; for (const id of cfgIds) cfgGeo.push(await rowKids('[data-id=' + id + ']')); // S2/S4 evidence: per-row controls + their stacking
chk('S2 settings inputs bounded width (<=8rem) and inside their row', cfgGeo.every((g) => g.kids.length > 0 && g.kids.every((k) => inside(g.r, k, 4) && k[2] <= 120)));
chk('S4 enable-toggle controls hug the row\'s left edge (<=3rem) instead of stranding across the page', cfgGeo.every((g) => g.kids.length > 0 && leftOff(g.r, g.kids) <= 48 && stackGaps(g.kids).every((x) => x >= 2)));
const addLbl = await page.evaluate(() => [...document.querySelectorAll('.cfgNew i.lbl')].map((e) => e.textContent));
chk('S5 add-new-meter block labels all four fields', addLbl.length >= 4 && addLbl.every((t) => String(t).trim() !== ''));
await setVal('[data-id=water] [data-role=price]', 21); await clickAndSave('[data-el=applyBtn]'); // S7: the Apply button is an action, and clicking it writes through to config+OPFS
chk('S7 Apply persisted the edit (config row shows the new price)', (await snap()).cfgRows.some((r) => r.id === 'water' && r.price === '21'));
await until('success banner cleared itself after Apply', () => document.querySelector('b.banner') === null, null, 5000); // S6: same root cause as B9 — poll for the expiry instead of sleeping 4s
chk('S6 success banner cleared within 4s of a good Apply (errors still persistent)', (await snap()).banner === '');
await setVal('[data-id=water] [data-role=seed]', 643); await clickAndSave('[data-el=applyBtn]'); // S8 repro: a seed typed into an existing meter's row must reach the Bills baseline for months that predate every reading
await tab('tabBills'); await selectMonth(OLDEST);
const waterPrev = String(await read("(() => { const r = document.querySelector('[data-ref=water] i.prev'); return r?.textContent ?? '' })()"));
await diag('s8state', { month: await read("(() => document.querySelector('select[data-el=month]')?.value)"), waterPrev, cfg: (await snap()).cfgRows.map((r) => r.id + '/' + r.seed) }); // real prev-line evidence while S8 glue is open
chk('S8 a seed entered in Settings really becomes the Bills baseline for a meter with no earlier rows', /6[\s\u202f\n]?43/.test(waterPrev));
await tab('tabCharts'); await frames();
const tgl = String(await read("(() => { const t = document.querySelector('[data-el=modeToggle]'); return t?.tagName + '/' + (t?.type ?? '') })()"));
chk('C2 volume/money control is a radio element, not a plain button', tgl.startsWith('INPUT/') && tgl.endsWith('radio'));
const modeLbls = await page.evaluate(() => { const t = document.querySelector('[data-el=modeToggle]'); if (!t) return []; const card = t.closest('div.card') ?? t.parentElement; return [...card.querySelectorAll(':scope > i.lbl')].map((e) => e.textContent); }); // labels sharing the toggle's card: C2 evidence
chk('C2 both mode labels sit next to the radio so its meaning is visible', modeLbls.length >= 2 && modeLbls.every((t) => String(t).trim() !== ''));
await frames(); const cGeo = await rects('div.chart[data-res]'); // C1: chart boxes need painted frames before measuring
chk('C1 chart cards keep vertical margin (>=4px stacked gaps)', cGeo.length >= 2 && vGaps(cGeo).every((g) => g >= 4));
await tab('tabHistory');
s = await snap();
chk('H2 a history line breaks the month down per meter, not just the total', s.rows.every((r) => String(r.t).includes('\u0394') && (String(r.t).match(/\u20bd/g) ?? []).length >= 3));

await page.screenshot({ path: 'test-results/e2e-history.png', fullPage: true });
await tab('tabCharts'); await frames(); await page.screenshot({ path: 'test-results/e2e-charts-money.png', fullPage: true });

// === bug batch part C — iPhone report 2026-10-25 (tasks/bugs-2.md) -------------
const meta = await page.evaluate(() => document.querySelector('meta[name=viewport]')?.getAttribute('content') ?? ''); // G2: iOS re-fits/taps-zoom when the declared scale is not locked
chk('G2 viewport meta declares device-width and switches iOS auto-fit zoom off (shrink-to-fit=no)', /width=device-width/.test(meta) && /shrink-to-fit=no/.test(meta));

await tab('tabBills'); await selectMonth(M1);
for (const [ref, v] of [['gas', 1105], ['electricity', 5505], ['water', 760], ['trash', 305]]) await setVal('[data-ref=' + ref + '] [data-role=curr]', v); // re-enter the current month (all Δ positive ⇒ the save paints a plain success toast, which G1 reads)
await beat();
const gshape = await page.evaluate(() => { const r = document.querySelector('div.field[data-ref=trash]'); if (!r) return null; return { hasPrev: r.querySelector('i.prev') !== null, prevTxt: String(r.querySelector('i.prev')?.textContent ?? ''), head: String(r.querySelector('b')?.textContent ?? '') }; });
chk('G5 fixed-cost garbage row prints no odometer baseline copy at all', gshape?.hasPrev === false);
const gLabel = await page.evaluate(() => document.querySelector('div.field[data-ref=trash] [data-for=curr]')?.textContent ?? ''); // G6b: the value typed in IS rubles
chk('G6b garbage field is labelled as its absolute monthly cost and no ₽/unit multiplier sits in the row', gLabel === AP.lblAmount && (await page.evaluate(() => document.querySelector('div.field[data-ref=trash] [data-role=price]') !== null)) === false);
const billsTap = await rects('.field input'); // visible controls only (B8 hides an untouched price, so it has no rect)
chk('G2 every Bills field is a full-size tap target (nothing undersized for iOS to zoom onto)', billsTap.length >= 4 && billsTap.every(([, , w, h]) => w >= 40 && h >= 40));

const nOk = await saves0(); await click('[data-el=saveBtn]');
chk('G1 save round-trip reported by rpSaved before the toast is read', (await until('OPFS save round-trip done', (x) => (window.rpSaved ?? 0) > x, nOk, 8000)) === true);
const bOk = await page.evaluate(() => { const b = document.querySelector('b.banner'); if (!b) return null; const c = getComputedStyle(b); const probe = document.createElement('p'); probe.style.color = 'var(--ok)'; document.body.append(probe); const okRgb = getComputedStyle(probe).color; probe.remove(); return { kind: b.dataset.kind, pos: c.position, z: Number(c.zIndex), isOkGreen: c.backgroundColor === okRgb, txt: b.textContent }; }); // G1/G3: toast marked as success + lifted above content + pinned (green read from the app's own --ok token)
chk('G1 success toast carries an ok kind and paints the app\'s green (--ok)', bOk?.kind === 'ok' && bOk?.isOkGreen === true); // GREEN evidence 2026-10-25: {"kind":"ok","pos":"fixed","z":9,"isOkGreen":true}
chk('G1/G3 toast is taken out of document flow above content (fixed + z-index over the tab strip)', bOk?.pos === 'fixed' && (bOk?.z ?? 0) >= 9);
await setVal('[data-ref=gas] [data-role=curr]', '12.5'); await click('[data-el=saveBtn]'); await beat(); // a rejected save paints an error banner that must stay warn-coloured and persistent
const bErr = await page.evaluate(() => { const b = document.querySelector('b.banner'); if (!b) return null; const c = getComputedStyle(b); return { kind: b.dataset.kind, bg: c.backgroundColor }; });
chk('G1 error banners keep the warn colour (only success copy turns green)', bErr?.kind === 'err' && bErr?.bg === 'rgb(194, 84, 78)');

await tab('tabCharts'); await frames(); // G3: scroll a page taller than the phone viewport and keep reading the toast
const scrolled = await page.evaluate(() => { window.scrollTo(0, document.body.scrollHeight); return window.scrollY; });
chk('G3 evidence holds weight: the Charts page really does overflow one screen', scrolled > 0);
const onScreen = await page.evaluate(() => { const b = document.querySelector('b.banner'); if (!b) return false; const r = b.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight; });
chk('G3 toast stays inside the viewport once scrolled', onScreen === true);

const knobs = await page.evaluate(() => [...document.querySelectorAll('.card input[type=radio]')].map((k) => ({ for: k.dataset.for ?? '', checked: k.checked }))); // G4: a switch showing both states, not one bare knob
chk('G4a the mode switch paints BOTH states (two radio knobs, exactly one checked)', knobs.length === 2 && knobs.filter((k) => k.checked).length === 1);
const pairOk = await page.evaluate(() => { const kids = [...document.querySelector('.card')?.children ?? []]; return ['chartVolume', 'chartMoney'].every((f) => { const i = kids.findIndex((k) => k.dataset.for === f); return i >= 0 && kids[i + 1]?.tagName === 'INPUT' && String(kids[i].textContent).trim() !== ''; }); });
chk('G4b each knob owns its own STR mode label right above it', pairOk === true);
const knobRects = await rects('.card input[type=radio]');
chk('G4 both switch knobs render as full tap targets (>=40px pill tracks)', knobRects.length === 2 && knobRects.every(([, , w, h]) => w >= 40 && h >= 40));
await click('[data-el=modeToggle]'); await beat(); // tapping the knob the switch already sits on must be a no-op
chk('G4 tapping the checked knob leaves mode where it is', (await page.evaluate(() => document.querySelector('.card input[type=radio][data-for=chartMoney]')?.checked)) === true);
await click('[data-for=chartVolume][type=radio]'); await beat(); // iOS switch: tapping the other end picks that mode
const volBack = await snap();
chk('G4 tapping the volume knob flips every chart back to volume bars', volBack.cards.some((c) => c.bars.length > 0) && volBack.cards.every((c) => c.bars.every((b) => !String(b.v ?? '').includes('\u20bd'))));

await tab('tabSettings'); // the add-new-meter card belongs to the Settings tab: markers are per-tab, so switch before reading it
const addCard = await page.evaluate((seedCopy) => { const c = document.querySelector('.cfgNew'); if (!c) return null; const kids = [...c.children]; const role = (r) => kids.findIndex((k) => k.getAttribute('data-role') === r); return { head: String(c.firstElementChild?.textContent ?? ''), hint: (c.textContent || '').includes(seedCopy), pairs: ['name', 'unit', 'price', 'seed'].every((r) => kids.some((k) => k.dataset.for === r) && role(r) >= 0 && kids[role(r) - 1]?.dataset?.for === r), labels: [...c.querySelectorAll('i.lbl')].length }; }, AP.seedRequired); // G8/G9 add-new-meter card layout
chk('G9 the add-new-meter card header names the card (STR.addMeterTitle)', addCard?.head === AP.addMeterTitle);
chk('G8 each add-field carries its label immediately above its own input', addCard?.pairs === true && (addCard?.labels ?? 0) >= 4);
chk('G9 the seed-required sentence stays visible as a field hint, not the header', addCard?.hint === true);

await tab('tabHistory'); const monthsBefore = (await snap()).rows.map((r) => r.m).sort(); // G7 task: clearing saved months, destructive ⇒ two taps
chk('G7 precondition: there are saved months to erase', monthsBefore.length >= 2);
await tab('tabSettings');
const nClr = await saves0(); await click('[data-el=clearBtn]'); await until('confirm copy painted', () => document.querySelector('b.banner') !== null); // first tap only arms the wipe; the confirm banner is its own completion signal (no persist round-trip)
chk('G7a first tap paints STR.confirmClear instead of erasing history', (await snap()).banner === AP.confirmClear && nClr === await saves0());
await tab('tabHistory');
chk('G7a arming the wipe left every saved month intact', (await snap()).rows.map((r) => r.m).sort().join() === monthsBefore.join());
await tab('tabSettings'); // visiting another tab disarms the pending wipe, so a real user has to tap twice again in Settings
const nClr2 = await saves0(); await click('[data-el=clearBtn]');
chk('G7a leaving Settings disarmed the wipe (one more single tap only re-arms, never erases)', (await snap()).banner === AP.confirmClear && nClr2 === await saves0());
await clickAndSave('[data-el=clearBtn]'); // second consecutive tap in the same tab commits + persists
await tab('tabHistory');
chk('G7b the second tap erased all saved months', (await snap()).rows.length === 0);
await page.reload({ waitUntil: 'networkidle' }); await until('app booted from OPFS', () => document.querySelector('[data-tab=tabBills]') !== null, null, 9000);
await tab('tabHistory');
chk('G7b the wipe survived a hard reload (OPFS rewritten, not just in-memory)', (await snap()).rows.length === 0);
await tab('tabSettings');
const cfgAfterClear = (await snap()).cfgRows.map((r) => r.id);
chk('G7 clearing history never touches the meter config', ['gas', 'electricity', 'water', 'trash'].every((id) => cfgAfterClear.includes(id)) && cfgAfterClear.length >= 5);

const titleTag = String(await read('document.title')); // ui.js tags the title on glue throws so iPhone users get a trail without new UI strings
console.log('[DIAG TITLE]', titleTag);
await ctx.close(); // guardrail: leave no debug browser/profile behind beyond the reusable e2e dir

const bad = R.filter(([, ok]) => !ok);
console.log(R.map(([l, ok]) => (ok ? 'PASS ' : 'FAIL ') + l).join('\n'));
console.log(bad.length ? '\n' + bad.length + '/' + R.length + ' acceptance checks FAILED (glue bugs to fix)' : '\nALL ' + R.length + ' acceptance checks GREEN in a real browser (Edge, phone viewport)');
console.log('[elapsed]', Math.round((Date.now() - T0) / 100) / 10 + 's of wall clock for the whole acceptance pass (condition-waits, no fixed beats)');
process.exit(bad.length ? 1 : 0);

