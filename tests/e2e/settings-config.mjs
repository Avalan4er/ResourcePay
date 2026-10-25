// Settings-tab acceptance claims for settings-config.feature (+ G7/G8/G9 ids that live on this card). Order of exports in run.mjs is the scenario order.
import { STR as AP } from '../../src/app.js'; // banner/button copy compared against the app's dictionary only
import * as H from './harness.mjs';

export async function freshPrecondition() { // === bug batch part A precondition: seeds/prices must be untouched so "no baseline" months are real
  await H.tab('tabSettings');
  const freshCfg = (await H.snap()).cfgRows; // the shared snapshot already carries id/head/price/seed
  H.chk('precondition: fresh profile (no seeds entered, meter prices still default) so the no-baseline cases apply', freshCfg.length >= 3 && freshCfg.every((r) => r.seed === '') && freshCfg.filter((r) => !/\/month/.test(r.head)).every((r) => +r.price === 0)); // A stale profile trips THIS chk rather than silently mis-reporting B3/B10 (delete E2E_PROFILE dir before the run)
}

export async function applyEdits() { // settings first (real-life order: configure meters, THEN fill bills): water gets a seed but its price stays default so B10's honest "baseline known, ₽/unit unset" preview is reachable in Bills below
  await H.tab('tabSettings');
  await H.setVal('[data-id=gas] input[type=text]', 'Gas A'); await H.setVal('[data-id=gas] [data-role=price]', 42); await H.setVal('[data-id=gas] [data-role=seed]', 1000);
  await H.setVal('[data-id=electricity] [data-role=price]', 3.5); await H.setVal('[data-id=electricity] [data-role=seed]', 5000);
  await H.setVal('[data-id=water] [data-role=seed]', 700);
  await H.clickAndSave('[data-el=applyBtn]');
  const s = await H.snap();
  H.chk('settings: renamed meter + edited prices/seeds persisted onto config rows', s.cfgRows.some((r) => r.id === 'gas' && r.name === 'Gas A' && r.price === '42' && r.seed === '1000') && s.cfgRows.every((r) => r.seed !== '' || r.id === 'trash'));
  H.chk('settings: Apply re-render shows the new name and price in the row header', s.cfgRows.some((r) => r.head.includes('Gas A') && r.head.includes('42,00')));
}

export async function addNewMeter() { // settings-config.feature bullet 3: seed-less new meter refused with STR.seedRequired copy and config untouched; with seed it grows by one
  const rowsBeforeAdd = (await H.snap()).cfgRows.length;
  await H.setVal('.cfgNew [data-role=name]', 'Boiler'); await H.setVal('.cfgNew [data-role=unit]', 'm\u00b3'); await H.setVal('.cfgNew [data-role=price]', 3);
  await H.click('[data-el=addBtn]'); await H.bannerPainted('seed-required banner painted');
  H.chk('settings: a brand-new meter without the latest-known reading is refused (seed required)', (await H.snap()).banner === AP.seedRequired);
  H.chk('settings: refusal left config untouched', (await H.snap()).cfgRows.length === rowsBeforeAdd);
  // the error toast re-rendered the Settings card, so a real user retypes the draft fields — do the same here
  await H.setVal('.cfgNew [data-role=name]', 'Boiler'); await H.setVal('.cfgNew [data-role=unit]', 'm\u00b3'); await H.setVal('.cfgNew [data-role=price]', 3); await H.setVal('.cfgNew [data-role=seed]', 900);
  await H.clickAndSave('[data-el=addBtn]');
  const s = await H.snap(); await H.diag('afterAdd', { rows: s.cfgRows.map((r) => r.id + '/' + r.name + '/' + r.seed), banner: s.banner });
  H.chk('settings: adding succeeds once the baseline is supplied (config grew by one)', s.cfgRows.length === rowsBeforeAdd + 1 && s.cfgRows.some((r) => r.name === 'Boiler' && r.seed === '900'));
  H.SCEN.activeIds = s.cfgRows.filter((r) => r.active === '1').map((r) => r.id); // settings-only markers vanish when another tab renders: capture the active set here (charts volume section reads it)
}

export async function previewsAfterAdd() {
  await H.tab('tabBills'); const s = await H.snap();
  H.chk('settings: the new meter previews from its seed baseline, not zero', s.fields.some((f) => /9\s*00/.test(f.prev) && f.ref !== 'water')); // Intl inserts a thousands separator in ru-RU, so match loosely
}

