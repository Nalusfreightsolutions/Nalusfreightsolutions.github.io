// Shared between the NNL and NFS apps.
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }

function nextFriday(){
  const d = new Date();
  const day = d.getDay(); // Sun0..Sat6
  let diff = 5 - day; if(diff < 0) diff += 7;
  d.setDate(d.getDate()+diff);
  return d.toISOString().slice(0,10);
}
function weekEndingFriday(dateStr){
  const d = new Date(dateStr+'T00:00:00');
  if(isNaN(d)) return ''; // blank/invalid date (e.g. a load saved with no date) shouldn't crash week grouping
  const day = d.getDay();
  let diff;
  if(day===0) diff=-2; else if(day===6) diff=-1; else diff = 5-day;
  const fri = new Date(d); fri.setDate(d.getDate()+diff);
  return fri.toISOString().slice(0,10);
}
function fmtDate(s){ if(!s) return '—'; const [y,m,d]=s.split('-'); return `${m}/${d}/${y}`; }
function fmtMoney(n){ n = Number(n)||0; const neg = n<0; n=Math.abs(n); const s = '$'+n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); return neg? '('+s+')' : s; }
function fmtQty(n){ return (Number(n)||0).toFixed(2); }

function numOrNull(v){ return (v===''||v==null||Number.isNaN(Number(v))) ? null : Number(v); }

function sum(arr, key){ return arr.reduce((a,b)=>a+(Number(b[key])||0),0); }
function groupBy(arr, key){
  const g = {};
  arr.forEach(x=>{ const k = x[key]||'—'; (g[k]=g[k]||[]).push(x); });
  return g;
}

function addDays(dateStr, n){ const d = new Date(dateStr+'T00:00:00'); if(isNaN(d)) return ''; d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); }

function unitLabel(paymentType){
  return {'Per Ton':'ton(s)','Per Yard':'yard(s)','Per Load':'load(s)','Per Hour':'hour(s)'}[paymentType] || 'unit(s)';
}
function unitLabelSales(unitType){
  return {'Tons':'ton(s)','Yards':'yard(s)','Loads':'load(s)','Hours':'hour(s)'}[unitType] || 'unit(s)';
}
function unitLabelProposal(unitType){
  return {'Tons':'TN','Yards':'YD','Loads':'LD','Hours':'HR'}[unitType] || 'UNIT';
}
