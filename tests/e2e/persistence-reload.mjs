// OPFS persistence acceptance for persistence-reload.feature (one persistent browser profile per pass)
import * as H from './harness.mjs';

export async function bootSurvival() { // markers are per-tab: read History rows at boot so a re-run's cross-launch OPFS survival is visible
  await H.tab('tabHistory');
  const s = await H.snap(); await H.diag('bootState', { rows: s.rows.map((r) => r.m), banner: s.banner }); // non-empty rows on the 2nd+ run against the same profile == persisted across browser launches (see tasks/test-deps.md)
  H.chk('persistence-reload: localhost http is a secure context => no storage-error banner', s.banner === '');
}

export async function reloadChecks() { // --- persistence block: hard reload proves months + edited config round-tripped through OPFS
  await H.diag('beforeReloadTitle', await H.read('document.title'));
  await H.reload(); // renderAll runs only after bootLoad awaited ⇒ markers imply the load completed (harness waits on [data-tab=tabBills])
  await H.tab('tabHistory');
  const s = await H.snap(); await H.diag('afterReloadRows', s.rows.map((r) => r.m));
  H.chk('storage: hard reload keeps history months (OPFS via Web Worker sync handle)', s.rows.filter((r) => r.m === H.M0 || r.m === H.M1).length === 2);
  H.chk('storage: reload did not trip the no-storage banner', s.banner === '');
  await H.tab('tabSettings');
  const cfg = await H.snap(); await H.diag('afterReloadCfg', cfg.cfgRows.map((r) => r.id + '/' + r.name + '/' + r.seed));
  H.chk('storage: hard reload keeps the edited config (renamed meter, new meter with its seed)', cfg.cfgRows.some((r) => r.name === 'Gas A' && r.price === '42') && cfg.cfgRows.some((r) => r.name === 'Boiler' && r.seed === '900'));
}
