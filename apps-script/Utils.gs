/** MJ ADMIN V11 - Utilitários */
function json_(obj){ return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function nowIso_(){ return new Date().toISOString(); }
function todayIso_(){ return Utilities.formatDate(new Date(), Session.getScriptTimeZone()||'America/Fortaleza', 'yyyy-MM-dd'); }
function scalar_(v){ if(v===undefined||v===null)return ''; if(typeof v==='object')return JSON.stringify(v); return v; }
function arr_(v){ return Array.isArray(v)?v:[]; }
function num_(v){ const n=Number(v); return Number.isFinite(n)?n:0; }
function uid_(prefix){ return (prefix||'id')+'-'+Date.now()+'-'+Math.random().toString(36).slice(2,8); }
function log_(action,key,details){ try{ appendAuditLog_(action,key,details); }catch(_){} }
function withLock_(fn){ const lock=LockService.getScriptLock(); lock.waitLock(20000); try{return fn();}finally{lock.releaseLock();} }
