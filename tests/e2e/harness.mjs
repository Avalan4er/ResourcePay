// Acceptance harness: one persistent browser context per pass + marker-only probes (SPEC Testing strategy).
// Checks live in the feature modules; this file owns launch/teardown, waits and geometry so features read as BDD claims only.
import { chromium } from 'playwright-core';

const EXE = process.env.E2E_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'; // Chromium-family browser already on this machine; localhost http is a secure context => OPFS allowed like iPhone Safari
export const URL_ = process.argv[2] || 'http://127.0.0.1:8123/src/index.html';
export const PROFILE = process.env.E2E_PROFILE || 'C:\\Users\\avalan4er\\AppData\\Local\\Temp\\opencode\\e2e-opfs-profile'; // reusable profile => cross-launch persistence evidence (guardrails: local + disposable)

export const RESULTS = []; export const chk = (l, c) => { RESULTS.push([l, !!c]); }; // exported so feature modules push their own claim rows
const T0 = Date.now(); // wall clock for the evidence line at the end: with condition-waits instead of fixed beats a green run costs ~Edge launch + real work

// Month labels are calendar-derived from the same rule ui.js monthOptions() uses; reading them from the DOM would couple every module to Bills-tab order, so they stay here (single source) and the 24-window itself is asserted against the live <select> in month-entry
export let OPT = [], M1, M0, OLDEST;
export const SCEN = {}; // cross-module scenario facts (monthsBefore/activeIds): settings-only markers vanish when another tab renders, so capture once per pass

let ctx = null, pg = null; // one persistent context => OPFS survives the in-pass reloads (persistence-reload.feature)
const DIAGS = [];

