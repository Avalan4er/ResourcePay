// Bug batch 4 claims for ui-polish.feature (manual iPhone report, round two). ids P1..P7 live in tasks/bugs-4.md.
// All seven read computed styles / geometry, so unlike the Z1 tap-zoom claim they are provable on the desktop harness.
import { STR as AP } from '../../src/app.js'; // copy compared against the app's dictionary only
import * as H from './harness.mjs';

export async function headersTop() { // P1: a chart card reads "name line ON TOP, bars under it" — not a caption squeezed beside the bars
  await H.tab('tabCharts'); await H.frames();
  const geo = await H.ev(() => [...document.querySelectorAll('div.chart[data-res]')].map((c) => {
    const h = c.querySelector(':scope > h4'), bars = [...c.querySelectorAll('i[data-month]')];
    const hb = h ? h.getBoundingClientRect() : null, cs = getComputedStyle(c);
    const bx = bars.map((b) => Math.round(b.getBoundingClientRect().x));
    return { flex: cs.display + '/' + cs.flexDirection, headBottom: hb ? Math.round(hb.bottom) : -1, headX: hb ? Math.round(hb.x) : -1, barTop: bars.length ? Math.min(...bars.map((b) => Math.round(b.getBoundingClientRect().top))) : -1, barX: bx.length ? Math.min(...bx) : -1, bars: bars.length };
  }));
  H.chk('P1 every chart card flows column-wise with its header above the tallest bar (never beside it)', H.all(geo, 2, (g) => g.flex === 'flex/column' && (g.bars === 0 || (g.headBottom <= g.barTop && g.headX <= g.barX + 2))));
  H.chk('P1 at least one card really carries bars, so the header-over-bars claim is not vacuous', geo.some((g) => g.bars > 0));
}

export async function labelsOutside() { // P2: nothing paints inside the bar pill; months get an axis caption and the card gets a value legend
  const withBars = (await H.snap()).cards.filter((c) => c.bars.length);
  const cards = await H.ev(() => [...document.querySelectorAll('div.chart[data-res]')].filter((c) => c.querySelector('i[data-month]')).map((c) => {
    const legend = c.querySelector(':scope > small.legend');
    return { legend: legend ? (legend.textContent || '').trim() : '', bars: [...c.querySelectorAll('i[data-month]')].map((b) => {
      const p = b.getBoundingClientRect(), py = Math.round(p.y), pb = Math.round(p.y + p.height);
      const kids = [...b.querySelectorAll(':scope > *')].map((k) => {
        const r = k.getBoundingClientRect();
        return { y: Math.round(r.y), h: Math.round(r.height), w: Math.round(r.width), writing: getComputedStyle(k).writingMode, text: (k.textContent || '').trim() };
      });
      return { month: b.dataset.month, v: String(b.dataset.v ?? ''), inside: kids.filter((k) => k.w > 0 && k.h > 0 && k.y >= py - 1 && k.y + k.h <= pb + 1).length, under: kids.filter((k) => k.h > 0 && k.y >= pb - 1) };
    }) };
  }));
  const flat = cards.flatMap((c) => c.bars);
  H.chk('P2 no painted text sits INSIDE a bar pill (the rotated micro-label in the colour block was the bug)', withBars.length > 0 && flat.length > 0 && flat.every((b) => b.inside === 0));
  H.chk('P2 every month is named on a horizontal axis caption under its bar (short YY-MM form so it fits the slot)', flat.every((b) => b.under.some((k) => k.text.includes(String(b.month).slice(2)) && k.writing === 'horizontal-tb')));
  H.chk('P2 every chart card with bars carries one horizontal legend naming each month and its value', cards.length > 0 && cards.every((c) => c.legend.length > 4 && c.bars.every((b) => String(b.v).length > 0 && c.legend.includes(String(b.month)) && c.legend.includes(String(b.v)))));
}

