// Integration-only DOM/picker/event glue — names per SPEC Testing strategy: bootLoad, persist(saveState path), tabSwitch, applyMonthForm, refreshPreviews, applyHistory+exportCsvFile, applyCharts(mode toggle), settingsApply/addMeter. Math NEVER here: src/app.js descriptors own all calcs. shortcut: tabs re-render via innerHTML each action — bills state is one flat person's data, irrelevant cost.
import { DEFAULT_CONFIG, STR, fmtRub, fmtInt, upsertMonth, updateConfig, clearHistory, buildCsv, describeMonthForm, describeHistoryRows, describeCharts } from './app.js';
import { loadState, saveState } from './storage.js';

let state = { config: [...DEFAULT_CONFIG], history: [] };
let mode = 'volume', curTab = 'tabBills', bannerTxt = '', formObs = null, curMonth = null; // curMonth is the app-level selected month so Bills stays on it across tab switches
const monthOptions = () => { const n = new Date(); return [...Array(24)].map((_, i) => { const d = new Date(n.getFullYear(), n.getMonth() - i, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }); }; // (_, i): Array(24) holes arrive as undefined elements, only the index is useful

let toastHold = null; // B9/S6: a success copy that never clears reads like a permanent status line — hold it ~3.5s only; error banners stay painted because they need action
const toast = (t, hold = false) => { bannerTxt = t; const root = document.getElementById('app'); if (!root) return; const b = root.querySelector('b.banner'); if (toastHold) { clearTimeout(toastHold); toastHold = null; } if (!t) { if (b) b.remove(); return; } if (b) { b.textContent = t; b.dataset.kind = hold ? 'ok' : 'err'; } else { const n = el('b', 'banner'); n.textContent = t; n.dataset.kind = hold ? 'ok' : 'err'; root.insertBefore(n, root.firstChild); } if (hold) toastHold = setTimeout(() => { toastHold = null; toast(''); }, 3500); }; // G1: data-kind is the only difference between a success copy and an error copy — style.css paints ok green, err warn; banner-only tweak: a full repaint would drop the typed readings from the entry form and later re-saves would silently delete other meters' rows

async function persist(s) { try { state = await saveState(s); window.rpSaved = (window.rpSaved ?? 0) + 1; toast(STR.savedOk, true); } catch (e) { console.warn('ResourcePay OPFS save failed:', e, e?.stack); document.title = 'STORAGE-SAVE:' + (e?.message ?? e); window.rpSaved = (window.rpSaved ?? 0) + 1; toast(STR.noStorage); state = s; } } // rpSaved counter is a harness-only probe point: acceptance waits for the save round-trip instead of sleeping a fixed beat

let pendingClear = false; // G7 arming flag for the destructive clear-history action — browsing away from Settings disarms it so a wipe always needs two consecutive taps in that tab
window.tabSwitch = k => { curTab = k; pendingClear = false; renderAll(); };

function applyMonthForm() {
  const box = el('div', 'card'); box.dataset.el = 'formCard';
  const sel = monthSelect(); if (!curMonth) curMonth = document.querySelector('select[data-el=month]')?.value || monthOptions()[0]; sel.value = curMonth; // one selected month for the whole app, sticky across tabs
  box.append(el('i', '', STR.enterReading), sel);
  describeMonthForm(state, sel.value).fields.forEach(f => box.append(fieldRow(f)));
  box.append(el('b', 'total')); const tot = box.lastChild; tot.dataset.el = 'total';
  const save = document.createElement('button'); save.textContent = STR.saveMonth; save.dataset.el = 'saveBtn'; // B1: the month above is chosen by the <select>; the button only commits it
  save.onclick = async () => { const vals = collect(box, 'curr'), prices = collect(box, 'price'); if (!Object.keys(vals).length) return toast(STR.nothingEntered); try { const [s, w] = upsertMonth(state, sel.value, vals, prices); await persist(s); if (w.length) toast(STR.negativeDiff); } catch (e) { toast(STR.badNumber); } }; // B6: an all-empty form must not invent a blank month; persist() already painted the transient saved copy
  box.append(save);
  refreshPreviews(box, sel);
  if (formObs) formObs.disconnect(); // only 'value' attribute mutations recompute; watching every attribute made syncPrice's own hidden toggles re-fire the observer forever (dead renderer in Edge)
  formObs = new MutationObserver(() => refreshPreviews(box, sel)); formObs.observe(box, { attributes: true, childList: false, subtree: true, attributeFilter: ['value'] });
  box.querySelectorAll('[data-role=curr],[data-role=price]').forEach(i => i.addEventListener('input', () => refreshPreviews(box, sel))); // data-* markers only; ARIA role attr stays valid for real semantics
  sel.addEventListener('change', () => refreshPreviews(box, sel)); // month switch: a real option choice fires 'change' (harness dispatches it too)
  return box;
}

const monthSelect = () => { const s = document.createElement('select'); s.dataset.el = 'month'; monthOptions().forEach(x => { const o = document.createElement('option'); o.value = x; o.textContent = x; s.append(o); }); return s; }; // B1: options need visible text or the chooser renders as an empty box (B4/B2 CSS aside)

function fieldRow(f) { // B7: each input carries its own STR label; B8: the price input is hidden while it equals its default so a row reads as one reading field; G5/G6: a fixed-cost row has neither a baseline line nor a ₽/unit multiplier — the number typed IS rubles
  const row = el('div', 'field'); row.dataset.ref = f.ref;
  const def = f.savedPrice ?? state.config.find((c) => c.id === f.ref)?.price ?? 0;
  row.append(el('b', '', `${f.name} · ${f.unit}`)); if (!f.fixed) row.append(el('i', 'prev', prevText(f)));
  const pv = el('s', 'pv'); pv.dataset.role = 'pv';
  const cur = fld('curr', f.saved ?? undefined);
  const l1 = el('i', 'lbl'); l1.dataset.for = 'curr'; l1.textContent = f.fixed ? STR.lblAmount : STR.lblReading;
  row.append(l1, cur);
  if (!f.fixed) { const pr = fld('price', def); pr.dataset.def = String(def); const l2 = el('i', 'lbl'); l2.dataset.for = 'price'; l2.textContent = STR.lblPrice; row.append(l2, pr); } // G6: no multiplier control at all on garbage rows
  row.append(pv); syncPrice(row); return row;
}
// B8 honest rule: the bills price input is prefilled with that month's effective ₽/unit, so it must STAY in the row (tappable, SPEC user story 1 "editable afterwards"); hiding a tappable control is a UX regression — clutter is removed by styling instead. hidden only while the user literally left it untouched AND its value equals the config default.
const syncPrice = (row) => { const i = inp(row, 'price'), l = row.querySelector('[data-for=price]'); if (!i || !l) return; const dflt = Number(i.dataset.def ?? 0); const edited = i.value !== '' && Number.isFinite(+i.value) && +i.value !== dflt; i.hidden = !edited; l.hidden = !edited; }; // B8 evidence: hidden attr keeps the field out of the row's visual stack (CSS [hidden] rule)

// previews recompute on any attribute change in the card (harness) or real typing ('input' event listener wired in applyMonthForm).
const prevText = (f) => f.prev == null ? STR.noSeedPrev : `${STR.prevLabel}: ${fmtInt(f.prev)}`; // one copy rule shared by build + refresh (S8/B1: switching months repaints it in place)
function refreshPreviews(box, sel) { curMonth = sel.value; const d = describeMonthForm(state, sel.value, collect(box, 'curr'), collect(box, 'price'));
  box.querySelectorAll('[data-ref]').forEach(r => { syncPrice(r); const g = d.fields.find(f => f.ref === r.dataset.ref), pv = inp(r, 'pv'); if (!g || !pv) return; pv.hidden = !!g.fixed; if (g.fixed) return; // fixed-cost rows (garbage) carry no baseline/Δ — their amount belongs to the month total line only (S5/B-adjacent honesty)
    const pw = r.querySelector('i.prev'); if (pw) pw.textContent = prevText(g); // S8/B1: switching months repaints the odometer baseline in place, not only the preview line
    pv.textContent = g.curr == null ? '' : (g.hint ? `${STR.deltaMark}${g.unit} \u00b7 ${g.hint}` : (g.fixed ? '' : `${fmtInt(g.diff ?? 0)} ${g.unit} \u00b7 `) + fmtRub(g.money ?? 0)) + (g.warn ? ` \u26a0 ${STR.negativeDiff}` : ''); // B3/B10: hint copy replaces the numbers when the baseline or price is unknown
  });
  const t = box.querySelector('[data-el=total]'); if (t) t.textContent = d.totalMoneyLabel + ': ' + fmtRub(d.totalMoney);
}

// no rounding here: app.js upsertMonth rejects non-integers for meters (STR.badNumber banner) and allows decimal garbage amounts.
const collect = (box, role) => { const out = {}; box.querySelectorAll('[data-ref]').forEach(r => { const c = inp(r, role); if (c && c.value !== '' && Number.isFinite(+c.value)) out[r.dataset.ref] = +c.value; }); return out; };

function applyHistory() {
  const box = el('div', 'card'); const btn = document.createElement('button'); btn.textContent = STR.exportCsv; btn.dataset.el = 'exportBtn'; btn.onclick = async () => { try { await exportCsvFile(); } catch (e) { if (e.name !== 'AbortError') toast(String(e)); } };
  box.append(btn); describeHistoryRows(state).forEach((r) => { const detail = r.parts.map((p) => `${p.name}${p.fixed ? '' : ` ${STR.deltaMark}${fmtInt(p.delta ?? 0)} ${p.unit}`} \u00b7 ${fmtRub(p.money)}`).join(' \u00b7 '); const d = el('div', 'row', `${r.month} \u2014 ${detail} \u2014 ${STR.monthTotal}: ${r.fmt}`); d.dataset.month = r.month; box.append(d); }); return box; // H2: per-meter breakdown, then the month total from that row's stored prices
}
async function exportCsvFile() {
  const text = buildCsv(state), name = `resourcepay-backup-${new Date().toISOString().slice(0, 10)}.csv`;
  if (window.showSaveFilePicker) { const h = await window.showSaveFilePicker({ suggestedName: name }); const w = await h.createWritable(); await w.write(text); await w.close(); return; }
  const a = document.createElement('a'); a.download = name; a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' })); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); // revoke is delayed because a same-tick revoke cancels the download; iOS Safari ignores the download attribute (manual-verify note in tasks/test-deps.md)
}

function applyCharts() {
  const box = el('div', 'card'); // C2/G4/Z2 host card carries the mode switch row and every chart card
  const swRow = el('div', 'swRow'); // Z2: .card paints its children as a column, so the two tracks need their own ROW — stacked label/knob pairs were the reported bug
  const knob = (label, mark, isMoney) => { const t = el('span', 'modeSw'); t.dataset.mode = mark; const l = el('i', 'lbl'); l.dataset.for = mark; l.textContent = label; const k = document.createElement('input'); k.type = 'radio'; k.dataset.for = mark; k.checked = (mode === 'money') === isMoney; if (isMoney) k.dataset.el = 'modeToggle'; k.onclick = () => { const want = isMoney ? 'money' : 'volume'; if (mode === want) return; mode = want; renderAll(); }; t.append(l, k, el('i', 'knob')); swRow.append(t); return k; }; // G4: one track per mode = its own STR label + an invisible radio covering the whole pill (style.css draws the dot, so no native control paints) ⇒ a switch where BOTH states and which is lit are visible
  knob(STR.chartVolume, 'chartVolume', false); knob(STR.chartMoney, 'chartMoney', true); box.append(swRow);
  describeCharts(state, mode).forEach((g, i) => { const card = el('div', 'chart'); card.dataset.res = g.id; card.style.setProperty('--h', String(i * 47)); card.append(el('h4', '', g.name + (mode === 'volume' && !g.fixed ? ` · ${g.unit}` : '')));
    if (!g.empty) g.bars.forEach(b => { const bar = document.createElement('i'); bar.dataset.month = b.month; const label = mode === 'money' ? fmtRub(b.v) : fmtInt(b.v); bar.dataset.v = label; bar.style.height = Math.max(2, g.pctOf ? Math.round(Math.abs(b.v) / g.pctOf * 100) : 2) + '%'; if (b.v < 0) bar.classList.add('neg'); bar.append(el('span', '', `${label} ${b.month}`)); card.append(bar); });
    box.append(card); }); return box;
}

function applySettings() {
  const box = el('div', 'card');
  state.config.forEach((c) => { const row = el('div', 'cfgRow'); row.dataset.id = c.id; row.dataset.active = c.active !== false ? '1' : '0'; // S4: compact widths in style.css keep the toggle next to its inputs, no stranded third-of-page whitespace
    row.append(el('b', '', `${c.name} \u00b7 ${c.unit}${c.fixed ? '' : ` @ ${fmtRub(c.price)}`}`)); // S1: no "seed: no baseline yet" spam; G6: a fixed-cost row has no ₽/unit to show
    if (c.seed != null) row.append(el('i', 'tag', `${STR.lblSeedBase}: ${fmtInt(c.seed)}`)); if (c.fixed) row.append(el('i', 'tag', STR.lblFixed)); // the stored baseline is echoed only when it exists
    const l1 = el('i', 'lbl'); l1.dataset.for = 'name'; l1.textContent = STR.lblName; const nm = document.createElement('input'); nm.type = 'text'; nm.dataset.role = 'name'; nm.setAttribute('value', c.name);
    const l2 = el('i', 'lbl'); l2.dataset.for = 'price'; l2.textContent = STR.lblPrice; const pr = fld('price', c.price);
    const l3 = el('i', 'lbl'); l3.dataset.for = 'active'; l3.textContent = STR.lblActive; const sw = document.createElement('input'); sw.type = 'checkbox'; sw.dataset.role = 'active'; sw.checked = c.active !== false;
    row.append(l1, nm); if (!c.fixed) row.append(l2, pr); row.append(l3, sw); if (!c.fixed) { const l4 = el('i', 'lbl'); l4.dataset.for = 'seed'; l4.textContent = STR.lblSeedBase; row.append(l4, fld('seed', c.seed)); } box.append(row); }); // G6: a fixed-cost row offers no ₽/unit multiplier (its money is the absolute monthly amount), and no baseline seed input
  const add = el('div', 'cfgNew'); add.append(el('b', '', STR.addMeterTitle)); // G9: card names what it does; the seed-required sentence is a field hint below, not the header
  const nm2 = document.createElement('input'); nm2.type = 'text'; nm2.dataset.role = 'name';
  const un2 = document.createElement('input'); un2.type = 'text'; un2.dataset.role = 'unit'; un2.setAttribute('value', 'm³');
  const pr2 = fld('price', 0); const sd2 = fld('seed');
  [[nm2, 'name', STR.lblName], [un2, 'unit', STR.lblUnit], [pr2, 'price', STR.lblPrice], [sd2, 'seed', STR.lblSeedBase]].forEach(([i, role, label]) => { const lab = el('i', 'lbl'); lab.dataset.for = role; lab.textContent = label; add.append(lab, i); }); // G8: one label directly above its own input (same pairing as fieldRow), not four labels then four inputs
  add.append(el('i', 'tag', STR.seedRequired)); // new meter needs the odometer baseline; without it month-1 diffs would be wrong, so seed is mandatory (updateConfig rejects it otherwise too)
  const ab = document.createElement('button'); ab.textContent = '+'; ab.dataset.el = 'addBtn'; ab.onclick = () => { if (!nm2.value.trim() || sd2.value === '' || !Number.isFinite(+sd2.value)) return toast(STR.seedRequired); try { state = updateConfig(state, { id: 'm' + Date.now().toString(36), name: nm2.value.trim(), unit: un2.value || 'm³', price: +(pr2.value || 0), active: true, seed: Math.round(+sd2.value) }); persist(state); renderAll(); } catch (_) { toast(STR.seedRequired); } }; // adding a meter is structural => repaint so the new row shows
  add.append(ab); box.append(add);
  const clr = document.createElement('button'); clr.textContent = STR.clearHistory; clr.dataset.el = 'clearBtn'; clr.onclick = () => { if (!pendingClear) { pendingClear = true; return toast(STR.confirmClear); } pendingClear = false; state = clearHistory(state); persist(state); renderAll(); }; // G7 task: wiping every saved month is destructive, so it takes two taps (first arms + paints the confirm copy); tabSwitch disarms
  box.append(clr);
  const apply = document.createElement('button'); apply.textContent = STR.applyChanges; apply.dataset.el = 'applyBtn'; apply.onclick = () => settingsApply(); // S7: an action verb on the button, not a past-tense status line
  box.append(apply); return box;
}
// S8 (ledger): an existing meter's seed input already feeds updateConfig, so a typed baseline reaches Bills prev for months predating its readings — verified e2e; only NEW meters must carry a seed (updateConfig rejects seed-less additions).
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
