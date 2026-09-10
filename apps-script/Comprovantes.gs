/** MJ ADMIN V11.21 - Comprovantes privados de vendas e compras no Google Drive */
const MJ_RECEIPT_MAX_BYTES = 8 * 1024 * 1024;
const MJ_RECEIPT_TYPES = ['application/pdf','image/jpeg','image/png','image/webp'];

function getReceiptRootFolder_(){
  const props=PropertiesService.getScriptProperties();
  const saved=props.getProperty('MJ_RECEIPTS_FOLDER_ID');
  if(saved){ try{return DriveApp.getFolderById(saved);}catch(_){props.deleteProperty('MJ_RECEIPTS_FOLDER_ID');} }
  const folder=DriveApp.createFolder('MJ Admin - Comprovantes');
  props.setProperty('MJ_RECEIPTS_FOLDER_ID',folder.getId());
  return folder;
}
function getOrCreateSubFolder_(parent,name){
  const it=parent.getFoldersByName(name); return it.hasNext()?it.next():parent.createFolder(name);
}
function safeFileName_(name){
  return String(name||'comprovante').replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,' ').trim().slice(0,140)||'comprovante';
}
function decodeReceiptBase64_(data){
  const raw=String(data||'').replace(/^data:[^;]+;base64,/, '');
  if(!raw) throw new Error('Arquivo do comprovante não recebido.');
  return Utilities.base64Decode(raw);
}
function anexarComprovante_(body){
  const entityType=String(body.entityType||'');
  const id=String(body.id||'');
  const fileName=safeFileName_(body.fileName||'comprovante');
  const mimeType=String(body.mimeType||'application/octet-stream').toLowerCase();
  if(!id) throw new Error('Registro não informado.');
  if(!['Venda','Compra'].includes(entityType)) throw new Error('Tipo de registro inválido para comprovante.');
  if(!MJ_RECEIPT_TYPES.includes(mimeType)) throw new Error('Formato não permitido. Use PDF, JPG, PNG ou WEBP.');
  const bytes=decodeReceiptBase64_(body.base64);
  if(bytes.length > MJ_RECEIPT_MAX_BYTES) throw new Error('O comprovante deve ter no máximo 8 MB.');

  const sheetName=entityType==='Venda'?'Vendas':'Compras';
  const all=readObjects_(sheetName);
  const idx=all.findIndex(x=>String(x.id)===id);
  if(idx<0) throw new Error(entityType+' não encontrada para anexar o comprovante.');
  const rec=all[idx];

  if(rec.receiptFileId){
    try{ DriveApp.getFileById(String(rec.receiptFileId)).setTrashed(true); }catch(_){ }
  }

  const root=getReceiptRootFolder_();
  const group=getOrCreateSubFolder_(root,entityType==='Venda'?'Vendas':'Compras');
  const prefix=safeFileName_(rec.num||id);
  const blob=Utilities.newBlob(bytes,mimeType,prefix+' - '+fileName);
  const file=group.createFile(blob);
  rec.receiptFileId=file.getId();
  rec.receiptFileName=file.getName();
  rec.receiptUrl=file.getUrl();
  rec.receiptUploadedAt=nowIso_();
  rec.updatedAt=nowIso_();
  all[idx]=rec;
  writeObjects_(sheetName,all);
  log_('anexarComprovante',id,entityType+' - '+file.getName());
  return {id:id,entityType:entityType,receiptFileId:rec.receiptFileId,receiptFileName:rec.receiptFileName,receiptUrl:rec.receiptUrl,receiptUploadedAt:rec.receiptUploadedAt};
}



/** Retorna o arquivo privado para visualização dentro do MJ Admin. */
function obterComprovante_(body){
  const entityType=String(body.entityType||'');
  const id=String(body.id||'');
  if(!id) throw new Error('Registro não informado.');
  if(!['Venda','Compra'].includes(entityType)) throw new Error('Tipo de registro inválido para comprovante.');

  const sheetName=entityType==='Venda'?'Vendas':'Compras';
  const all=readObjects_(sheetName);
  const rec=all.find(x=>String(x.id)===id);
  if(!rec) throw new Error(entityType+' não encontrada.');
  if(!rec.receiptFileId) throw new Error('Este registro não possui comprovante anexado.');

  let file;
  try{ file=DriveApp.getFileById(String(rec.receiptFileId)); }
  catch(_){ throw new Error('O comprovante não foi encontrado no Google Drive.'); }

  if(file.isTrashed()) throw new Error('O comprovante foi removido do Google Drive.');
  const blob=file.getBlob();
  const bytes=blob.getBytes();
  if(bytes.length > MJ_RECEIPT_MAX_BYTES) throw new Error('O comprovante excede o limite de visualização de 8 MB.');

  return {
    id:id,
    entityType:entityType,
    fileName:file.getName(),
    mimeType:String(blob.getContentType()||'application/octet-stream'),
    base64:Utilities.base64Encode(bytes)
  };
}

/** Execute uma vez pelo editor do Apps Script para conceder a permissão do Google Drive. */
function testarPermissaoComprovantes(){
  const folder=getReceiptRootFolder_();
  return 'Permissão OK. Pasta: '+folder.getName()+' - '+folder.getUrl();
}