export async function billsPolish() { // P3 (calc line renders struck-through) + P4 (the ₽/unit row states no price figure)
  await H.tab('tabBills'); await H.selectMonth(H.M1);
  for (const [ref, v] of [['gas', 1105], ['electricity', 5505], ['water', 760], ['trash', 305]]) await H.setVal('[data-ref=' + ref + '] [data-role=curr]', v);
  await H.beat();
  const pvs = await H.ev(() => [...document.querySelectorAll('[data-role=pv]')].filter((e) => !e.hidden && String(e.textContent).trim()).map((e) => ({ deco: getComputedStyle(e).textDecorationLine, tag: e.tagName })));
  H.chk('P3 the Δ/calculation line paints no strike-through (an HTML <s> element IS strikethrough — the "dashed" string)', pvs.length >= 3 && pvs.every((p) => p.deco === 'none'));
  const tpl = String(AP.lblPriceOf ?? '{x} per {unit}').split('{x}'); // missing STR key stays a RED claim, not a crash
  const pr = await H.ev(() => [...document.querySelectorAll('div.field[data-ref]')].filter((r) => r.querySelector('[data-role=price]')).map((r) => {
    const lab = r.querySelector('i.lbl[data-for=price]'), i = r.querySelector('[data-role=price]');
    return { txt: (lab?.textContent ?? '').trim(), hidden: lab ? getComputedStyle(lab).display === 'none' : true, def: String(i.dataset.def ?? ''), unit: (r.querySelector('b')?.textContent ?? '').split('\u00b7').pop().trim() };
  }));
  H.chk('P4 every meter row STATES its effective per-unit price in the {x} per {unit} template (number + unit visible)', pr.length >= 3 && pr.every((p) => p.txt.startsWith(tpl[0]) && p.txt.includes(String(tpl[1]).replace('{unit}', p.unit)) && Math.abs(H.parseMoney(p.txt) - +p.def) < 0.05));
  H.chk('P4 that price readout stays painted while the input sits untouched at its default', pr.every((p) => !p.hidden));
}

export async function flatRows() { // P5: rows on the Bills/Settings cards are flat blocks, not a rounded+shadowed card nested inside the card
  await H.tab('tabBills'); await H.frames();
  const rowGeo = await H.rects('div.field[data-ref]'); // measured while still on the Bills tab (other tabs drop these markers)
  const bills = await H.ev(() => [...document.querySelectorAll('div.field[data-ref]')].map((f) => { const c = getComputedStyle(f); return { bg: String(c.backgroundColor), shadow: c.boxShadow, h: Math.round(f.getBoundingClientRect().height) }; }));
  H.chk('P5 Bills meter rows paint no card of their own (transparent background, no inner shadow)', H.all(bills, 3, (b) => (b.bg === 'transparent' || b.bg === 'rgba(0, 0, 0, 0)') && b.shadow === 'none' && b.h > 10));
  H.chk('P5 flattening keeps rows full-width with the >=4px rhythm between them intact', rowGeo.length >= 3 && H.gaps(rowGeo).every((g) => g >= H.GAP_MIN) && rowGeo.every((r) => r[2] >= H.ROW_W_MIN));
  await H.tab('tabSettings');
  const cfg = await H.ev(() => [...document.querySelectorAll('[data-id]'), ...document.querySelectorAll('.cfgNew')].map((r) => { const c = getComputedStyle(r); return { bg: String(c.backgroundColor), shadow: c.boxShadow }; }));
  H.chk('P5 Settings config rows and the add-new-meter block paint no nested card either', cfg.length >= 4 && cfg.every((c) => (c.bg === 'transparent' || c.bg === 'rgba(0, 0, 0, 0)') && c.shadow === 'none'));
}