export async function launch() { ctx = await chromium.launchPersistentContext(PROFILE, { executablePath: EXE, headless: true, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); pg = await ctx.newPage(); } // phone-first per SPEC
export function consoleTrail() { return CONSOLE.filter((t) => /failed|error/i.test(t)); } // app logs render/OPFS failures to console; collected for the trail chk
const CONSOLE = [];
export async function openPage(url) { pg.on('console', (m) => CONSOLE.push(String(m.text ?? '').slice(0, 200))); await pg.goto(url, { waitUntil: 'networkidle' }); } // [c] lines stream only when a run is RED

export const ev = async (fn, arg = null) => await pg.evaluate(fn, arg);
export const snap = () => pg.evaluate(() => ({
  banner: document.querySelector('b.banner')?.textContent ?? '',
  month: document.querySelector('select[data-el=month]')?.value ?? '',
  fields: [...document.querySelectorAll('div.field[data-ref]')].map((r) => ({ ref: r.dataset.ref, name: r.querySelector('b')?.textContent ?? '', prev: r.querySelector('i.prev')?.textContent ?? '', curr: r.querySelector('[data-role=curr]')?.getAttribute('value') ?? '', pv: r.querySelector('[data-role=pv]')?.textContent ?? '' })),
  total: document.querySelector('[data-el=total]')?.textContent ?? '',
  rows: [...document.querySelectorAll('div.row[data-month]')].map((r) => ({ m: r.dataset.month, t: r.textContent })),
  cards: [...document.querySelectorAll('div.chart[data-res]')].map((c) => ({ res: c.dataset.res, bars: [...c.querySelectorAll('i[data-month]')].map((b) => ({ mo: b.dataset.month, v: b.dataset.v, neg: b.classList.contains('neg'), h: parseInt(b.style.height ?? '0', 10) })) })),
  cfgRows: [...document.querySelectorAll('[data-id]')].map((r) => ({ id: r.dataset.id, active: r.dataset.active, head: r.querySelector('b')?.textContent ?? '', name: r.querySelector('[data-role=name]')?.getAttribute('value') ?? '', price: r.querySelector('[data-role=price]')?.getAttribute('value') ?? '', seed: r.querySelector('[data-role=seed]')?.getAttribute('value') ?? '' })),
}));

export const read = async (expr) => await pg.evaluate(expr); // legacy string-expression reader (kept for simple probes)
export const setVal = async (sel, v) => await pg.evaluate(([s, x]) => document.querySelector(s)?.setAttribute('value', String(x)), [sel, String(v)]);
export const setChk = async (sel, v) => await pg.evaluate(([s, b]) => { const i = document.querySelector(s); if (i) i.checked = b; }, [sel, v]);
export const beat = async () => await pg.evaluate(() => true); // one round-trip: DOM/microtask work the previous call triggered is already applied (previews recompute synchronously on attribute mutation)

// headless Edge never fires rAF reliably => settle probe by repeated round-trips (rect stops changing). See tasks/test-deps.md.
export const frames = async () => { let prev = -1; for (let i = 0; i < 4; i++) { const h = await pg.evaluate(() => document.body.getBoundingClientRect().height); if (h === prev) return true; prev = h; } return true; };
export const until = async (what, fn, arg = null, timeout = 4000) => { // polls a structural condition instead of sleeping a fixed beat; timeouts are printed as evidence, they never launder the chk that follows
  const t0 = Date.now();
  for (;;) { let v = false; try { v = await pg.evaluate(fn, arg); } catch (e) { console.log('[wait-error]', what, String(e.message ?? e).slice(0, 240)); return false; } if (v) return true; if (Date.now() - t0 > timeout) { console.log('[wait-timeout]', what); return false; } await pg.waitForTimeout(120); }
}; // a throwing probe is a BROKEN HARNESS or missing marker — the line says so and the following chk stays RED

export const saves0 = async () => await pg.evaluate(() => window.rpSaved ?? 0); // ui.js counts every saveState round-trip (rpSaved) so "persist done" is observable
export const afterSave = async (n) => await until('OPFS save round-trip done', (x) => (window.rpSaved ?? 0) > x, n, 8000);
export const clickAndSave = async (sel) => { const n = await saves0(); await click(sel); return await afterSave(n); }; // clicks a button whose handler persists, then waits for the save round-trip to finish (rpSaved counter), not a fixed sleep
export const persistDone = () => until('persist wrote a status banner', () => document.querySelector('b.banner') !== null); // ui.js toasts on every persist branch (savedOk / noStorage), so a banner == the save round-trip completed

export async function click(sel) { // marker-selected button: real click when actionability holds, JS dispatch otherwise (whole-tab re-render makes stale-node waits fail — see ui.js shortcut note)
  chk('target present: ' + sel, await pg.evaluate((s) => document.querySelector(s) !== null, sel));
  try { await pg.locator(sel).click({ timeout: 1200 }); } catch (_) { await pg.evaluate((s) => document.querySelector(s)?.click(), sel); }
  await beat(); // the click handler's own DOM work is synchronous; anything async is waited for by a condition below, not a fixed beat
}

export const TAB_MARK = { tabBills: '[data-el=formCard]', tabHistory: '[data-el=exportBtn]', tabCharts: 'div.chart[data-res]', tabSettings: '[data-el=applyBtn]' }; // each tab owns at least one marker, so its presence means the re-render finished
export async function tab(k) { await click('[data-tab=' + k + ']'); await until('tab ' + k + ' rendered', (s) => document.querySelector(s) !== null, TAB_MARK[k]); console.log('[tab]', k); } // polls the re-rendered tab's own markers: boot/render cost is paid only as fast as it happens

export const selectMonth = async (m) => await pg.evaluate((v) => { const s = document.querySelector('select[data-el=month]'); if (s) { s.value = v; s.dispatchEvent(new Event('change')); } }, m); // a real option choice fires 'change'; previews follow it, so the harness must mirror that event to measure what a user sees

export const monthOptions = () => { const n = new Date(); return [...Array(24)].map((_, i) => { const d = new Date(n.getFullYear(), n.getMonth() - i, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }); }; // same rule as ui.js monthOptions
export async function initMonths() { OPT = monthOptions(); M1 = OPT[0]; M0 = OPT[1]; OLDEST = OPT[OPT.length - 1]; }

export const fieldRefs = async () => await pg.evaluate(() => [...document.querySelectorAll('div.field[data-ref]')].map((r) => r.dataset.ref)); // entry-form refs are Bills-tab-only
export const visInputs = async (sel) => await pg.evaluate((s) => [...document.querySelectorAll(s)].filter((i) => !i.hidden).map((i) => i.dataset.role), sel); // price input hides while it equals its default (B8)

// layout evidence measures the VISUAL stack only: a display:none control (B8 hides price at default) has no rect and must not count as overlap/containment
export const rects = async (sel) => await pg.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => { const c = getComputedStyle(e); return c.display !== 'none' && c.visibility !== 'hidden'; }).map((e) => { const b = e.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; }), sel);
export const overlaps = (a, b) => a[0] < b[0] + b[2] - 1 && b[0] < a[0] + a[2] - 1 && a[1] < b[1] + b[3] - 1 && b[1] < a[1] + a[3] - 1;
export const inside = (outer, inner, tol) => inner[0] >= outer[0] - tol && inner[1] >= outer[1] - tol && inner[0] + inner[2] <= outer[0] + outer[2] + tol && inner[1] + inner[3] <= outer[1] + outer[3] + tol;
export const leftOff = (rowRect, ks) => Math.max(0, ...ks.map((k) => k[0] - rowRect[0])); // how far the rightmost control sits from its row's left edge — a stranded control (S4) spikes here

// vertical rhythm between y-sorted rects; callers state expected cardinality via all() below
export const gaps = (list) => { const b = [...list].sort((a, c) => a[1] - c[1]); return [...Array(Math.max(0, b.length - 1))].map((_, i) => b[i + 1][1] - (b[i][1] + b[i][3])); }; // gaps between y-stacked rects (rows are column layouts now: B2/B5/S4/C1)

