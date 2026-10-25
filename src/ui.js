// Integration-only DOM/picker/event glue — names per SPEC Testing strategy: bootLoad, persist(saveState path), tabSwitch, applyMonthForm, refreshPreviews, applyHistory+exportCsvFile, applyCharts(mode toggle), settingsApply/addMeter. Math NEVER here: src/app.js descriptors own all calcs. shortcut: tabs re-render via innerHTML each action — bills state is one flat person's data, irrelevant cost.
import { DEFAULT_CONFIG, STR, fmtRub, fmtInt, upsertMonth, updateConfig, clearHistory, buildCsv, describeMonthForm, describeHistoryRows, describeCharts } from './app.js?v=2'; // ?v= must match index.html's tokens — bump together per AGENTS.md cache-bust rule
import { loadState, saveState } from './storage.js?v=2';

let state = { config: [...DEFAULT_CONFIG], history: [] };
let mode = 'volume', curTab = 'tabBills', bannerTxt = '', formObs = null, curMonth = null; // curMonth is the app-level selected month so Bills stays on it across tab switches
const monthOptions = () => { const n = new Date(); return [...Array(24)].map((_, i) => { const d = new Date(n.getFullYear(), n.getMonth() - i, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }); }; // (_, i): Array(24) holes arrive as undefined elements, only the index is useful

const ICON = { tabBills: 'receipt_long', tabHistory: 'history', tabCharts: 'insert_chart', tabSettings: 'settings', chartVolume: 'water_drop', chartMoney: 'payments' }; // Material Icons ligature names — every one verified against google/material-design-icons font/MaterialIcons-Regular.codepoints (2235 entries); glyphs vendored in src/material-icons.woff2 (SPEC bans CDN fonts). Decorative pictographs: all UI COPY still comes only from STR
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

function fieldRow(f) { // B7: each input carries its own STR label; B8: the price INPUT hides while it equals its default; P4: the readout states which figure is in use, so the LABEL stays painted
  const row = el('div', 'field'); row.dataset.ref = f.ref; row.dataset.unit = f.unit; // unit lands on the row so syncPrice can rewrite the readout after typing
  const def = f.savedPrice ?? state.config.find((c) => c.id === f.ref)?.price ?? 0;
  row.append(el('b', '', `${f.name} \u00b7 ${f.unit}`)); if (!f.fixed) row.append(el('i', 'prev', prevText(f)));
  const pv = el('p', 'pv'); pv.dataset.role = 'pv'; // P3: an HTML <s> element IS strikethrough, which painted a line through the calc copy
  const cur = fld('curr', f.saved ?? undefined);
  const l1 = el('i', 'lbl'); l1.dataset.for = 'curr'; l1.textContent = f.fixed ? STR.lblAmount : STR.lblReading;
  row.append(l1, cur);
  if (!f.fixed) { const pr = fld('price', def); pr.dataset.def = String(def); const l2 = el('i', 'lbl'); l2.dataset.for = 'price'; l2.textContent = priceCopy(f.unit, def); row.append(l2, pr); } // G6/P4: no multiplier control on garbage rows; meters state their per-unit price
  row.append(pv); syncPrice(row); return row;
}
// B8 honest rule: the bills price INPUT is prefilled with that month's effective ₽/unit, so it must STAY in the row (tappable once edited); P4 makes the figure visible via the painted label instead of by un-hiding a redundant control. hidden only while the user literally left it untouched AND its value equals the config default.
const priceCopy = (unit, v) => String(STR.lblPriceOf).replace('{x}', fmtRub(v)).replace('{unit}', unit); // P4 template lives in STR so the readout translates with the rest of the copy
const syncPrice = (row) => { const i = inp(row, 'price'), l = row.querySelector('[data-for=price]'); if (!i || !l) return; const dflt = Number(i.dataset.def ?? 0); const edited = i.value !== '' && Number.isFinite(+i.value) && +i.value !== dflt; i.hidden = !edited; l.textContent = priceCopy(row.dataset.unit ?? '', edited ? +i.value : dflt); }; // B8: only the INPUT hides (a second hidden control is dead weight); P4: the label names the figure actually in use, so it stays painted at default

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
  box.append(btn); describeHistoryRows(state).forEach((r) => { const d = el('div', 'row'); d.dataset.month = r.month; d.dataset.total = String(r.total); // P7: one section per month; data-total keeps the money-agreement claim machine-readable (prose parsing broke with the table shape)
    d.append(el('b', '', r.month));
    const t = document.createElement('table'); t.className = 'mtbl'; // P7: a real table so a screen reader / iPhone reads columns, not one long sentence
    const cols = [['meter', STR.colMeter], ['reading', STR.colReading], ['delta', STR.colDelta], ['price', STR.colPrice], ['money', STR.colMoney]]; // headings are STR-only so a translated app keeps its own column words; P7-re-pin: the month's money spent per meter got its own cell (was only implied by the ₽/unit × Δ)
    const thead = document.createElement('thead'), hr = document.createElement('tr');
    cols.forEach(([col, copy]) => { const th = document.createElement('th'); th.dataset.col = col; th.textContent = String(copy); hr.appendChild(th); });
    thead.appendChild(hr);
    const tbody = document.createElement('tbody');
    r.parts.forEach((p) => { const tr = document.createElement('tr'); const cell = (col, txt) => { const td = document.createElement('td'); td.dataset.col = col; td.textContent = txt; return td; }; tr.append(cell('meter', p.name), cell('reading', fmtInt(p.curr)), cell('delta', p.fixed ? '\u2014' : `${STR.deltaMark}${fmtInt(p.delta ?? 0)} ${p.unit}`), cell('price', p.fixed ? fmtRub(p.money) : fmtRub(p.price)), cell('money', fmtRub(p.money))); tbody.appendChild(tr); }); // garbage row: its amount is the reading, no Δ; money now gets its own spent column (P7-re-pin)
    t.append(thead, tbody); d.append(t, el('i', 'mtotal', `${STR.monthTotal}: ${r.fmt}`)); box.append(d); }); return box; // H2/P7: per-meter table (name | reading | Δ | ₽/unit) plus the month's own total line
}
async function exportCsvFile() {
  const text = buildCsv(state), name = `resourcepay-backup-${new Date().toISOString().slice(0, 10)}.csv`;
  if (window.showSaveFilePicker) { const h = await window.showSaveFilePicker({ suggestedName: name }); const w = await h.createWritable(); await w.write(text); await w.close(); return; }
  const a = document.createElement('a'); a.download = name; a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' })); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); // revoke is delayed because a same-tick revoke cancels the download; iOS Safari ignores the download attribute (manual-verify note in tasks/test-deps.md)
}