export async function disableKeepsRows() { // settings-config.feature bullet 2: unchecking disables without erasing; re-enabling restores the row and months survive
  await H.tab('tabSettings'); await H.setChk('[data-id=water] input[type=checkbox]', false); await H.clickAndSave('[data-el=applyBtn]');
  await H.tab('tabBills'); await H.snap();
  H.chk('settings: disabled meter is omitted from the entry form', !(await H.fieldRefs()).includes('water'));
  await H.tab('tabHistory');
  H.chk('settings: disabling did not erase its history months or cells (rows still two)', (await H.snap()).rows.filter((r) => r.m === H.M0 || r.m === H.M1).length === 2);
  await H.tab('tabSettings'); await H.setChk('[data-id=water] input[type=checkbox]', true); await H.clickAndSave('[data-el=applyBtn]'); // re-enabling must restore the field row without losing months
  await H.tab('tabBills');
  H.chk('settings: re-enabling restores the field row', (await H.fieldRefs()).includes('water'));
}

export async function sGroup() { // === bug batch part B — Settings-tab ids from tasks/bugs.md (S1–S8)
  await H.tab('tabSettings');
  const cfg = (await H.snap()).cfgRows; const cfgIds = cfg.map((r) => r.id); // one Settings-card snapshot feeds the ids/heads/labels claims below
  H.chk('S7 Settings action button reads as an action (STR.applyChanges), not a saved-status', String(await H.ev(() => document.querySelector('[data-el=applyBtn]')?.textContent ?? '')) === AP.applyChanges);
  H.chk('S1 config headers no longer spam "no baseline yet" placeholders', cfgIds.length >= 3 && cfg.map((r) => r.head).every((t) => !String(t).includes(AP.noSeedPrev)));
  const cfgLab = await H.labelStats('[data-id]'); // G6 changed which controls a row owns ⇒ assert the pairing structurally, not a fixed labels-per-row count
  H.chk('S3 every config field is labelled by its own STR label (rows need no label for controls they do not carry)', cfgLab?.unlabeled === 0 && (cfgLab?.labeled ?? 0) >= 15); // meters: name/price/active/seed; garbage row: name/active only
  await H.frames(); const cfgGeo = await H.rowKidsAll(cfgIds.map((id) => '[data-id=' + id + ']')); // S2/S4 evidence: per-row controls + their stacking (batched probes)
  H.chk('S2 settings inputs bounded width (<=8rem) and inside their row', H.all(cfgGeo, cfgIds.length, (g) => g.kids.length > 0 && g.kids.every((k) => H.inside(g.r, k, 4) && k[2] <= H.CTRL_W_MAX)));
  H.chk('S4 enable-toggle controls hug the row\'s left edge (<=3rem) instead of stranding across the page', H.all(cfgGeo, cfgIds.length, (g) => g.kids.length > 0 && H.leftOff(g.r, g.kids) <= H.LEFT_MAX && H.gaps(g.kids).every((x) => x >= 2))); // 2px intra-row rhythm stays inline: controls share a column, style.css row gap is .4rem≈6px
  const addLbl = await H.ev(() => [...document.querySelectorAll('.cfgNew i.lbl')].map((e) => e.textContent));
  H.chk('S5 add-new-meter block labels all four fields', H.all(addLbl, 4, (t) => String(t).trim() !== ''));
  await H.setVal('[data-id=water] [data-role=price]', 21); await H.clickAndSave('[data-el=applyBtn]'); // S7: the Apply button is an action, and clicking it writes through to config+OPFS
  H.chk('S7 Apply persisted the edit (config row shows the new price)', (await H.snap()).cfgRows.some((r) => r.id === 'water' && r.price === '21'));
  await H.toastCleared('success banner cleared itself after Apply'); // S6: same expiry rule as B9, polled by the harness helper
  H.chk('S6 success banner cleared within 4s of a good Apply (errors still persistent)', (await H.snap()).banner === '');
  await H.setVal('[data-id=water] [data-role=seed]', 643); await H.clickAndSave('[data-el=applyBtn]'); // S8 repro: a seed typed into an existing meter's row must reach the Bills baseline for months that predate every reading
  await H.tab('tabBills'); await H.selectMonth(H.OLDEST);
  const waterPrev = await H.ev(() => document.querySelector('[data-ref=water] i.prev')?.textContent ?? '');
  await H.diag('s8state', { month: await H.ev(() => document.querySelector('select[data-el=month]')?.value), waterPrev, cfg: (await H.snap()).cfgRows.map((r) => r.id + '/' + r.seed) }); // real prev-line evidence while S8 glue is open
  H.chk('S8 a seed entered in Settings really becomes the Bills baseline for a meter with no earlier rows', /6[\s\u202f\n]?43/.test(waterPrev));
}