// A filter().every() over an EMPTY list is true — the vacuous-pass bug class. all(list, min, pred) states cardinality so a missing card can never read green.
export const all = (list, min, pred) => list.length >= min && list.every(pred);

// Intl ru-RU money labels keep U+2212 minus + NNBSP thousands: parse back to a number for cross-page agreement checks (charts sums vs history totals)
export const parseMoney = (t) => parseFloat(String(t).replace('\u2212', '-').replace(/[^0-9.,-]/g, '').replace(',', '.'));

export async function shot(path) { await pg.screenshot({ path, fullPage: true }); } // visual evidence for the review pass (test-results/ is gitignored)

export async function rowKidsAll(sels) { // one round-trip per selector batch: rows + their visible controls + every visible descendant, no per-ref await loops
  return await pg.evaluate((list) => list.map((sel) => { const vis = (q) => [...document.querySelectorAll(q)].filter((e) => { const c = getComputedStyle(e); return c.display !== 'none' && c.visibility !== 'hidden'; }).map((e) => { const b = e.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; }); const r0 = document.querySelector(sel); const box = r0 ? (() => { const b = r0.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; })() : null; return { r: box, kids: vis(sel + ' input'), all: vis(sel + ' *') }; }), sels);
}; // a missing row yields r=null; geometry checks below use all(...) so a null row can never pass

// single-source thresholds — same numbers style.css owns (tasks/test-deps.md keeps them in sync)
export const TAP = 40; // iOS comfortable-tap floor in CSS px; style.css grows controls to --tap:44px, so this is the acceptance floor not the design target

// geometry bounds live ONCE here; each names the style.css rule it guards (loose floors/caps => layout drift goes RED, reworded copy doesn't)
export const GAP_MIN = 4; // vertical rhythm between stacked blocks (style.css .field/.cfgRow margin:.5rem 0 + card gap) — B2/B5/C1
export const CTRL_W_MAX = 120; // settings input width cap; style.css caps at min(100%,5.4rem)≈86px, this is the old "spans half the screen" bug bound — S2
export const LEFT_MAX = 48; // how far a control may sit from its row's left edge before it reads as stranded; checkbox is var(--tap)=44px — S4
export const ROW_W_MIN = 300; // meter row must span the phone width (390px viewport minus safe-area padding) — B4
export const TOAST_Z_MIN = 9; // style.css .banner z-index:9 sits over sticky .tabs z-index:6 — G1/G3

// escape STR copy when a check needs it as a pattern (copy can contain ()?+ literals)
export const re = (s) => new RegExp(s.replace(/[.*+?^{}()|\[\]\\]/g, '\\$&'));

export const diag = async (tag, v) => { DIAGS.push([tag, JSON.stringify(v).slice(0, 700)]); }; // temporary evidence while glue bugs are open — flushed only on a RED run
export async function report() { // summary is always printed: a crashed section records its own FAIL row first, so ledger evidence never disappears
  const bad = RESULTS.filter(([, ok]) => !ok);
  if (bad.length) DIAGS.forEach(([t, j]) => console.log('[DIAG]', t, j));
  console.log(RESULTS.map(([l, ok]) => (ok ? 'PASS ' : 'FAIL ') + l).join('\n'));
  if (bad.length) console.log('\n' + bad.length + '/' + RESULTS.length + ' acceptance checks FAILED (glue bugs to fix)'); else console.log('\nALL ' + RESULTS.length + ' acceptance checks GREEN in a real browser (Edge, phone viewport)');
  console.log('[elapsed]', Math.round((Date.now() - T0) / 100) / 10 + 's of wall clock for the whole acceptance pass (condition-waits, no fixed beats)');
  return bad.length;
}

export async function closeAll() { await ctx.close(); } // guardrail: leave no debug browser/profile behind beyond the reusable e2e dir

export async function reload() { await pg.reload({ waitUntil: 'networkidle' }); await until('app booted from OPFS', () => document.querySelector('[data-tab=tabBills]') !== null, null, 9000); } // renderAll runs only after bootLoad awaited ⇒ markers imply the load completed

export async function section(name, fn) { try { await fn(); } catch (e) { chk('section ' + name + ': completed without crashing', false); console.log('[section-error]', name, String(e.message ?? e).slice(0, 300), '|', (e?.stack ?? '').split('\n')[1]?.trim() ?? ''); } }; // a dead section names itself; remaining sections still run

// ui.js parks uncaught app failures in document.title (RE:/STORAGE-SAVE:/STORAGE:) + console.warn; rpSaved also counts FAILED save attempts,
// so round-trip waits alone can read GREEN on a broken persist — trail chks make that RED.
export async function errorTrailChk() { const t = String(await ev('document.title')); chk('no app-error title trail (RE:/STORAGE*) during the pass', !/^(RE:|STORAGE)/.test(t)); const c = consoleTrail(); if (c.length) console.log('[console-errors]', c.join(' | ').slice(0, 700)); chk('no ResourcePay console failure lines during the pass', c.length === 0); }