function applyCharts() {
  const box = el('div', 'card'); // C2/G4/Z2 host card carries the mode switch row and every chart card
  const swRow = el('div', 'swRow'); // Z2: .card paints its children as a column, so the two tracks need their own ROW — stacked label/knob pairs were the reported bug
  const knob = (label, mark, isMoney) => { const t = el('span', 'modeSw'); t.dataset.mode = mark; const l = el('i', 'lbl'); l.dataset.for = mark; l.textContent = label; const k = document.createElement('input'); k.type = 'radio'; k.dataset.for = mark; k.checked = (mode === 'money') === isMoney; if (k.checked) t.dataset.on = '1'; if (isMoney) k.dataset.el = 'modeToggle'; k.onclick = () => { const want = isMoney ? 'money' : 'volume'; if (mode === want) return; mode = want; renderAll(); }; t.append(el('i', 'ic', ICON[mark]), l, k); swRow.append(t); return k; }; // MD3 segmented-control role: ui.js marks the selected cell with data-on because CSS has no parent selector — style.css fills it secondary-container; the old painted dot (i.knob) is replaced by the selected-cell fill (segmented re-pin), radios stay per-option tap layers
  knob(STR.chartVolume, 'chartVolume', false); knob(STR.chartMoney, 'chartMoney', true); box.append(swRow);
  describeCharts(state, mode).forEach((g, i) => { const card = el('div', 'chart'); card.dataset.res = g.id; card.style.setProperty('--h', String(200 + i * 13)); // one balanced blue scheme: bar hues stay inside the ~200–260° arc, meters told apart by card header (rule 4, no rainbow)
    card.append(el('h4', '', g.name + (mode === 'volume' && !g.fixed ? ` \u00b7 ${g.unit}` : ''))); // P1: header is the first line of a column-flowed card, bars live in their own row under it
    const bars = el('div', 'bars');
    if (!g.empty) g.bars.forEach(b => { const bar = document.createElement('i'); bar.dataset.month = b.month; const label = mode === 'money' ? fmtRub(b.v) : fmtInt(b.v); bar.dataset.v = label; bar.style.height = Math.max(2, g.pctOf ? Math.round(Math.abs(b.v) / g.pctOf * 100) : 2) + '%'; if (b.v < 0) bar.classList.add('neg'); bar.append(el('b', 'm', b.month.slice(2))); bars.append(bar); }); // P2: the pill paints no text; a short axis caption sits under the baseline, values get their own legend line
    card.append(bars);
    if (!g.empty) card.append(el('small', 'legend', g.bars.map((b) => `${b.month} ${mode === 'money' ? fmtRub(b.v) : fmtInt(b.v)}`).join(' \u00b7 '))); // P2 legend: month → value pairs, horizontal and readable
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
const tabBar = () => { const w = el('nav', 'tabs'); ['tabBills', 'tabHistory', 'tabCharts', 'tabSettings'].forEach(k => { const b = document.createElement('button'); b.textContent = STR[k]; b.appendChild(el('i', 'ic', ICON[k])); if (k === curTab) b.classList.add('on'); b.onclick = () => window.tabSwitch(k); b.dataset.tab = k; w.append(b); }); return w; }; // MD3 tabs cell: icon glyph over the STR label (style.css gives i.ic order:-1 in the column) — label text node stays the button's own copy
const el = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };
const inp = (node, role) => node.querySelector(`[data-role=${role}]`); // markers are data-role attrs (dataset.role), not ARIA role: keeps a11y attributes meaningful and selectors stable
// value stored as a real attribute: phone typing and harness setAttribute() both mutate an attribute the MutationObserver sees; integer gate stays in upsertMonth.
const fld = (role, def) => { const i = document.createElement('input'); i.type = 'number'; if (role !== 'price') i.step = '1'; i.dataset.role = role; if (def != null) i.setAttribute('value', String(def)); return i; };

function renderAll() { try { const root = document.getElementById('app'); root.innerHTML = ''; if (bannerTxt) { const b = el('b', 'banner'); b.textContent = bannerTxt; root.append(b); } root.append(tabBar(), tabHtml()); } catch (e) { console.error('ResourcePay render failed:', e, e?.stack); document.title = 'RE:' + (e?.message ?? e); } } // static PWA has no console on iPhone: title keeps the trail inspectable without new UI strings
(async () => { await bootLoad(); })().catch((e) => console.error('ResourcePay boot failed:', e, e?.stack)); // silent unhandled rejections would hide iPhone bugs; keep the trail
async function bootLoad() { try { const s = await loadState(); if (s?.config) state = s; toast(''); } catch (e) { console.warn('ResourcePay OPFS load failed:', e, e?.stack); document.title = 'STORAGE:' + (e?.message ?? e); toast(STR.noStorage); } renderAll(); }
