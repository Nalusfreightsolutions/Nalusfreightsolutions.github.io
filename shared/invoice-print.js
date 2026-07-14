// Shared between the NNL and NFS apps.
/* ============================= INVOICE GENERATION ============================= */
function weekRange(week){ return { startDate: addDays(week,-6), endDate: week }; }
function invoiceItemsFor(company, party, opts){
  if(opts.invoiceNum) return state.loads.filter(l=>l.invoiceNum===opts.invoiceNum);
  return state.loads.filter(l=>l.company===company && l.party===party && l.date>=opts.startDate && l.date<=opts.endDate);
}

function buildInvoiceHTML(company, party, opts){
  const items = invoiceItemsFor(company, party, opts).slice().sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  if(!items.length) return null;

  let invNum = items[0].invoiceNum;
  if(!invNum){
    // state.invoiceCounter is a flat per-company number in each split app (not
    // keyed by company like the old combined app), since `company` here is
    // always this app's own company anyway — state.loads never holds the
    // other company's rows.
    state.invoiceCounter = (state.invoiceCounter||1000) + 1;
    invNum = company+'-'+state.invoiceCounter;
    items.forEach(l=>{ l.invoiceNum = invNum; if(l.status==='Pending') l.status='Invoiced'; });
    persist();
  }

  const biz = BUSINESS_INFO[company];
  const rangeStart = opts.startDate || items[0].date;
  const rangeEnd = opts.endDate || items[items.length-1].date;
  const dueDate = addDays(rangeEnd, 7);
  const total = sum(items,'revenue');

  const jobGroups = {};
  items.forEach(l=>{
    const jn = l.jobName || '—';
    (jobGroups[jn] = jobGroups[jn] || []).push(l);
  });
  const rows = Object.entries(jobGroups).map(([jobName, group])=>{
    const customer = l => (company==='NNL' ? (l.customer||'') : (l.party||'')) || '—';
    const ticketRows = group.map(l=>`
    <tr>
      <td>${fmtDate(l.date)}</td>
      <td class="num">${l.ticket||'—'}</td>
      <td>${customer(l)}</td>
      <td>${jobName}</td>
      <td class="num">${fmtQty(l.qty)} ${unitLabel(l.paymentType)}</td>
      <td class="num">${fmtMoney(l.rate)}</td>
      <td class="num">${fmtMoney(l.revenue)}</td>
    </tr>`).join('');
    const qty = sum(group,'qty');
    const revenue = sum(group,'revenue');
    const unit = unitLabel(group[0].paymentType);
    const totalRow = `
    <tr class="grouprow">
      <td colspan="4">Total for ${jobName}</td>
      <td class="num">${fmtQty(qty)} ${unit}</td>
      <td></td>
      <td class="num">${fmtMoney(revenue)}</td>
    </tr>`;
    return ticketRows + totalRow;
  }).join('');

  const html = `
    <div class="inv-head">
      <div>
        <div class="inv-brand">${biz.name}</div>
        <div class="inv-sub">${biz.sub? biz.sub+'<br>' : ''}${biz.phone}</div>
      </div>
      <div>
        <div class="inv-title">INVOICE</div>
        <div class="inv-meta">
          Invoice #: <strong>${invNum}</strong><br>
          Date Issued: <strong>${fmtDate(rangeEnd)}</strong><br>
          Payment Due: <strong>${fmtDate(dueDate)}</strong>
        </div>
      </div>
    </div>
    <div class="inv-billto">
      <div class="lbl">Bill To</div>
      <div class="name">${party}</div>
    </div>
    <div style="font-size:12px;color:#5C7085;margin-bottom:14px;">${fmtDate(rangeStart)} – ${fmtDate(rangeEnd)}</div>
    <table>
      <thead><tr><th>Date</th><th>Ticket #</th><th>Customer</th><th>Job Name</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="inv-totals">
      <table>
        <tr class="grand"><td>Total Due</td><td class="num">${fmtMoney(total)}</td></tr>
      </table>
    </div>`;
  return { html, invNum, total, dueDate, rangeStart, rangeEnd };
}

function printWithTitle(title){
  const original = document.title;
  document.title = title;
  window.print();
  document.title = original;
}

function openInvoice(company, party, opts){
  if(!opts) opts = weekRange(currentWeekEnding);
  else if(typeof opts === 'string') opts = weekRange(opts);
  const built = buildInvoiceHTML(company, party, opts);
  if(!built){ alert('No loads found for '+party+' in that range.'); return; }
  document.getElementById('invoice-modal').innerHTML = `
    <div class="invoice-page">${built.html}</div>
    <div class="modal-actions no-print">
      <button class="btn btn-ghost" id="inv-close">Close</button>
      <button class="btn btn-primary" id="inv-print">Print / Save as PDF</button>
    </div>`;
  document.getElementById('invoice-overlay').style.display = 'flex';
  document.getElementById('inv-close').onclick = closeInvoice;
  document.getElementById('inv-print').onclick = ()=>printWithTitle('Invoice '+built.invNum);
}