export async function buttonSize() { // P6: card buttons hug their own copy instead of being stretched across the phone by the column flex
  await H.tab('tabHistory'); await H.frames();
  const btns = await H.rects('[data-el=exportBtn]');
  H.chk('P6 the CSV button hugs its copy (<=200px, not full-bleed) and stays a >=40px tap target', btns.length === 1 && btns[0][2] <= H.BTN_W_MAX && btns[0][3] >= H.TAP);
  await H.tab('tabSettings');
  const others = await H.rects('.card button[data-el=applyBtn], .card button[data-el=clearBtn]');
  H.chk('P6 the Apply/Clear card buttons stop spanning the whole width too (same stretch cause)', others.length === 2 && others.every((b) => b[2] <= H.BTN_W_MAX && b[3] >= H.TAP));
}

export async function monthTables() { // P7: each History item is a small section — heading line + a real per-meter table, not run-on prose
  await H.tab('tabHistory');
  const rows = await H.ev(() => [...document.querySelectorAll('div.row[data-month]')].map((r) => {
    const head = [...(r.querySelector(':scope > table > thead > tr')?.children ?? [])].map((th) => ({ txt: (th.textContent || '').trim(), col: th.dataset.col ?? '' }));
    const body = [...r.querySelectorAll(':scope > table > tbody > tr')].map((tr) => [...tr.children].map((td) => ({ txt: (td?.textContent ?? '').trim(), col: td?.dataset.col ?? '' })));
    return { month: r.dataset.month, totalAttr: r.getAttribute('data-total') ?? '', head, body, tail: String([...r.children].pop()?.textContent ?? '').trim() };
  }));
  const cols = ['meter', 'reading', 'delta', 'price']; // column markers are data attrs; the printed headings come from STR only
  const heads = [AP.colMeter, AP.colReading, AP.colDelta, AP.colPrice]; // missing keys ⇒ undefined ⇒ the claim stays RED (no crash)
  H.chk('P7 each saved month owns a real table whose four headings are STR column copy in order (name, reading, delta, per-unit)', H.all(rows, 2, (r) => r.head.length === 4 && heads.every((copy, i) => String(copy).trim() !== '' && r.head[i].col === cols[i] && r.head[i].txt === String(copy).trim())));
  H.chk('P7 one table row per meter of that month and every cell sits under its own column', H.all(rows, 2, (r) => r.body.length >= 3 && r.body.every((tr) => tr.length === 4 && cols.every((c, i) => tr[i].col === c && tr[i].txt !== ''))));
  H.chk('P7 the month total keeps its own heading line so the headline figure stays readable', rows.every((r) => r.tail.includes('\u20bd') && r.tail.length > 8));
  H.chk('P7 each month carries its raw total on the section itself (money agreement reads it, not parsed prose)', rows.length >= 2 && rows.every((r) => /-?\d+(\.\d+)?$/.test(r.totalAttr)));
}

export async function materialIcons() { // MD1 (MD3 redesign pass 2026-10-25): Material Icons ligature glyphs must actually render from the VENDORED woff2 (src/material-icons.woff2) — SPEC bans CDN fonts, so a broken @font-face may not silently fall back to tofu text
  await H.tab('tabCharts'); await H.frames(); // pills exist only on Charts; the tab strip exists on every tab
  const faces = await H.ev(async () => { const l = await document.fonts.load('24px "Material Icons"', 'settings'); return [l.length, l.some((f) => String(f.status ?? '') === 'loaded')]; }); // fonts.load forces the face before any paint probes race it
  const glyphs = await H.ev(() => [...document.querySelectorAll('.tabs button i.ic, .card .modeSw i.ic')].map((s) => { const c = getComputedStyle(s), r = s.getBoundingClientRect(); return { fam: String(c.fontFamily), size: c.fontSize, w: Math.round(r.width), h: Math.round(r.height) }; }));
  H.chk('MD1a the vendored Material Icons woff2 is a loaded @font-face (no CDN font)', faces[0] > 0 && faces[1]);
  H.chk('MD1b tab strip + mode pills paint six single-glyph boxes on the Material Icons face at 24px (fallback ligature text would read far wider)', glyphs.length === 6 && glyphs.every((g) => /Material Icons/.test(g.fam) && g.size === '24px' && g.w >= 16 && g.w <= 32 && g.h >= 16 && g.h <= 40));
}
