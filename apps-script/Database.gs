/** MJ ADMIN V11 - Banco/Google Sheets */
function getDb_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) throw new Error('Planilha não encontrada. Vincule o Apps Script à planilha ou configure SPREADSHEET_ID.');
  return active;
}

function setupDatabase() { setupDatabase_(); return 'Banco MJ V11 configurado com sucesso.'; }
function setupDatabase_() {
  const ss = getDb_();
  Object.keys(HEADERS).forEach(function(name) {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const headers = HEADERS[name];
    if (sh.getLastRow() === 0) {
      sh.getRange(1,1,1,headers.length).setValues([headers]);
      sh.setFrozenRows(1); sh.getRange(1,1,1,headers.length).setFontWeight('bold');
    } else {
      headers.forEach(function(h,i){ if (sh.getRange(1,i+1).getValue() !== h) sh.getRange(1,i+1).setValue(h); });
    }
  });
}

function readObjects_(sheetName) {
  const sh = getDb_().getSheetByName(sheetName); if (!sh || sh.getLastRow() < 2) return [];
  const headers = HEADERS[sheetName], values = sh.getRange(2,1,sh.getLastRow()-1,headers.length).getValues(), ji = headers.indexOf('json');
  return values.filter(r => r.some(v => v !== '')).map(function(row){
    if (ji >= 0 && row[ji]) { try { return JSON.parse(row[ji]); } catch(_){} }
    const obj={}; headers.forEach((h,i)=>{ if(h!=='json' && row[i] !== '') obj[h]=row[i]; }); return obj;
  });
}

function writeObjects_(sheetName, objects) {
  const sh=getDb_().getSheetByName(sheetName), headers=HEADERS[sheetName];
  if(sh.getLastRow()>1) sh.getRange(2,1,sh.getLastRow()-1,Math.max(sh.getLastColumn(),headers.length)).clearContent();
  if(!objects.length) return;
  const now=nowIso_(), rows=objects.map(function(obj){ obj=obj||{}; return headers.map(function(h){ if(h==='json') return JSON.stringify(obj); if(h==='updatedAt') return obj.updatedAt||now; return scalar_(obj[h]); }); });
  sh.getRange(2,1,rows.length,headers.length).setValues(rows);
}

function upsertObject_(sheetName, obj, idField) {
  idField=idField||'id'; const all=readObjects_(sheetName), id=String(obj[idField]||'');
  if(!id) throw new Error('Registro sem identificador em '+sheetName+'.');
  const idx=all.findIndex(x=>String(x[idField]||'')===id); obj.updatedAt=nowIso_();
  if(idx>=0) all[idx]=Object.assign({},all[idx],obj); else all.unshift(obj); writeObjects_(sheetName,all); return obj;
}

function deleteObject_(sheetName,id,idField){ idField=idField||'id'; writeObjects_(sheetName,readObjects_(sheetName).filter(x=>String(x[idField]||'')!==String(id))); }

function replaceChildItems_(sheetName, parents, parentField) {
  const rows=[]; (parents||[]).forEach(function(parent){ (parent.items||[]).forEach(function(item,index){ const child=Object.assign({},item); child[parentField]=parent.id; if(!child.id) child.id=String(parent.id)+'-item-'+(index+1); rows.push(child); }); }); writeObjects_(sheetName,rows);
}
function replaceItemsForParent_(sheetName,parentId,parentField,items){
  const current=readObjects_(sheetName).filter(x=>String(x[parentField]||'')!==String(parentId));
  (items||[]).forEach(function(item,index){ const child=Object.assign({},item); child[parentField]=parentId; if(!child.id) child.id=String(parentId)+'-item-'+(index+1); current.push(child); }); writeObjects_(sheetName,current);
}
function attachItems_(parents,items,parentField){ const grouped={}; items.forEach(function(i){ const k=String(i[parentField]||''); (grouped[k]||(grouped[k]=[])).push(Object.assign({},i)); }); return parents.map(function(p){ const list=grouped[String(p.id||'')]||[]; list.forEach(x=>delete x[parentField]); p.items=list; return p; }); }

function writeConfig_(key,value){ const sh=getDb_().getSheetByName('Configuracoes'), rows=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,3).getValues():[], idx=rows.findIndex(r=>String(r[0])===key), row=[key,JSON.stringify(value||{}),nowIso_()]; if(idx>=0) sh.getRange(idx+2,1,1,3).setValues([row]); else sh.appendRow(row); }
function readConfig_(key){ const sh=getDb_().getSheetByName('Configuracoes'); if(!sh||sh.getLastRow()<2)return null; const row=sh.getRange(2,1,sh.getLastRow()-1,3).getValues().find(r=>String(r[0])===key); if(!row||!row[1])return null; try{return JSON.parse(row[1]);}catch(_){return null;} }