function printAllForWeek(week){
  const combos = [...new Set(state.loads.filter(l=>weekEndingFriday(l.date)===week).map(l=>l.company+'|'+l.party))];
  if(!combos.length){ alert('No loads found for that week.'); return; }
  const range = weekRange(week);
  const pages = combos.map(c=>{
    const [company, party] = c.split('|');
    const built = buildInvoiceHTML(company, party, range);
    return built ? `<div class="invoice-page">${built.html}</div>` : '';
  }).join('');
  document.getElementById('invoice-modal').innerHTML = `
    ${pages}
    <div class="modal-actions no-print">
      <button class="btn btn-ghost" id="inv-close">Close</button>
      <button class="btn btn-primary" id="inv-print">Print / Save All as PDF</button>
    </div>`;
  document.getElementById('invoice-overlay').style.display = 'flex';
  document.getElementById('inv-close').onclick = closeInvoice;
  document.getElementById('inv-print').onclick = ()=>printWithTitle('Invoices');
}

function printDriverPayroll(){
  const { start, end } = weeklyRange;
  const wkLoadsAll = state.loads.filter(l=> l.date && l.date>=start && l.date<=end);
  const allDrivers = groupBy(wkLoadsAll,'driver');
  const entries = Object.entries(allDrivers);
  if(!entries.length){ alert('No loads in this range yet.'); return; }

  const complianceFlagFor = (driverName) => {
    // state.compliance only exists in the NNL app (NFS doesn't track driver
    // compliance) — guard so this shared function doesn't throw in NFS.
    if(!driverName || !state.compliance) return '';
    const match = state.compliance.find(r=>(r.name||'').trim().toLowerCase()===driverName.trim().toLowerCase());
    if(!match) return 'No Compliance Record';
    const s = complianceStatus(match);
    return s.label==='Complete' ? '' : s.label;
  };

  let totalNet = 0, stillToClear = 0;
  const rows = entries.map(([name, items])=>{
    const companies = [...new Set(items.map(i=>i.company))].join(' + ');
    const flag = complianceFlagFor(name);
    const owed = sum(items,'driverPay');
    const deduction = getEffectiveDeduction(name, start, end);
    const netPay = owed - deduction;
    totalNet += netPay;
    // Payment tracking (check #/Zelle + deposited) — defined per-app; shows
    // the stored value, or a blank line to hand-write on the printed sheet.
    const rec = (typeof getPayrollRecord==='function') ? getPayrollRecord(name, start, end) : null;
    const payRef = (rec&&rec.payRef)||'';
    const deposited = !!(rec&&rec.deposited);
    if(!deposited) stillToClear += netPay;
    return `
    <tr>
      <td>${name}${flag ? ` <span style="color:#C0362C; font-weight:700;">⚠ ${flag}</span>` : ''}</td>
      <td>${companies}</td>
      <td class="num">${items.length}</td>
      <td class="num">${fmtMoney(owed)}</td>
      <td class="num">${deduction? '-'+fmtMoney(deduction) : '—'}</td>
      <td class="num" style="font-weight:700;">${fmtMoney(netPay)}</td>
      <td>${payRef || '<span style="display:inline-block; width:90px; border-bottom:1px solid #9FB0C3;">&nbsp;</span>'}</td>
      <td style="text-align:center; font-size:15px;">${deposited? '☑' : '☐'}</td>
    </tr>`;
  }).join('');

  const html = `
    <div class="inv-head">
      <div>
        <div class="inv-brand">Driver Payroll</div>
      </div>
      <div>
        <div class="inv-title">PAYROLL</div>
        <div class="inv-meta">Week: <strong>${fmtDate(start)} – ${fmtDate(end)}</strong></div>
      </div>
    </div>
    <table>
      <thead><tr><th>Driver</th><th>Company</th><th># Loads</th><th>Amount Owed</th><th>Deductions</th><th>Net Pay</th><th>Paid Via (Check # / Zelle)</th><th>Deposited</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="inv-totals">
      <table>
        <tr class="grand"><td>Total Payroll (after deductions)</td><td class="num">${fmtMoney(totalNet)}</td></tr>
        <tr><td style="color:#CC6E0C; font-weight:700;">Still to clear — not yet deposited</td><td class="num" style="color:#CC6E0C; font-weight:700;">${fmtMoney(stillToClear)}</td></tr>
      </table>
    </div>`;

  document.getElementById('invoice-modal').innerHTML = `
    <div class="invoice-page">${html}</div>
    <div class="modal-actions no-print">
      <button class="btn btn-ghost" id="inv-close">Close</button>
      <button class="btn btn-primary" id="inv-print">Print / Save as PDF</button>
    </div>`;
  document.getElementById('invoice-overlay').style.display = 'flex';
  document.getElementById('inv-close').onclick = closeInvoice;
  document.getElementById('inv-print').onclick = ()=>printWithTitle('Driver Payroll');
}

function closeInvoice(){
  document.getElementById('invoice-overlay').style.display = 'none';
  render();
}
