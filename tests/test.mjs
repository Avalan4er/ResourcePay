// ResourcePay unit tests: every export needs a case, gate enforced at end.
import * as A from '../src/app.js';
import { strict as eq } from 'node:assert';

let fails = []; const ran = new Set();
const ok = (c,m)=>{ if(!c) fails.push(m); };
const run=(names,fn)=>{ names.forEach(n=>ran.add(n)); try{fn();}catch(e){fails.push(e.message||String(e));} };

// ---- fmt helpers
run(['fmtRub','fmtInt'], ()=>{ const r=A.fmtRub(1234.5); ok(/,\d{2}\s?\u20bd$/.test(r),`fmtRub keeps comma decimals + ₽: ${r}`); eq(A.fmtInt(0),'0'); });
run(['csvMoney'], ()=>{ eq(A.csvMoney(1234.5),'1234,50'); eq(A.csvMoney(-3),'-3,00'); });

// ---- constants gate coverage
run(['DEFAULT_CONFIG','STR'], ()=>{ ok(A.DEFAULT_CONFIG.some(c=>c.id==='trash'&&c.fixed===true),'trash fixed-cost default exists'); ok(Object.keys(A.STR).length>=6,'STR has UI copy keys'); });

const st = { config:[
  {id:'g1',name:'Gas A',unit:'m³',price:10,active:true,seed:100},
  {id:'w1',name:'Water',unit:'m³',price:2,active:false,seed:null},
], history:[{month:'2026-08',rows:[{ref:'g1',name:'Gas A',unit:'m³',fixed:false,curr:130,price:10}]}]};

run(['resolvePrev','calcRows'], ()=>{
  // gap months inherit last-known (no Sep row → Oct prev=130)
  const rows=A.calcRows(st,'2026-10');
  ok(rows.length===1&&rows[0].ref==='g1','inactive meter excluded from form; active computed');
  eq(rows[0].prev,130);
  // first-ever uses seed baseline not zero
  const fresh={config:[{id:'e',name:'ELEC',unit:'kWh',price:5,active:true,seed:20}],history:[]};
  const f=A.calcRows(fresh,'2026-11'); ok(f.some(r=>r.ref==='e'&&r.prev===20),'first run seeds baseline as prev not null/zero');
});

run(['upsertMonth'], ()=>{
  const [s,w]=A.upsertMonth(st,'2026-10',{g1:140},{g1:9});
  ok(w.length===0,'no warnings on normal upsert');
  eq(s.history.length,2); ok(s.history[0].month==='2026-10','history stays newest-first desc sorted');
  const row=s.history.find(h=>h.month==='2026-10').rows.find(r=>r.ref==='g1');
  eq(row.price,9); eq(row.curr,140);
  // same month updates not duplicates
  const [s2]=A.upsertMonth(s,'2026-10',{g1:150});
  eq(s2.history.length,2); const row2=s2.history.find(h=>h.month==='2026-10').rows.find(r=>r.ref==='g1'); eq(row2.curr,150);
  // negative diff (meter replaced) warns but saves; garbage amount decimals allowed on fixed rows
  const [s3,w3]=A.upsertMonth(st,'2026-10',{g1:5,trash:390.5});
  ok(w3.some(x=>x.ref==='g1'),`negative Δ flags ${w3.length} warning(s) w/ ref g1`); eq(s3.history.length,2);
  ok(s3.history.find(h=>h.month==='2026-10').rows.some(r=>r.ref==='trash'&&r.curr===390.5),'fixed garbage row keeps decimal amount (no int coercion)');
});

run(['updateConfig'], ()=>{
  const patched=A.updateConfig(st,{id:'g1',price:7,active:false});
  ok(patched.config.some(c=>c.id==='g1'&&c.price===7&&c.active===false),'patch existing meter price+disable');
  eq(patched.history,st.history);
  // seed required when creating a NEW non-fixed meter
  const added=A.updateConfig(st,{id:'x',name:'Gas B',unit:'m³',price:3,active:true,seed:5});
  ok(added.config.some(c=>c.id==='x'&&c.seed===5),'new meter added w required seed');
  let threw=false; try{ A.updateConfig(st,{id:'y',name:'NoSeed',unit:'m³',price:1,active:true}) }catch(e){threw=true} ok(threw,'seed mandatory for new meters');
});

run(['buildCsv'], ()=>{
  const wide={config:[{id:'g1',name:'Gas A',unit:'m³',price:10,active:true,seed:100},{id:'w1',name:'Water',unit:'m³',price:2,active:false,seed:null},{id:'trash',name:'Trash',unit:'₽/month',fixed:true,price:1,active:true,seed:null}],history:[{month:'2026-08',rows:[{ref:'g1',name:'Gas A',unit:'m³',fixed:false,curr:130,price:10},{ref:'trash',name:'Trash',unit:'₽/month',fixed:true,curr:250.25,price:1}]},{month:'2026-09',rows:[{ref:'g1',name:'Gas A',unit:'m³',fixed:false,curr:150,price:8}]}]};
  const csv=A.buildCsv(wide); ok(csv.startsWith('\uFEFF'),'BOM first');
  const lines=csv.split('\n');
  eq(lines[1],'date;Gas A;Δ Gas A;Gas A ₽;Water;Δ Water;Water ₽;Trash;Δ Trash;Trash ₽;total ₽','wide header groups in config order + uniform labels + total column');
  ok(lines.some(l=>l.startsWith('2026-08;')&&l.includes(';130;30;300,00')),'Aug row: absolute 130, Δ from seed(100)=30, money=Δ*stored price 10');
  ok(lines.some(l=>/^2026-08/.test(l)&&l.includes(';;250,25')),'garbage fills money-only cell (absolute+Δ blank) incl amount decimals');
  const iA=lines.findIndex(l=>/^2026-08/.test(l)), iS=lines.findIndex(l=>/^2026-09/.test(l));
  ok(iS>iA&&iA>1,'chronological oldest→newest (Aug line before Sep)');
  const sep=lines.findIndex(l=>l.startsWith('#cfg')); ok(sep>2,'settings marker block after month rows');
  ok(lines.slice(sep).some(l=>l===' #cfg;g1;Gas A;m³;1;10;100'.trim()),'meter marker carries seed');
});

// descriptors DOM-free render contracts
run(['describeMonthForm','describeHistoryRows','describeCharts'], ()=>{
  const form=A.describeMonthForm(st,'2026-10');
  ok(form.fields.length===1&&form.totalMoneyLabel,'form exposes active fields + month total slot');
  const hist=A.describeHistoryRows(st);
  eq(hist.length,1); eq(hist[0].month,'2026-08');
  const chVol=A.describeCharts(st,'volume'), chMny=A.describeCharts(st,'money');
  eq(chVol.length,chMny.length); ok(chVol.every(g=>g.bars.length>0||g.empty),'one group per active resource, bars carry month values');
});

// gate: every export must appear in ≥1 case above
const EXPORTS=Object.keys(A); const missing=EXPORTS.filter(n=>!ran.has(n));
if(missing.length) fails.push(`coverage gate: exports without unit case: ${missing.join(', ')}`);
if(fails.length){ console.error('FAILURES\n'+fails.map((f,i)=>`${i+1}. ${f}`).join('\n')); process.exit(1); }
console.log(`OK unit layer — ${ran.size}/${EXPORTS.length} exports exercised (${EXPORTS.join(',')})`);
