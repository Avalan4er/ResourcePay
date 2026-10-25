// BDD acceptance pass (SPEC Testing strategy) — real Chromium browser, marker-only driving, waits on structural conditions.
// Per-feature claim modules: harness = probes/waits/geometry; sections below run the SAME scenario order as before (state carries through one persistent OPFS profile per pass).
// Run: node tests/e2e/run.mjs [url] — fresh-state runs need the profile dir deleted first and no browser holding it (tasks/test-deps.md); freshPrecondition stays RED on a stale profile rather than mis-reporting B3/B10.
import * as H from './harness.mjs';
import * as PP from './persistence-reload.mjs'; // P is the bug-batch id namespace in check labels, so module aliases stay distinct
import * as M from './month-entry.mjs';
import * as S from './settings-config.mjs';
import * as C from './charts-toggle.mjs';
import * as X from './history-export.mjs';
import * as T from './tap-and-toast.mjs';
import * as Q from './ui-polish.mjs'; // bug batch 4 (tasks/bugs-4.md): chart/bill/history legibility on the phone

await H.launch(); await H.openPage(H.URL_); await H.initMonths(); // months are calendar-derived here (single source) and asserted against the live <select> in month-entry

// scenario order — dependencies run top-down; each section names itself so a crash still prints FAIL rows for everything collected
await H.section('persistence-reload: bootSurvival', PP.bootSurvival); // OPFS survival across browser launches is visible at boot
await H.section('settings-config: freshPrecondition', S.freshPrecondition); // CLEAN-profile precondition: seeds/prices untouched ⇒ no-baseline months are real
await H.section('month-entry: freshOldestForm', M.freshOldestForm); // B1..B8 layout + empty-save refusal on the oldest month (B6)
await H.section('month-entry: previewsFresh', M.previewsFresh); // B3 honest-preview rule; readings are typed and cleared again ⇒ nothing persists yet
await H.section('settings-config: applyEdits', S.applyEdits);
await H.section('settings-config: addNewMeter', S.addNewMeter); // refuses seed-less addition, accepts with a baseline
await H.section('month-entry: priceMissingRepro', M.priceMissingRepro); // B10 repro reachable only after Settings seeded water (still default ₽/unit)
await H.section('settings-config: previewsAfterAdd', S.previewsAfterAdd);
await H.section('month-entry: enterPreviousMonth', M.enterPreviousMonth); // entry + save, re-enter correction (B9), replace-not-duplicate
await H.section('month-entry: rejectFractional', M.rejectFractional); // STR.badNumber refusal with no history row created
await H.section('month-entry: negativeDelta', M.negativeDelta); // warns inline yet persists the raw month (charts flag it below)
await H.section('charts-toggle: volumeMode', C.volumeMode);
await H.section('charts-toggle: moneyMode', C.moneyMode); // records money sums into SCEN for the history agreement claim
await H.section('history-export: rowsBasicsMoneyAgree', X.rowsBasicsMoneyAgree);
await H.section('persistence-reload: reloadChecks', PP.reloadChecks);
await H.section('settings-config: disableKeepsRows', S.disableKeepsRows); // deleted/disabled ≠ erased (rows survive, form omits)
await H.section('history-export: exportBtnPresent', X.exportBtnPresent); // picker CHOOSER itself is manual-only (tasks/test-deps.md)
await H.section('settings-config: sGroup', S.sGroup); // bug batch B on Settings (S1–S8)
await H.section('charts-toggle: radioSwitch', C.radioSwitch); // C1/C2 ids from tasks/bugs.md
await H.section('history-export: breakdown', X.breakdown);
await H.section('tap-and-toast: viewportMeta', T.viewportMeta);
await H.section('tap-and-toast: billsTyping', T.billsTyping); // G5/G6b garbage-row shape + full-size taps
await H.section('tap-and-toast: noZoom', T.noZoom); // Z1 (tasks/bugs-3.md): app-like page, zoom fully off, zoom gestures fully off
await H.section('tap-and-toast: toastColors', T.toastColors); // G1 kinds/colours read via the app's CSS custom properties
await H.section('tap-and-toast: toastOnScrolledPage', T.toastOnScrolledPage);
await H.section('tap-and-toast: iosModeSwitch', T.iosModeSwitch);
await H.section('tap-and-toast: switchRow', T.switchRow); // Z4 (tasks/bugs-3.md): one-row CSS pills + lit-state readable, no native radio paint
await H.section('ui-polish: headersTop', Q.headersTop); // P1..P7 (tasks/bugs-4.md) — all seven read computed styles/geometry, so they are locally provable
await H.section('ui-polish: labelsOutside', Q.labelsOutside);
await H.section('ui-polish: billsPolish', Q.billsPolish);
await H.section('ui-polish: flatRows', Q.flatRows);
await H.section('ui-polish: materialIcons', Q.materialIcons); // MD1 (design pass): vendored Material Icons woff2 renders real glyphs on tabs+pills, tofu fallback goes RED
await H.section('ui-polish: buttonSize', Q.buttonSize);
await H.section('ui-polish: monthTables', Q.monthTables); // needs the saved months ⇒ runs before the G7 history wipe below
await H.section('settings-config: settingsCardG', S.settingsCardG); // G8/G9 card layout on the Settings tab
await H.section('settings-config: wipeSavedMonths', S.wipeSavedMonths); // destructive ⇒ two taps; months survive/disarm rules
await H.errorTrailChk(); // ui.js parks glue throws in document.title + console — those trails must not be green-and-lost (rpSaved alone would launder them)
await H.closeAll();
process.exit((await H.report()) ? 1 : 0); // report is async: without await it returned a Promise => exit code lied green-vs-red
