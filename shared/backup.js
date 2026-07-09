// Shared between the NNL and NFS apps.
const BACKUP_REMINDER_KEY = 'jarelys_last_backup';
const BACKUP_REMINDER_DAYS = 7;
function daysSinceLastBackup(){
  const last = localStorage.getItem(BACKUP_REMINDER_KEY);
  if(!last) return null;
  return Math.floor((Date.now() - new Date(last).getTime()) / 86400000);
}
function renderBackupReminder(){
  const days = daysSinceLastBackup();
  if(days !== null && days < BACKUP_REMINDER_DAYS) return '';
  const msg = days === null
    ? "You haven't downloaded a backup yet."
    : `Your last backup was ${days} day${days===1?'':'s'} ago.`;
  return `<div class="card"><div class="balancebar warn"><span>💾 ${msg} Click "Backup Data" above to save a fresh copy of everything.</span><span></span></div></div>`;
}

let exportDirHandle = null; // File System Access API handle, in-memory only (browser security)

const FOLDER_SUPPORTED = 'showDirectoryPicker' in window;

async function connectExportFolder(){
  if(!FOLDER_SUPPORTED){
    alert("Your browser doesn't support connecting a folder (this needs Chrome or Edge on a computer). Exports will download normally instead.");
    return;
  }
  try{
    exportDirHandle = await window.showDirectoryPicker();
    document.getElementById('folder-status').textContent = '📁 Connected — exports save straight to your folder (until you close this tab)';
    document.getElementById('folder-status').style.color = 'var(--good-500)';
  }catch(e){ /* user cancelled the picker */ }
}
async function writeBlobToFolderOrDownload(blob, filename){
  if(exportDirHandle){
    try{
      const fileHandle = await exportDirHandle.getFileHandle(filename, {create:true});
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    }catch(e){
      alert('Could not save to the connected folder, downloading instead. ('+e.message+')');
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  return false;
}
async function writeWorkbook(wb, filename){
  const buf = XLSX.write(wb, {bookType:'xlsx', type:'array'});
  const blob = new Blob([buf], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  return writeBlobToFolderOrDownload(blob, filename);
}
function buildLoadsSheetData(company){
  const isNNL = company==='NNL';
  const rows = loadsFor(company).slice().sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  if(!rows.length) return [{Note:'No loads logged yet'}];
  return rows.map(l=>{
    const base = {
      Date: l.date, [isNNL?'Broker':'Client']: l.party || '', 'Ticket #': l.ticket || ''
    };
    if(isNNL){ base['Pit']=l.pit||''; base['Customer']=l.customer||''; base['Job Name']=l.jobName||''; }
    if(!isNNL){ base['Broker']=l.broker||''; base['Job Name']=l.jobName||''; base['Job Source']=l.jobSource||''; base['Driver Type']=l.driverType||''; }
    Object.assign(base, {
      'Truck #': l.truck||'', Driver: l.driver||'', 'Payment Type': l.paymentType||'',
      Quantity: Number(l.qty)||0, 'Rate ($)': Number(l.rate)||0,
      'Job Revenue': Number(l.revenue)||0, 'Driver Pay': Number(l.driverPay)||0, 'Company Net': Number(l.net)||0,
      'Payment Status': l.status||'', 'Invoice #': l.invoiceNum||'', 'Date Paid': l.datePaid||'', Notes: l.notes||''
    });
    return base;
  });
}
function buildExpensesSheetData(){
  if(!state.expenses.length) return [{Note:'No expenses logged yet'}];
  return state.expenses.slice().sort((a,b)=>(a.date||'').localeCompare(b.date||'')).map(e=>({
    Date:e.date||'', Company:e.company||'', Category:e.category||'', 'Truck #':e.truck||'',
    'Amount ($)':Number(e.amount)||0, Frequency:e.frequency||'', Notes:e.notes||''
  }));
}
// NOTE: unlike the combined app this was extracted from, each split app's
// `state` only ever holds its OWN company's data (loads/expenses/annual are
// pre-filtered by fetchStateFromSupabase, and state.annual is a flat array,
// not keyed by company) — so these only ever build/export the current app's
// single company, never both.
function buildAnnualSheetData(){
  return state.annual.map(a=>({Item:a.item, 'Amount ($)':Number(a.amount)||0, 'Due Date':a.due||'', Status:a.status}));
}
function exportLoadsExcel(company){
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildLoadsSheetData(company)), company+' Loads');
  const name = company==='NNL' ? 'Nalu_Nui_Logistics' : 'Nalu_Freight_Solutions';
  writeWorkbook(wb, `${name}_Loads_${new Date().toISOString().slice(0,10)}.xlsx`);
}
function exportAllExcel(company){
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildLoadsSheetData(company)), company+' Loads');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildExpensesSheetData()), 'Expenses');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildAnnualSheetData()), company+' Annual');
  const name = company==='NNL' ? 'Nalu_Nui_Logistics' : 'Nalu_Freight_Solutions';
  writeWorkbook(wb, `${name}_Backup_${new Date().toISOString().slice(0,10)}.xlsx`);
}
