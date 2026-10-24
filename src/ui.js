// Integration-only DOM/picker/event glue — names per SPEC Testing strategy: bootLoad, savePersist, tabSwitch, applyMonthForm(->applyTabBills), refreshPreviews, applyHistory(+exportCsvFile), applyCharts(mode toggle button), settingsApply/addMeter. Math NEVER here: src/app.js descriptors own all calcs. shortcut: tabs re-render via innerHTML each action — bills state is one flat person's data, irrelevant cost.
import { DEFAULT_CONFIG, STR, fmtRub, fmtInt, upsertMonth, updateConfig, buildCsv, describeMonthForm, describeHistoryRows, describeCharts } from './app.js';
import { loadState, saveState } from './storage.js';

let state = { config: [...DEFAULT_CONFIG], history: [] };
let mode = 'volume', curTab = 'tabBills', bannerTxt = '', formObs = null, curMonth = null; // curMonth is the app-level selected month so Bills stays on it across tab switches
const monthOptions = () => { const n = new Date(); return [...Array(24)].map((_, i) => { const d = new Date(n.getFullYear(), n.getMonth() - i, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }); }; // (_, i): Array(24) holes arrive as undefined elements, only the index is useful

async function persist(s) { try { state = await saveState(s); toast(''); } catch (e) { console.warn('ResourcePay OPFS save failed:', e, e?.stack); document.title = 'STORAGE-SAVE:' + (e?.message ?? e); toast(STR.noStorage); state = s; } } // data still kept in memory so the day is not lost; trail visible via title on iPhone
const toast = (t) => { bannerTxt = t; const root = document.getElementById('app'); if (!root) return; const b = root.querySelector('b.banner'); if (!t) { if (b) b.remove(); return; } if (b) { b.textContent = t; return; } const n = el('b', 'banner'); n.textContent = t; root.insertBefore(n, root.firstChild); }; // banner-only tweak: a full repaint would drop the typed readings from the entry form and later re-saves would silently delete other meters' rows

window.tabSwitch = k => { curTab = k; renderAll(); };

function applyMonthForm() {
  const box = el('div', 'card'); box.dataset.el = 'formCard';
  const sel = monthSelect(); if (!curMonth) curMonth = document.querySelector('select[data-el=month]')?.value || monthOptions()[0]; sel.value = curMonth; // one selected month for the whole app, sticky across tabs
  box.append(el('i', '', STR.enterReading), sel);
  describeMonthForm(state, sel.value).fields.forEach(f => box.append(fieldRow(f)));
  box.append(el('b', 'total')); const tot = box.lastChild; tot.dataset.el = 'total';
  const save = document.createElement('button'); save.textContent = STR.saved; save.dataset.el = 'saveBtn';
  save.onclick = async () => { try { const [s, w] = upsertMonth(state, sel.value, collect(box, 'curr'), collect(box, 'price')); await persist(s); toast(w.length ? STR.negativeDiff : ''); } catch (e) { toast(STR.badNumber); } };
  box.append(save);
  refreshPreviews(box, sel);
  if (formObs) formObs.disconnect();
  formObs = new MutationObserver(() => refreshPreviews(box, sel)); formObs.observe(box, { attributes: true, childList: false, subtree: true }); // pv writes are text-only: no childList/characterData watching means the observer cannot loop on its own output
  box.querySelectorAll('[data-role=curr],[data-role=price]').forEach(i => i.addEventListener('input', () => refreshPreviews(box, sel))); // data-* markers only; ARIA role attr stays valid for real semantics
  return box;
}

const monthSelect = () => { const s = document.createElement('select'); s.dataset.el = 'month'; monthOptions().forEach(x => { const o = document.createElement('option'); o.value = x; s.append(o); }); return s; }; // shortcut: selected month resets on tab switch — full month nav across tabs is a later slice (acceptance covers current-month entry/save)

function fieldRow(f) {
  const row = el('div', 'field'); row.dataset.ref = f.ref;
  row.append(el('b', '', `${f.name} · ${f.unit}`), el('i', 'prev', f.prev == null ? STR.noSeedPrev : `${STR.prevLabel}: ${fmtInt(f.prev)}`));
  const pv = el('s', 'pv'); pv.dataset.role = 'pv';
  row.append(fld('curr', f.saved ?? undefined), fld('price', f.savedPrice ?? state.config.find((c) => c.id === f.ref)?.price ?? 0), pv); // prefill from the month's stored row/price so re-entering a month keeps untouched readings
  return row;
}

// previews recompute on any attribute change in the card (harness) or real typing ('input' event listener wired in applyMonthForm).
function refreshPreviews(box, sel) { curMonth = sel.value; const d = describeMonthForm(state, sel.value, collect(box, 'curr'), collect(box, 'price'));
  box.querySelectorAll('[data-ref]').forEach(r => {
    const g = d.fields.find(f => f.ref === r.dataset.ref), pv = inp(r, 'pv'); if (!g || !pv) return;
    pv.textContent = g.curr == null ? '' : (g.fixed ? '' : `${fmtInt(g.diff ?? 0)} ${g.unit} · `) + fmtRub(g.money ?? 0) + (g.warn ? ` ⚠ ${STR.negativeDiff}` : '');
  });
  const t = box.querySelector('[data-el=total]'); if (t) t.textContent = d.totalMoneyLabel + ': ' + fmtRub(d.totalMoney);
}

// no rounding here: app.js upsertMonth rejects non-integers for meters (STR.badNumber banner) and allows decimal garbage amounts.
const collect = (box, role) => { const out = {}; box.querySelectorAll('[data-ref]').forEach(r => { const c = inp(r, role); if (c && c.value !== '' && Number.isFinite(+c.value)) out[r.dataset.ref] = +c.value; }); return out; };

function applyHistory() {
  const box = el('div', 'card'); const btn = document.createElement('button'); btn.textContent = STR.exportCsv; btn.dataset.el = 'exportBtn'; btn.onclick = async () => { try { await exportCsvFile(); } catch (e) { if (e.name !== 'AbortError') toast(String(e)); } };
  box.append(btn); describeHistoryRows(state).forEach(r => { const d = el('div', 'row', `${r.month} — ${r.fmt}`); d.dataset.month = r.month; box.append(d); }); return box;
}
async function exportCsvFile() {
  const text = buildCsv(state), name = `resourcepay-backup-${new Date().toISOString().slice(0, 10)}.csv`;
  if (window.showSaveFilePicker) { const h = await window.showSaveFilePicker({ suggestedName: name }); const w = await h.createWritable(); await w.write(text); await w.close(); return; }
  const a = document.createElement('a'); a.download = name; a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' })); a.click(); URL.revokeObjectURL(a.href);
}

function applyCharts() {
  const box = el('div', 'card'); const tgl = document.createElement('button'); tgl.textContent = mode === 'volume' ? STR.chartMoney : STR.chartVolume; tgl.dataset.el = 'modeToggle'; tgl.dataset.mode = mode;
  tgl.onclick = () => { mode = mode === 'volume' ? 'money' : 'volume'; renderAll(); }; box.append(tgl);
  describeCharts(state, mode).forEach((g, i) => { const card = el('div', 'chart'); card.dataset.res = g.id; card.style.setProperty('--h', String(i * 47)); card.append(el('h4', '', g.name + (mode === 'volume' && !g.fixed ? ` · ${g.unit}` : '')));
    if (!g.empty) g.bars.forEach(b => { const bar = document.createElement('i'); bar.dataset.month = b.month; const label = mode === 'money' ? fmtRub(b.v) : fmtInt(b.v); bar.dataset.v = label; bar.style.height = Math.max(2, g.pctOf ? Math.round(Math.abs(b.v) / g.pctOf * 100) : 2) + '%'; if (b.v < 0) bar.classList.add('neg'); bar.append(el('span', '', `${label} ${b.month}`)); card.append(bar); });
    box.append(card); }); return box;
}

function applySettings() {
  const box = el('div', 'card');
  state.config.forEach(c => { const row = el('div', 'cfgRow'); row.dataset.id = c.id; row.dataset.active = c.active !== false ? '1' : '0';
    row.append(el('b', '', `${c.name} · ${c.unit} @ ${fmtRub(c.price)}`), el('i', '', `seed: ${c.seed == null ? STR.noSeedPrev : fmtInt(c.seed)}${c.fixed ? ' · fixed' : ''}`));
    const nm = document.createElement('input'); nm.type = 'text'; nm.dataset.role = 'name'; nm.setAttribute('value', c.name);
    const pr = fld('price', c.price); const sw = document.createElement('input'); sw.type = 'checkbox'; sw.dataset.role = 'active'; sw.checked = c.active !== false;
    row.append(nm, pr, sw); if (!c.fixed) row.append(fld('seed', c.seed)); box.append(row); });
  const add = el('div', 'cfgNew'); const nm2 = document.createElement('input'); nm2.type = 'text'; nm2.dataset.role = 'name'; const un2 = document.createElement('input'); un2.type = 'text'; un2.dataset.role = 'unit'; un2.setAttribute('value', 'm³'); const pr2 = fld('price', 0); const sd2 = fld('seed');
  add.append(el('i', '', `${STR.seedRequired} (name · unit ₽/unit · latest reading)`), nm2, un2, pr2, sd2);
  // new meter needs the odometer baseline; without it month-1 diffs would be wrong, so seed is mandatory (updateConfig throws otherwise too).
  const ab = document.createElement('button'); ab.textContent = '+'; ab.dataset.el = 'addBtn'; ab.onclick = () => { if (!nm2.value.trim() || sd2.value === '' || !Number.isFinite(+sd2.value)) return toast(STR.seedRequired); try { state = updateConfig(state, { id: 'm' + Date.now().toString(36), name: nm2.value.trim(), unit: un2.value || 'm³', price: +(pr2.value || 0), active: true, seed: Math.round(+sd2.value) }); persist(state); renderAll(); } catch (_) { toast(STR.seedRequired); } }; // adding a meter is structural => repaint so the new row shows
  add.append(ab); box.append(add);
  const apply = document.createElement('button'); apply.textContent = STR.saved; apply.dataset.el = 'applyBtn'; apply.onclick = () => settingsApply();
  box.append(apply); return box;
}
function settingsApply() { // reads the live Settings card (rows are in the page once the user clicks Apply) and patches config; seed-less new meters rejected inside updateConfig
  let changed = false; document.querySelectorAll('[data-id]').forEach(row => { const g = r => inp(row, r); try { state = updateConfig(state, { id: row.dataset.id, name: g('name')?.value || undefined, price: g('price')?.value !== '' && Number.isFinite(+g('price').value) ? +g('price').value : undefined, active: g('active')?.checked, seed: g('seed') && g('seed').value !== '' && Number.isFinite(+g('seed').value) ? Math.round(+g('seed').value) : undefined }); changed = true; } catch (_) {} });
  if (changed) persist(state); renderAll();
}

function tabHtml() { return ({ bills: applyMonthForm, history: applyHistory, charts: applyCharts, settings: applySettings })[curTab.slice(3).toLowerCase()](); }
const tabBar = () => { const w = el('nav', 'tabs'); ['tabBills', 'tabHistory', 'tabCharts', 'tabSettings'].forEach(k => { const b = document.createElement('button'); b.textContent = STR[k]; if (k === curTab) b.classList.add('on'); b.onclick = () => window.tabSwitch(k); b.dataset.tab = k; w.append(b); }); return w; };
const el = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };
const inp = (node, role) => node.querySelector(`[data-role=${role}]`); // markers are data-role attrs (dataset.role), not ARIA role: keeps a11y attributes meaningful and selectors stable
// value stored as a real attribute: phone typing and harness setAttribute() both mutate an attribute the MutationObserver sees; integer gate stays in upsertMonth.
const fld = (role, def) => { const i = document.createElement('input'); i.type = 'number'; if (role !== 'price') i.step = '1'; i.dataset.role = role; if (def != null) i.setAttribute('value', String(def)); return i; };

function renderAll() { try { const root = document.getElementById('app'); root.innerHTML = ''; if (bannerTxt) { const b = el('b', 'banner'); b.textContent = bannerTxt; root.append(b); } root.append(tabBar(), tabHtml()); } catch (e) { console.error('ResourcePay render failed:', e, e?.stack); document.title = 'RE:' + (e?.message ?? e); } } // static PWA has no console on iPhone: title keeps the trail inspectable without new UI strings
(async () => { await bootLoad(); })().catch((e) => console.error('ResourcePay boot failed:', e, e?.stack)); // silent unhandled rejections would hide iPhone bugs; keep the trail
async function bootLoad() { try { const s = await loadState(); if (s?.config) state = s; toast(''); } catch (e) { console.warn('ResourcePay OPFS load failed:', e, e?.stack); document.title = 'STORAGE:' + (e?.message ?? e); toast(STR.noStorage); } renderAll(); }