export async function settingsCardG() { // G8/G9 add-new-meter card + G6c garbage row shape, read on the Settings tab (markers are per-tab)
  await H.tab('tabSettings');
  const addCard = await H.ev((seedCopy) => { const c = document.querySelector('.cfgNew'); if (!c) return null; const kids = [...c.children]; const role = (r) => kids.findIndex((k) => k.getAttribute('data-role') === r); return { head: String(c.firstElementChild?.textContent ?? ''), hint: (c.textContent || '').includes(seedCopy), pairs: ['name', 'unit', 'price', 'seed'].every((r) => kids.some((k) => k.dataset.for === r) && role(r) >= 0 && kids[role(r) - 1]?.dataset?.for === r), labels: [...c.querySelectorAll('i.lbl')].length }; }, AP.seedRequired); // G8/G9 add-new-meter card layout
  H.chk('G9 the add-new-meter card header names the card (STR.addMeterTitle)', addCard?.head === AP.addMeterTitle);
  H.chk('G8 each add-field carries its label immediately above its own input', addCard?.pairs === true && (addCard?.labels ?? 0) >= 4);
  H.chk('G9 the seed-required sentence stays visible as a field hint, not the header', addCard?.hint === true);
  const cfgShape = (await H.snap()).cfgRows; // G6c same Settings card; snap().cfgRows carries hasPrice presence
  H.chk('G6c the garbage Settings row carries no ₽/unit multiplier and its header states no price figure', (cfgShape.find((r) => /\/month/.test(r.head)) ?? { hasPrice: true, head: '' }).hasPrice === false && !String(cfgShape.find((r) => /\/month/.test(r.head))?.head ?? '@').includes('@'));
  const meterRows = cfgShape.filter((r) => /@/.test(r.head)); // header shows @ price exactly where a multiplier control exists — one rule, no counted literals
  H.chk('G6 meters still own their editable ₽/unit field in Settings', meterRows.length >= 3 && cfgShape.filter((r) => r.hasPrice).length === meterRows.length);
}

export async function wipeSavedMonths() { // G7 task: clearing saved months is destructive ⇒ two taps; SCEN.monthsBefore captured before arming
  await H.tab('tabHistory'); H.SCEN.monthsBefore = (await H.snap()).rows.map((r) => r.m).sort();
  H.chk('G7 precondition: there are saved months to erase', H.SCEN.monthsBefore.length >= 2);
  await H.tab('tabSettings');
  const nClr = await H.saves0(); await H.click('[data-el=clearBtn]'); await H.bannerPainted('confirm copy painted'); // first tap only arms the wipe; the confirm banner is its own completion signal (no persist round-trip)
  H.chk('G7a first tap paints STR.confirmClear instead of erasing history', (await H.snap()).banner === AP.confirmClear && nClr === await H.saves0());
  await H.tab('tabHistory');
  H.chk('G7a arming the wipe left every saved month intact', (await H.snap()).rows.map((r) => r.m).sort().join() === H.SCEN.monthsBefore.join());
  await H.tab('tabSettings'); // visiting another tab disarms the pending wipe, so a real user has to tap twice again in Settings
  const nClr2 = await H.saves0(); await H.click('[data-el=clearBtn]');
  H.chk('G7a leaving Settings disarmed the wipe (one more single tap only re-arms, never erases)', (await H.snap()).banner === AP.confirmClear && nClr2 === await H.saves0());
  await H.clickAndSave('[data-el=clearBtn]'); // second consecutive tap in the same tab commits + persists
  await H.tab('tabHistory');
  H.chk('G7b the second tap erased all saved months', (await H.snap()).rows.length === 0);
  await H.reload();
  await H.tab('tabHistory');
  H.chk('G7b the wipe survived a hard reload (OPFS rewritten, not just in-memory)', (await H.snap()).rows.length === 0);
  await H.tab('tabSettings');
  const cfgAfterClear = (await H.snap()).cfgRows.map((r) => r.id);
  H.chk('G7 clearing history never touches the meter config', ['gas', 'electricity', 'water', 'trash'].every((id) => cfgAfterClear.includes(id)) && cfgAfterClear.length >= 5);
}
