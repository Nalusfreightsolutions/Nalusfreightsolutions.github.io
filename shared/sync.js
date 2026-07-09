// Shared between the NNL and NFS apps.
/* ---- generic sync helpers ---- */
async function upsertTable(table, rows){
  if(!rows.length) return;
  const { error } = await sbClient.from(table).upsert(rows);
  if(error) console.error('Supabase upsert failed on '+table, error);
}
async function deleteMissing(table, currentIds, companyScope){
  let q = sbClient.from(table).select('id');
  if(companyScope) q = q.eq('company', companyScope);
  const { data, error } = await q;
  if(error){ console.error('Supabase select failed on '+table, error); return; }
  const keep = new Set(currentIds);
  const existing = data||[];
  const toDelete = existing.map(r=>r.id).filter(id=>!keep.has(id));
  if(!toDelete.length) return;
  if(existing.length > 5 && toDelete.length / existing.length > 0.5){
    /* existing 50%-of-N safety guard, unchanged — now stricter since N is
       already company-scoped, not padded by the other company's rows */
    const msg = `Save blocked as a safety measure: it would have deleted ${toDelete.length} of ${existing.length} rows in "${table}" in one go — more than half the table. Nothing was deleted. This usually means this browser tab's data is out of sync with the database (e.g. another device saved changes since this tab last loaded) rather than an intentional bulk delete. Reload the page to get fresh data before making more changes. If you really do need to delete this many records at once, do it directly in the Supabase dashboard instead.`;
    console.error(msg);
    showDataSafetyWarning(msg);
    throw new Error(`Prune safety check blocked delete on "${table}" (${toDelete.length}/${existing.length})`);
  }
  let del = sbClient.from(table).delete().in('id', toDelete);
  if(companyScope) del = del.eq('company', companyScope);   // structural guarantee: even if toDelete
  const { error: delErr } = await del;                      // were ever wrong, this can't touch the
  if(delErr) console.error('Supabase delete failed on '+table, delErr);  // other company's rows at the SQL level
}
async function replaceChildren(table, parentField, parentIds, rows){
  if(parentIds.length){
    const { count, error: countErr } = await sbClient.from(table).select('id', {count:'exact', head:true}).in(parentField, parentIds);
    if(countErr) console.error('Supabase count failed on '+table, countErr);
    const existingCount = count||0;
    if(existingCount > 5 && rows.length < existingCount*0.5){
      const msg = `Save blocked as a safety measure: it would have replaced ${existingCount} existing "${table}" rows with only ${rows.length} — more than half would be lost. Nothing was changed. This usually means this browser tab's data is out of sync with the database (e.g. another device saved changes since this tab last loaded). Reload the page to get fresh data before making more changes.`;
      console.error(msg);
      showDataSafetyWarning(msg);
      throw new Error(`Prune safety check blocked replace on "${table}" (${rows.length}/${existingCount})`);
    }
    const { error } = await sbClient.from(table).delete().in(parentField, parentIds);
    if(error) console.error('Supabase delete-children failed on '+table, error);
  }
  if(rows.length){
    const { error } = await sbClient.from(table).insert(rows);
    if(error) console.error('Supabase insert-children failed on '+table, error);
  }
}
function showDataSafetyWarning(msg){
  document.getElementById('safety-banner-msg').textContent = msg;
  document.getElementById('safety-banner').style.display = 'block';
}
