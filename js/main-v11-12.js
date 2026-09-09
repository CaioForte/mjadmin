const views=[...document.querySelectorAll('.view')];
const navBtns=[...document.querySelectorAll('#nav button')];
function go(view,options={}){
  if(view==='nova-venda'&&options.freshSale&&typeof clearSaleForm==='function')clearSaleForm(false);
  views.forEach(v=>v.classList.toggle('active',v.id===view));
  navBtns.forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  // Guarda a tela atual durante a sessão. Se uma sincronização com o Google
  // precisar recarregar a página, o usuário volta para o mesmo módulo.
  try{sessionStorage.setItem('mj_active_view',view);}catch(_){ }
  window.scrollTo({top:0,behavior:'smooth'});
}
const rememberedView=(()=>{try{return sessionStorage.getItem('mj_active_view')||'';}catch(_){return '';}})();
if(rememberedView&&views.some(v=>v.id===rememberedView)){
  views.forEach(v=>v.classList.toggle('active',v.id===rememberedView));
  navBtns.forEach(b=>b.classList.toggle('active',b.dataset.view===rememberedView));
}
navBtns.forEach(b=>b.addEventListener('click',()=>go(b.dataset.view,{freshSale:b.dataset.view==='nova-venda'})));
document.querySelectorAll('[data-goto]').forEach(el=>el.addEventListener('click',e=>{e.preventDefault();go(el.dataset.goto,{freshSale:el.dataset.goto==='nova-venda'})}));
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');clearTimeout(window.__tt);window.__tt=setTimeout(()=>t.classList.remove('show'),2200)}
window.toast=toast;
const defaultQuotes=[];
let quotes=JSON.parse(localStorage.getItem('mj_quotes')||'null')||defaultQuotes;
let quoteItemsDraft=[];

function statusClass(s){return s==='Aprovado'?'paid':s==='Pendente'?'pending':s==='Expirado'?'expired':s==='Recusado'?'rejected':'converted'}
function brDate(iso){if(!iso)return '-';if(String(iso).includes('/'))return iso;const [y,m,d]=String(iso).split('-');return y&&m&&d?`${d}/${m}/${y}`:'-'}
function isoFromBR(value){if(!value||!String(value).includes('/'))return value||'';const [d,m,y]=String(value).split('/');return y&&m&&d?`${y}-${m}-${d}`:''}
function currentISODate(){return new Date().toISOString().slice(0,10)}
function addDaysISO(iso,days){const d=new Date(`${iso}T12:00:00`);d.setDate(d.getDate()+days);return d.toISOString().slice(0,10)}
function saveQuotes(){localStorage.setItem('mj_quotes',JSON.stringify(quotes));window.MJCloud?.pushKey('mj_quotes',quotes).catch(err=>console.error('[MJ Cloud] Orçamentos:',err));}
function quoteClientName(q){
  const c=(typeof clients!=='undefined'&&q.clientId)?clients.find(x=>x.id===q.clientId):null;
  return c?clientDisplayName(c):(q.cliente||'Cliente não informado');
}
function normalizeQuote(q,index){
  const total=Number(q.total??parseMoneyBR(q.valor));
  const items=Array.isArray(q.items)&&q.items.length?q.items.map((i,j)=>({id:i.id||`qi-${Date.now()}-${index}-${j}`,productId:i.productId||'',name:i.name||i.product||'Item',qty:Number(i.qty||1),unitPrice:Number(i.unitPrice??i.price??0)})):[{id:`legacy-${index}`,productId:'',name:'Item do orçamento',qty:1,unitPrice:total}];
  const subtotal=items.reduce((sum,i)=>sum+(Number(i.qty)||0)*(Number(i.unitPrice)||0),0);
  const discount=Number(q.discount||Math.max(0,subtotal-total)||0);
  return {...q,id:q.id||`q-${Date.now()}-${index}`,num:q.num||`ORC-${String(index+1).padStart(4,'0')}`,date:q.date||isoFromBR(q.data)||currentISODate(),data:q.data||brDate(q.date),clientId:q.clientId||'',cliente:q.cliente||'',items,subtotal,discount,total:Math.max(0,subtotal-discount),valor:moneyBR(Math.max(0,subtotal-discount)),validity:q.validity||isoFromBR(q.validade)||'',validade:q.validade||brDate(q.validity),status:q.status||'Pendente',paymentTerms:q.paymentTerms||'',obs:q.obs||''};
}
function migrateQuotes(){quotes=quotes.map(normalizeQuote);saveQuotes();}
function nextQuoteNumber(){
  const nums=quotes.map(q=>parseInt(String(q.num||'').replace(/\D/g,''),10)).filter(Number.isFinite);
  return `ORC-${String((nums.length?Math.max(...nums):0)+1).padStart(4,'0')}`;
}
function quoteTotal(q){return Number(q.total??parseMoneyBR(q.valor))||0;}
function renderQuoteStats(){
  const set=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val};
  set('quoteCount',quotes.length);
  set('quotePendingCount',quotes.filter(q=>q.status==='Pendente').length);
  set('quoteApprovedCount',quotes.filter(q=>q.status==='Aprovado').length);
  set('quoteOpenValue',moneyBR(quotes.filter(q=>['Pendente','Aprovado'].includes(q.status)).reduce((s,q)=>s+quoteTotal(q),0)));
  const dash=document.querySelector('#dashboard .metric:nth-child(5) strong');if(dash)dash.textContent=quotes.filter(q=>q.status==='Pendente').length;
}
function renderQuotes(){
 const q=(document.getElementById('quoteSearch')?.value||'').toLowerCase().trim();
 const sf=document.getElementById('quoteStatusFilter')?.value||'';
 const body=document.getElementById('quotesBody'); if(!body)return;
 const rows=quotes.filter(x=>{const name=quoteClientName(x);return(!q||String(x.num).toLowerCase().includes(q)||name.toLowerCase().includes(q))&&(!sf||x.status===sf)});
 body.innerHTML=rows.map(x=>`<tr>
   <td><b>${esc(x.num)}</b></td><td>${brDate(x.date)}</td><td>${esc(quoteClientName(x))}</td><td><b>${moneyBR(quoteTotal(x))}</b></td><td>${brDate(x.validity)}</td>
   <td><span class="status ${statusClass(x.status)}">${esc(x.status)}</span></td>
   <td><div class="quote-actions"><button class="action-btn" title="Visualizar" onclick="viewQuote('${x.id}')">◉</button><button class="action-btn" title="Editar" onclick="editQuote('${x.id}')">✎</button>${x.status!=='Convertido'?`<button class="action-btn convert" title="Converter em venda" onclick="convertQuote('${x.id}')">↗</button>`:''}<button class="action-btn delete" title="Excluir" onclick="deleteQuote('${x.id}')">🗑</button></div></td>
 </tr>`).join('')||'<tr><td colspan="7" class="empty-table">Nenhum orçamento encontrado.</td></tr>';
 const rc=document.getElementById('quoteResultCount');if(rc)rc.textContent=`${rows.length} orçamento(s)`;
 renderQuoteStats();
}
function populateQuoteClients(selected=''){
 const sel=document.getElementById('quoteClientSelect');if(!sel||typeof clients==='undefined')return;
 const active=clients.filter(c=>c.status==='Ativo');sel.innerHTML='<option value="">Selecione um cliente</option>'+active.map(c=>`<option value="${esc(c.id)}">${esc(clientDisplayName(c))} • ${esc(c.document||'sem documento')}</option>`).join('');
 if(selected)sel.value=selected;
}
function populateQuoteProducts(selected=''){
 const sel=document.getElementById('quoteProductSelect');if(!sel||typeof products==='undefined')return;
 const active=products.filter(p=>p.status==='Ativo');sel.innerHTML='<option value="">Selecione um item</option>'+active.map(p=>`<option value="${esc(p.id)}">${esc(p.code)} • ${esc(p.name)} — ${isVariablePriceProduct(p)?'Preço variável':moneyBR(p.price)}</option>`).join('');
 if(selected)sel.value=selected;
}
function calculateQuoteDraft(){
 const subtotal=quoteItemsDraft.reduce((s,i)=>s+(Number(i.qty)||0)*(Number(i.unitPrice)||0),0);
 const discount=Math.max(0,parseMoneyBR(document.getElementById('quoteDiscount')?.value||0));
 const total=Math.max(0,subtotal-discount);
 const a=document.getElementById('quoteSubtotalLabel'),b=document.getElementById('quoteTotalLabel');if(a)a.textContent=moneyBR(subtotal);if(b)b.textContent=moneyBR(total);
 return {subtotal,discount,total};
}
function renderQuoteItems(){
 const body=document.getElementById('quoteItemsBody');if(!body)return;
 body.innerHTML=quoteItemsDraft.map(i=>`<tr><td><b>${esc(i.name)}</b>${i.code?`<small class="quote-item-code">${esc(i.code)}</small>`:''}</td><td><input class="quote-table-input qty" type="number" min="0.01" step="0.01" value="${Number(i.qty)}" onchange="updateQuoteItem('${i.id}','qty',this.value)"></td><td><input class="quote-table-input price" value="${Number(i.unitPrice).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}" onchange="updateQuoteItem('${i.id}','price',this.value)"></td><td><b>${moneyBR(Number(i.qty)*Number(i.unitPrice))}</b></td><td><button class="action-btn delete" type="button" title="Remover" onclick="removeQuoteItem('${i.id}')">×</button></td></tr>`).join('')||'<tr><td colspan="5" class="empty-table">Adicione produtos ou serviços ao orçamento.</td></tr>';
 calculateQuoteDraft();
}
function updateQuoteItem(id,field,value){const item=quoteItemsDraft.find(i=>i.id===id);if(!item)return;if(field==='qty')item.qty=Math.max(.01,Number(value)||1);if(field==='price')item.unitPrice=Math.max(0,parseMoneyBR(value));renderQuoteItems();}
function removeQuoteItem(id){quoteItemsDraft=quoteItemsDraft.filter(i=>i.id!==id);renderQuoteItems();}
function addQuoteItem(){
 const sel=document.getElementById('quoteProductSelect');const pid=sel?.value||'';if(!pid){toast('Selecione um produto ou serviço.');return;}
 const p=products.find(x=>x.id===pid);if(!p)return;
 const qty=Math.max(.01,Number(document.getElementById('quoteItemQty')?.value)||1);
 const priceInput=document.getElementById('quoteItemPrice'); const rawPrice=String(priceInput?.value||'').trim(); if(isVariablePriceProduct(p)&&!rawPrice){toast('Informe o valor unitário deste item. O produto está com preço variável.');priceInput?.focus();return;} const price=Math.max(0,parseMoneyBR(rawPrice||p.price));
 const existing=quoteItemsDraft.find(i=>i.productId===pid&&Number(i.unitPrice)===price);
 if(existing)existing.qty+=qty;else quoteItemsDraft.push({id:`qi-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,productId:p.id,code:p.code,name:p.name,qty,unitPrice:price});
 if(sel)sel.value='';document.getElementById('quoteItemQty').value='1';document.getElementById('quoteItemPrice').value='';renderQuoteItems();
}
function openQuoteForm(quote=null){
 const form=document.getElementById('quoteForm');if(!form)return;
 const isEdit=!!quote;document.getElementById('quoteFormTitle').textContent=isEdit?'Editar orçamento':'Novo orçamento';document.getElementById('quoteEditId').value=quote?.id||'';
 document.getElementById('quoteNumber').value=quote?.num||nextQuoteNumber();document.getElementById('quoteDate').value=quote?.date||currentISODate();document.getElementById('quoteValidity').value=quote?.validity||addDaysISO(currentISODate(),7);
 document.getElementById('quoteStatus').value=quote?.status==='Convertido'?'Aprovado':(quote?.status||'Pendente');document.getElementById('quotePaymentTerms').value=quote?.paymentTerms||'';document.getElementById('quoteObs').value=quote?.obs||'';
 populateQuoteClients(quote?.clientId||'');populateQuoteProducts();
 if(quote&&!quote.clientId){const match=clients.find(c=>clientDisplayName(c).toLowerCase()===String(quote.cliente||'').toLowerCase()||c.name.toLowerCase()===String(quote.cliente||'').toLowerCase());if(match)document.getElementById('quoteClientSelect').value=match.id;}
 quoteItemsDraft=(quote?.items||[]).map(i=>({...i,id:`${i.id||'qi'}-edit-${Math.random().toString(36).slice(2,6)}`}));
 document.getElementById('quoteDiscount').value=Number(quote?.discount||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});renderQuoteItems();form.style.display='block';setTimeout(()=>form.scrollIntoView({behavior:'smooth',block:'start'}),30);
}
function closeQuoteForm(){const f=document.getElementById('quoteForm');if(f)f.style.display='none';quoteItemsDraft=[];}
function editQuote(id){const q=quotes.find(x=>x.id===id);if(q)openQuoteForm(q);}
function deleteQuote(id){const q=quotes.find(x=>x.id===id);if(!q)return;if(!confirm(`Excluir o orçamento ${q.num} de ${quoteClientName(q)}?`))return;quotes=quotes.filter(x=>x.id!==id);saveQuotes();renderQuotes();closeQuoteModal();toast('Orçamento excluído com sucesso.');}
function saveQuoteFromForm(){
 const id=document.getElementById('quoteEditId').value;const clientId=document.getElementById('quoteClientSelect').value;if(!clientId){toast('Selecione o cliente do orçamento.');return;}
 if(!quoteItemsDraft.length){toast('Adicione pelo menos um produto ou serviço.');return;}
 const client=clients.find(c=>c.id===clientId);const calc=calculateQuoteDraft();if(calc.discount>calc.subtotal){toast('O desconto não pode ser maior que o subtotal.');return;}
 const item={id:id||`q-${Date.now()}`,num:document.getElementById('quoteNumber').value||nextQuoteNumber(),date:document.getElementById('quoteDate').value||currentISODate(),data:brDate(document.getElementById('quoteDate').value||currentISODate()),clientId,cliente:client?clientDisplayName(client):'',items:quoteItemsDraft.map(i=>({...i,id:String(i.id).replace(/-edit-[a-z0-9]+$/,'')})),subtotal:calc.subtotal,discount:calc.discount,total:calc.total,valor:moneyBR(calc.total),validity:document.getElementById('quoteValidity').value,validade:brDate(document.getElementById('quoteValidity').value),status:document.getElementById('quoteStatus').value,paymentTerms:document.getElementById('quotePaymentTerms').value.trim(),obs:document.getElementById('quoteObs').value.trim(),updatedAt:new Date().toISOString()};
 if(id)quotes=quotes.map(q=>q.id===id?item:q);else quotes.unshift(item);saveQuotes();renderQuotes();closeQuoteForm();renderClients();toast(id?'Orçamento atualizado com sucesso.':'Orçamento salvo com sucesso.');
}
function quoteDetailHTML(q){
 const c=clients.find(x=>x.id===q.clientId);const contact=c?[c.whatsapp||c.phone,c.email].filter(Boolean).join(' • '):'';
 return `<div class="quote-detail-head"><div><small>Cliente</small><h4>${esc(quoteClientName(q))}</h4>${contact?`<p>${esc(contact)}</p>`:''}</div><span class="status ${statusClass(q.status)}">${esc(q.status)}</span></div>
 <div class="quote-detail-meta"><div><small>Emissão</small><b>${brDate(q.date)}</b></div><div><small>Validade</small><b>${brDate(q.validity)}</b></div><div><small>Condição de pagamento</small><b>${esc(q.paymentTerms||'Não informada')}</b></div></div>
 <div class="table-scroll"><table class="data-table"><thead><tr><th>Item</th><th>Qtd.</th><th>Unitário</th><th>Subtotal</th></tr></thead><tbody>${q.items.map(i=>`<tr><td>${esc(i.name)}</td><td>${Number(i.qty).toLocaleString('pt-BR')}</td><td>${moneyBR(i.unitPrice)}</td><td><b>${moneyBR(Number(i.qty)*Number(i.unitPrice))}</b></td></tr>`).join('')}</tbody></table></div>
 <div class="quote-detail-footer"><div class="quote-detail-obs">${q.obs?`<small>Observações</small><p>${esc(q.obs)}</p>`:'<small>Sem observações adicionais.</small>'}</div><div class="quote-totals compact"><div class="summary-row"><span>Subtotal</span><b>${moneyBR(q.subtotal)}</b></div><div class="summary-row"><span>Desconto</span><b>${moneyBR(q.discount)}</b></div><div class="summary-row total"><span>Total</span><span>${moneyBR(q.total)}</span></div></div></div>
 <div class="client-modal-actions quote-modal-actions"><button class="btn btn-line" onclick="printQuote('${q.id}')">Imprimir / PDF</button><button class="btn btn-line" onclick="duplicateQuote('${q.id}')">Duplicar</button>${q.status!=='Convertido'?`<button class="btn btn-primary" onclick="convertQuote('${q.id}')">Converter em venda</button>`:''}</div>`;
}
function viewQuote(id){const q=quotes.find(x=>x.id===id);if(!q)return;const modal=document.getElementById('quoteModal');document.getElementById('quoteModalTitle').textContent=q.num;document.getElementById('quoteModalSubtitle').textContent=`Orçamento de ${quoteClientName(q)}`;document.getElementById('quoteModalContent').innerHTML=quoteDetailHTML(q);modal.classList.add('show');modal.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';}
function closeQuoteModal(){const m=document.getElementById('quoteModal');if(!m)return;m.classList.remove('show');m.setAttribute('aria-hidden','true');document.body.style.overflow='';}
function duplicateQuote(id){const q=quotes.find(x=>x.id===id);if(!q)return;closeQuoteModal();const copy={...q,id:'',num:nextQuoteNumber(),date:currentISODate(),validity:addDaysISO(currentISODate(),7),status:'Pendente'};openQuoteForm(copy);document.getElementById('quoteEditId').value='';toast('Cópia carregada. Revise e salve o novo orçamento.');}
function convertQuote(id){
 const q=quotes.find(x=>x.id===id);if(!q)return;if(q.status==='Recusado'||q.status==='Expirado'){if(!confirm(`O orçamento está ${q.status.toLowerCase()}. Deseja converter mesmo assim?`))return;}
 q.status='Convertido';q.convertedAt=new Date().toISOString();saveQuotes();localStorage.setItem('mj_sale_draft',JSON.stringify({sourceQuoteId:q.id,sourceQuoteNumber:q.num,clientId:q.clientId,clientName:quoteClientName(q),items:q.items,total:q.total,discount:q.discount,obs:q.obs,paymentTerms:q.paymentTerms}));renderQuotes();closeQuoteModal();go('nova-venda');const saleClient=document.getElementById('saleClient');if(typeof loadSaleDraft==='function')loadSaleDraft();toast(`${q.num} convertido. Rascunho enviado para Nova Venda.`);
}
function printQuote(id){
 const q=id?quotes.find(x=>x.id===id):collectQuotePreview();if(!q){toast('Preencha o orçamento antes de visualizar.');return;}
 const client=clients.find(c=>c.id===q.clientId);const w=window.open('','_blank');if(!w){toast('O navegador bloqueou a janela de impressão.');return;}
 const rows=(q.items||[]).map(i=>`<tr><td>${esc(i.name)}</td><td>${Number(i.qty).toLocaleString('pt-BR')}</td><td>${moneyBR(i.unitPrice)}</td><td>${moneyBR(Number(i.qty)*Number(i.unitPrice))}</td></tr>`).join('');
 w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(q.num)}</title><style>body{font-family:Arial,sans-serif;color:#251d3a;margin:40px}header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #6a20ff;padding-bottom:18px}.brand{font-size:28px;font-weight:900;color:#6a20ff}.muted{color:#777;font-size:13px}h1{font-size:24px;margin:28px 0 6px}table{width:100%;border-collapse:collapse;margin:22px 0}th,td{padding:11px;border-bottom:1px solid #ddd;text-align:left}th{background:#f5f2ff}.totals{margin-left:auto;width:320px}.row{display:flex;justify-content:space-between;padding:7px 0}.total{font-size:20px;font-weight:900;border-top:2px solid #6a20ff;margin-top:6px;padding-top:12px}.obs{margin-top:28px;background:#f7f5fb;padding:16px;border-radius:10px}@media print{button{display:none}body{margin:18mm}}</style></head><body><header><div><div class="brand">MJ ENVELOPAMENTO</div><div class="muted">Qualidade • Estilo • Personalização</div></div><div style="text-align:right"><b>${esc(q.num)}</b><div class="muted">Emissão: ${brDate(q.date)}<br>Validade: ${brDate(q.validity)}</div></div></header><h1>ORÇAMENTO</h1><p><b>Cliente:</b> ${esc(quoteClientName(q))}${client?.document?`<br><span class="muted">${esc(client.document)}</span>`:''}</p><table><thead><tr><th>Produto/Serviço</th><th>Qtd.</th><th>Unitário</th><th>Subtotal</th></tr></thead><tbody>${rows}</tbody></table><div class="totals"><div class="row"><span>Subtotal</span><b>${moneyBR(q.subtotal)}</b></div><div class="row"><span>Desconto</span><b>${moneyBR(q.discount)}</b></div><div class="row total"><span>Total</span><span>${moneyBR(q.total)}</span></div></div>${q.paymentTerms?`<div class="obs"><b>Condição de pagamento</b><p>${esc(q.paymentTerms)}</p></div>`:''}${q.obs?`<div class="obs"><b>Observações</b><p>${esc(q.obs)}</p></div>`:''}<script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close();
}
function collectQuotePreview(){
 const clientId=document.getElementById('quoteClientSelect')?.value||'';if(!clientId||!quoteItemsDraft.length)return null;const calc=calculateQuoteDraft();return{id:'preview',num:document.getElementById('quoteNumber').value||nextQuoteNumber(),date:document.getElementById('quoteDate').value||currentISODate(),clientId,cliente:'',items:quoteItemsDraft,subtotal:calc.subtotal,discount:calc.discount,total:calc.total,validity:document.getElementById('quoteValidity').value,status:document.getElementById('quoteStatus').value,paymentTerms:document.getElementById('quotePaymentTerms').value.trim(),obs:document.getElementById('quoteObs').value.trim()};
}
function openNewQuoteFlow(){
 go('orcamentos');
 openQuoteForm();
}
function initQuotes(){
 migrateQuotes();renderQuotes();populateQuoteClients();populateQuoteProducts();
 document.getElementById('newQuoteBtn')?.addEventListener('click',(e)=>{e.preventDefault();openNewQuoteFlow();});
 document.getElementById('dashboardNewQuoteBtn')?.addEventListener('click',(e)=>{e.preventDefault();openNewQuoteFlow();});
 document.getElementById('closeQuoteBtn')?.addEventListener('click',closeQuoteForm);document.getElementById('saveQuoteBtn')?.addEventListener('click',saveQuoteFromForm);document.getElementById('previewQuoteBtn')?.addEventListener('click',()=>printQuote());
 document.getElementById('addQuoteItemBtn')?.addEventListener('click',addQuoteItem);document.getElementById('quoteProductSelect')?.addEventListener('change',e=>{const p=products.find(x=>x.id===e.target.value);document.getElementById('quoteItemPrice').value=p?Number(p.price).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}):'';});
 document.getElementById('quoteDiscount')?.addEventListener('input',calculateQuoteDraft);document.getElementById('quoteSearch')?.addEventListener('input',renderQuotes);document.getElementById('quoteStatusFilter')?.addEventListener('change',renderQuotes);document.getElementById('clearQuoteFilters')?.addEventListener('click',()=>{document.getElementById('quoteSearch').value='';document.getElementById('quoteStatusFilter').value='';renderQuotes();});
 document.querySelectorAll('[data-close-quote-modal]').forEach(el=>el.addEventListener('click',closeQuoteModal));document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('quoteModal')?.classList.contains('show'))closeQuoteModal();});
}
window.viewQuote=viewQuote;window.editQuote=editQuote;window.deleteQuote=deleteQuote;window.convertQuote=convertQuote;window.duplicateQuote=duplicateQuote;window.printQuote=printQuote;window.updateQuoteItem=updateQuoteItem;window.removeQuoteItem=removeQuoteItem;window.closeQuoteModal=closeQuoteModal;


// =====================================================
// V4 - CADASTRO FUNCIONAL DE PRODUTOS
// =====================================================
const defaultProducts=[];
let products=JSON.parse(localStorage.getItem('mj_products')||'null')||defaultProducts;

const moneyBR=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
function parseMoneyBR(v){
  if(typeof v==='number')return v;
  const s=String(v||'').trim().replace(/R\$\s?/g,'').replace(/\./g,'').replace(',','.');
  const n=Number(s); return Number.isFinite(n)?n:0;
}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function saveProducts(){localStorage.setItem('mj_products',JSON.stringify(products));window.MJCloud?.pushKey('mj_products',products).catch(err=>console.error('[MJ Cloud] Produtos:',err));}
function nextProductCode(){
  const nums=products.map(p=>parseInt(String(p.code).replace(/\D/g,''),10)).filter(Number.isFinite);
  return String((nums.length?Math.max(...nums):0)+1).padStart(4,'0');
}
function isStockTracked(p){return p.unit!=='SV' && p.category.toLowerCase()!=='serviços';}
function isLowStock(p){return isStockTracked(p) && Number(p.stock)<=Number(p.minStock);}
function productStockBadge(p){
  if(!isStockTracked(p)) return '<span class="status expired">N/A</span>';
  if(Number(p.stock)<=0) return '<span class="status stock-zero">Zerado</span>';
  if(isLowStock(p)) return '<span class="status stock-low">Baixo</span>';
  return '<span class="status stock-ok">Normal</span>';
}
function populateProductCategories(){
  const sel=document.getElementById('productCategoryFilter'); if(!sel)return;
  const current=sel.value;
  const cats=[...new Set(products.map(p=>p.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  sel.innerHTML='<option value="">Todas as categorias</option>'+cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
  if(cats.includes(current))sel.value=current;
}
function isVariablePriceProduct(p){return !!(p&&p.variablePrice);}
function productPriceLabel(p){return isVariablePriceProduct(p)?'Preço variável':moneyBR(Number(p?.price||0));}
function syncProductPriceMode(){const cb=document.getElementById('productVariablePrice'),input=document.getElementById('productPrice');if(!cb||!input)return;input.disabled=cb.checked;if(cb.checked){input.value='';input.placeholder='Valor definido na venda/orçamento';}else{input.placeholder='0,00';}}
function renderProducts(){
  const body=document.getElementById('productsBody'); if(!body)return;
  populateProductCategories();
  const q=(document.getElementById('productSearch')?.value||'').trim().toLowerCase();
  const cat=document.getElementById('productCategoryFilter')?.value||'';
  const status=document.getElementById('productStatusFilter')?.value||'';
  const rows=products.filter(p=>{
    const hay=[p.code,p.name,p.category,p.supplier,p.description].join(' ').toLowerCase();
    return (!q||hay.includes(q))&&(!cat||p.category===cat)&&(!status||p.status===status);
  });
  body.innerHTML=rows.map(p=>`<tr>
    <td>${esc(p.code)}</td>
    <td class="product-name-cell"><b>${esc(p.name)}</b><small>${esc(p.description||'Sem descrição')}</small></td>
    <td>${esc(p.category)}</td><td>${esc(p.unit)}</td><td>${moneyBR(p.cost)}</td><td><b>${isVariablePriceProduct(p)?'<span class="variable-price-badge">Variável</span>':moneyBR(p.price)}</b></td>
    <td>${isStockTracked(p)?Number(p.stock).toLocaleString('pt-BR'): '—'}</td>
    <td><span class="status ${p.status==='Ativo'?'paid':'expired'}">${esc(p.status)}</span></td>
    <td><div class="product-actions"><button class="action-btn" title="Editar" onclick="editProduct('${p.id}')">✎</button><button class="action-btn delete" title="Excluir" onclick="deleteProduct('${p.id}')">🗑</button></div></td>
  </tr>`).join('')||'<tr><td colspan="9" class="empty-table">Nenhum produto encontrado.</td></tr>';
  const rc=document.getElementById('productResultCount'); if(rc)rc.textContent=`${rows.length} produto(s)`;
  renderProductStats(); renderStock(); renderDashboardLowStock();
}
function renderProductStats(){
  const tracked=products.filter(isStockTracked);
  const stockValue=tracked.reduce((s,p)=>s+(Number(p.cost)||0)*(Number(p.stock)||0),0);
  const set=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val};
  set('productCount',products.length); set('productActiveCount',products.filter(p=>p.status==='Ativo').length);
  set('productLowCount',products.filter(isLowStock).length); set('productStockValue',moneyBR(stockValue));
}
function openProductForm(product=null){
  const panel=document.getElementById('productFormPanel'); if(!panel)return;
  document.getElementById('productForm').reset();
  document.getElementById('productEditId').value=product?.id||'';
  document.getElementById('productFormTitle').textContent=product?'Editar produto':'Cadastrar produto';
  document.getElementById('productCode').value=product?.code||nextProductCode();
  document.getElementById('productName').value=product?.name||''; document.getElementById('productCategory').value=product?.category||'';
  document.getElementById('productUnit').value=product?.unit||'UN'; document.getElementById('productCost').value=product?Number(product.cost).toLocaleString('pt-BR',{minimumFractionDigits:2}):'';
  document.getElementById('productVariablePrice').checked=!!product?.variablePrice; document.getElementById('productPrice').value=(product&&!product.variablePrice&&product.price!==null&&product.price!==undefined)?Number(product.price).toLocaleString('pt-BR',{minimumFractionDigits:2}):''; syncProductPriceMode(); document.getElementById('productSupplier').value=product?.supplier||'';
  document.getElementById('productStock').value=product?.stock??0; document.getElementById('productMinStock').value=product?.minStock??0;
  document.getElementById('productStatus').value=product?.status||'Ativo'; document.getElementById('productDescription').value=product?.description||'';
  panel.style.display='block'; setTimeout(()=>panel.scrollIntoView({behavior:'smooth',block:'start'}),30);
}
function closeProductForm(){document.getElementById('productFormPanel').style.display='none';document.getElementById('productEditId').value='';}
function editProduct(id){const p=products.find(x=>x.id===id);if(p){go('produtos');openProductForm(p)}}
function deleteProduct(id){
  const p=products.find(x=>x.id===id); if(!p)return;
  if(!confirm(`Excluir o produto "${p.name}"?`))return;
  products=products.filter(x=>x.id!==id); saveProducts(); renderProducts(); toast('Produto excluído com sucesso.');
}
function renderStock(){
  const body=document.getElementById('stockBody'); if(!body)return;
  const q=(document.getElementById('stockSearch')?.value||'').toLowerCase();
  const tracked=products.filter(p=>isStockTracked(p)&&(!q||[p.code,p.name,p.category].join(' ').toLowerCase().includes(q)));
  body.innerHTML=tracked.map(p=>`<tr><td>${esc(p.code)}</td><td>${esc(p.name)}</td><td>${esc(p.unit)}</td><td>${Number(p.stock).toLocaleString('pt-BR')}</td><td>${Number(p.minStock).toLocaleString('pt-BR')}</td><td>${productStockBadge(p)}</td></tr>`).join('')||'<tr><td colspan="6" class="empty-table">Nenhum item de estoque encontrado.</td></tr>';
  const allTracked=products.filter(isStockTracked);
  const qty=allTracked.reduce((s,p)=>s+(Number(p.stock)||0),0); const value=allTracked.reduce((s,p)=>s+(Number(p.stock)||0)*(Number(p.cost)||0),0);
  const set=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val};
  set('stockTotalQty',qty.toLocaleString('pt-BR')); set('stockLowCount',allTracked.filter(isLowStock).length); set('stockTotalValue',moneyBR(value));
}
function renderDashboardLowStock(){
  const body=document.getElementById('dashboardLowStockBody'); if(!body)return;
  const lows=products.filter(isLowStock).sort((a,b)=>a.stock-b.stock).slice(0,5);
  body.innerHTML=lows.map(p=>`<tr><td>${esc(p.name)}</td><td><span class="status rejected">${Number(p.stock).toLocaleString('pt-BR')}</span></td><td>${Number(p.minStock).toLocaleString('pt-BR')}</td></tr>`).join('')||'<tr><td colspan="3" class="empty-table">Nenhum produto com estoque baixo.</td></tr>';
}

function renderDashboardLiveData(){
  const today=currentISODate();
  const paidSales=sales.filter(v=>v.status==='Pago');
  const paidToday=paidSales.filter(v=>String(v.date).slice(0,10)===today);
  const revenue=paidToday.reduce((sum,v)=>sum+Number(v.total||0),0);
  const expensesToday=(typeof expenses!=='undefined'?expenses:[]).filter(e=>e.status==='Pago'&&String(e.date).slice(0,10)===today).reduce((sum,e)=>sum+Number(e.value||0),0);
  const productCost=paidToday.reduce((sum,v)=>sum+(Array.isArray(v.items)?v.items:[]).reduce((ss,i)=>{
    const p=products.find(x=>x.id===i.productId);
    return ss + (p ? Number(p.cost||0)*Number(i.qty||0) : 0);
  },0),0);
  const profit=revenue-productCost-expensesToday;
  const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value;};
  set('dashSalesToday',paidToday.length.toLocaleString('pt-BR'));
  set('dashRevenueToday',moneyBR(revenue));
  set('dashProfitToday',moneyBR(profit));
  set('dashExpensesToday',moneyBR(expensesToday));
  set('dashQuotesPending',quotes.filter(q=>q.status==='Pendente').length.toLocaleString('pt-BR'));

  const recentBody=document.getElementById('dashboardRecentSalesBody');
  if(recentBody){
    const recent=[...sales].sort((a,b)=>String(b.createdAt||b.date||'').localeCompare(String(a.createdAt||a.date||''))).slice(0,5);
    recentBody.innerHTML=recent.map(v=>`<tr><td>${esc(v.num||'-')}</td><td>${esc(saleClientName(v))}</td><td>${moneyBR(v.total)}</td><td>${esc(v.payment||'-')}</td><td><span class="status ${saleStatusClass(v.status)}">${esc(v.status||'-')}</span></td></tr>`).join('')||'<tr><td colspan="5" class="empty-table">Nenhuma venda registrada.</td></tr>';
  }

  const chart=document.getElementById('dashboardSalesChart');
  if(chart){
    const days=[];
    for(let offset=6;offset>=0;offset--){
      const d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()-offset);
      const iso=d.toISOString().slice(0,10);
      const value=paidSales.filter(v=>String(v.date).slice(0,10)===iso).reduce((sum,v)=>sum+Number(v.total||0),0);
      days.push({iso,label:d.toLocaleDateString('pt-BR',{weekday:'short'}).replace('.',''),value});
    }
    const max=Math.max(0,...days.map(d=>d.value));
    chart.innerHTML=days.map(d=>`<div class="bar ${d.value===0?'zero':''}" style="height:${max?Math.max(5,(d.value/max)*88):5}%" title="${d.label}: ${moneyBR(d.value)}"><span>${esc(d.label)}</span></div>`).join('');
  }

  const paymentBox=document.getElementById('dashboardPaymentMethods');
  if(paymentBox){
    const totals={};
    paidSales.forEach(v=>{const key=String(v.payment||'Outro');totals[key]=(totals[key]||0)+Number(v.total||0);});
    const entries=Object.entries(totals).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
    const grand=entries.reduce((s,[,v])=>s+v,0);
    if(!entries.length||grand<=0){paymentBox.innerHTML='<div class="empty-note">Nenhuma venda paga registrada.</div>';}
    else{
      const palette=['#6a20ff','#16b9ec','#f50086','#ffd91a','#a6acc6','#16b86b','#ff7a00'];
      let cursor=0; const stops=[];
      entries.forEach(([,value],i)=>{const pct=value/grand*100;stops.push(`${palette[i%palette.length]} ${cursor}% ${cursor+pct}%`);cursor+=pct;});
      paymentBox.innerHTML=`<div class="donut dynamic" style="background:conic-gradient(${stops.join(',')})"><div class="donut-center"><b>${moneyBR(grand)}</b><span>Total</span></div></div><div class="legend">${entries.map(([name,value],i)=>{const pct=value/grand*100;return `<div><i class="dot" style="background:${palette[i%palette.length]}"></i><span>${esc(name)}</span><b>${pct.toLocaleString('pt-BR',{maximumFractionDigits:1})}%</b></div>`;}).join('')}</div>`;
    }
  }
}

window.openProductForm=openProductForm; window.editProduct=editProduct; window.deleteProduct=deleteProduct; window.go=go;
document.getElementById('newProductBtn')?.addEventListener('click',()=>openProductForm());
document.getElementById('closeProductBtn')?.addEventListener('click',closeProductForm);
document.getElementById('cancelProductBtn')?.addEventListener('click',closeProductForm);
document.getElementById('productSearch')?.addEventListener('input',renderProducts);
document.getElementById('productCategoryFilter')?.addEventListener('change',renderProducts);
document.getElementById('productStatusFilter')?.addEventListener('change',renderProducts);
document.getElementById('stockSearch')?.addEventListener('input',renderStock);
document.getElementById('productUnit')?.addEventListener('change',e=>{if(e.target.value==='SV'){document.getElementById('productStock').value=0;document.getElementById('productMinStock').value=0;}});
document.getElementById('productVariablePrice')?.addEventListener('change',syncProductPriceMode);
document.getElementById('productForm')?.addEventListener('submit',e=>{
  e.preventDefault();
  const id=document.getElementById('productEditId').value; const code=document.getElementById('productCode').value.trim()||nextProductCode();
  const name=document.getElementById('productName').value.trim(); const category=document.getElementById('productCategory').value.trim();
  if(!name||!category){toast('Informe o nome e a categoria do produto.');return;}
  if(products.some(p=>p.code.toLowerCase()===code.toLowerCase()&&p.id!==id)){toast('Já existe um produto com esse código.');return;}
  const variablePrice=document.getElementById('productVariablePrice').checked||!document.getElementById('productPrice').value.trim(); const item={id:id||('p'+Date.now()),code,name,category,description:document.getElementById('productDescription').value.trim(),unit:document.getElementById('productUnit').value,cost:parseMoneyBR(document.getElementById('productCost').value),price:variablePrice?0:parseMoneyBR(document.getElementById('productPrice').value),variablePrice,stock:Number(document.getElementById('productStock').value||0),minStock:Number(document.getElementById('productMinStock').value||0),supplier:document.getElementById('productSupplier').value.trim(),status:document.getElementById('productStatus').value};
  if(item.price<0||item.cost<0||item.stock<0||item.minStock<0){toast('Valores negativos não são permitidos.');return;}
  if(id){products=products.map(p=>p.id===id?item:p);}else{products.unshift(item);}
  saveProducts(); renderProducts(); closeProductForm(); toast(id?'Produto atualizado com sucesso.':'Produto cadastrado com sucesso.');
});
renderProducts();


// =====================================================
// V5 - CADASTRO FUNCIONAL DE CLIENTES
// =====================================================
const defaultClients=[];
let clients=JSON.parse(localStorage.getItem('mj_clients')||'null')||defaultClients;

function saveClients(){localStorage.setItem('mj_clients',JSON.stringify(clients));window.MJCloud?.pushKey('mj_clients',clients).catch(err=>console.error('[MJ Cloud] Clientes:',err));}
function onlyDigits(v){return String(v||'').replace(/\D/g,'');}
function formatCPF(v){
  const d=onlyDigits(v).slice(0,11);
  return d.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2');
}
function formatCNPJ(v){
  const d=onlyDigits(v).slice(0,14);
  return d.replace(/(\d{2})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1/$2').replace(/(\d{4})(\d{1,2})$/,'$1-$2');
}
function formatPhone(v){
  const d=onlyDigits(v).slice(0,11);
  if(d.length<=10)return d.replace(/(\d{2})(\d)/,'($1) $2').replace(/(\d{4})(\d{1,4})$/,'$1-$2');
  return d.replace(/(\d{2})(\d)/,'($1) $2').replace(/(\d{5})(\d{1,4})$/,'$1-$2');
}
function formatZip(v){return onlyDigits(v).slice(0,8).replace(/(\d{5})(\d{1,3})$/,'$1-$2');}
function validCPF(v){
  const d=onlyDigits(v); if(d.length!==11||/^(\d)\1{10}$/.test(d))return false;
  let sum=0; for(let i=0;i<9;i++)sum+=Number(d[i])*(10-i); let r=(sum*10)%11; if(r===10)r=0; if(r!==Number(d[9]))return false;
  sum=0; for(let i=0;i<10;i++)sum+=Number(d[i])*(11-i); r=(sum*10)%11; if(r===10)r=0; return r===Number(d[10]);
}
function validCNPJ(v){
  const d=onlyDigits(v); if(d.length!==14||/^(\d)\1{13}$/.test(d))return false;
  const calc=base=>{let size=base.length, pos=size-7, sum=0; for(let i=0;i<size;i++){sum+=Number(base[i])*pos--; if(pos<2)pos=9;} const r=sum%11; return r<2?0:11-r;};
  const d1=calc(d.slice(0,12)); const d2=calc(d.slice(0,12)+d1); return d.endsWith(String(d1)+String(d2));
}
function currentISODate(){return new Date().toISOString().slice(0,10);}
function clientDisplayName(c){return c.type==='PJ' && c.tradeName ? c.tradeName : c.name;}
function clientTypeLabel(t){return t==='PJ'?'Pessoa Jurídica':'Pessoa Física';}
function renderClientStats(){
  const set=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val};
  set('clientCount',clients.length);
  set('clientActiveCount',clients.filter(c=>c.status==='Ativo').length);
  set('clientPFCount',clients.filter(c=>c.type==='PF').length);
  set('clientPJCount',clients.filter(c=>c.type==='PJ').length);
}
function populateClientSelectors(){
  const active=clients.filter(c=>c.status==='Ativo').sort((a,b)=>clientDisplayName(a).localeCompare(clientDisplayName(b),'pt-BR'));
  const sale=document.getElementById('saleClient');
  if(sale){const current=sale.value;sale.innerHTML='<option value="">Cliente Balcão</option>'+active.map(c=>`<option value="${esc(c.id)}">${esc(clientDisplayName(c))} • ${esc(c.document)}</option>`).join('');if(active.some(c=>c.id===current))sale.value=current;}
  const list=document.getElementById('clientOptions');
  if(list)list.innerHTML=active.map(c=>`<option value="${esc(clientDisplayName(c))}">${esc(c.document)}</option>`).join('');
}
function renderClients(){
  const body=document.getElementById('clientsBody'); if(!body)return;
  const q=(document.getElementById('clientSearch')?.value||'').trim().toLowerCase();
  const type=document.getElementById('clientTypeFilter')?.value||'';
  const status=document.getElementById('clientStatusFilter')?.value||'';
  const rows=clients.filter(c=>{
    const hay=[c.name,c.tradeName,c.document,c.phone,c.whatsapp,c.email,c.city,c.state].join(' ').toLowerCase();
    return (!q||hay.includes(q))&&(!type||c.type===type)&&(!status||c.status===status);
  });
  body.innerHTML=rows.map(c=>`<tr>
    <td class="client-name-cell"><b>${esc(clientDisplayName(c))}</b><small>${c.type==='PJ'&&c.tradeName?esc(c.name):esc(c.email||'Sem e-mail')}</small></td>
    <td>${esc(c.document||'—')}</td>
    <td><div class="contact-cell"><span>${esc(c.whatsapp||c.phone||'—')}</span>${c.email?`<small>${esc(c.email)}</small>`:''}</div></td>
    <td>${esc([c.city,c.state].filter(Boolean).join('/')||'—')}</td>
    <td><span class="type-badge ${c.type==='PJ'?'pj':'pf'}">${c.type}</span></td>
    <td><span class="status ${c.status==='Ativo'?'paid':'expired'}">${esc(c.status)}</span></td>
    <td><div class="product-actions"><button class="action-btn" title="Visualizar" onclick="viewClient('${c.id}')">◉</button><button class="action-btn" title="Editar" onclick="editClient('${c.id}')">✎</button><button class="action-btn delete" title="Excluir" onclick="deleteClient('${c.id}')">🗑</button></div></td>
  </tr>`).join('')||'<tr><td colspan="7" class="empty-table">Nenhum cliente encontrado.</td></tr>';
  const rc=document.getElementById('clientResultCount'); if(rc)rc.textContent=`${rows.length} cliente(s)`;
  renderClientStats(); populateClientSelectors();
}
function updateClientTypeUI(){
  const type=document.getElementById('clientType')?.value||'PF';
  const label=document.getElementById('clientDocLabel'); const nameLabel=document.getElementById('clientNameLabel'); const doc=document.getElementById('clientDocument');
  if(label)label.textContent=type==='PJ'?'CNPJ *':'CPF *'; if(nameLabel)nameLabel.textContent=type==='PJ'?'Razão social *':'Nome completo *';
  if(doc){doc.placeholder=type==='PJ'?'00.000.000/0000-00':'000.000.000-00'; doc.value=type==='PJ'?formatCNPJ(doc.value):formatCPF(doc.value)}
  document.querySelectorAll('.pj-only').forEach(el=>el.style.display=type==='PJ'?'flex':'none');
}
function openClientForm(client=null){
  const panel=document.getElementById('clientFormPanel'); if(!panel)return;
  document.getElementById('clientForm').reset();
  document.getElementById('clientEditId').value=client?.id||'';
  document.getElementById('clientFormTitle').textContent=client?'Editar cliente':'Cadastrar cliente';
  document.getElementById('clientType').value=client?.type||'PF';
  document.getElementById('clientDocument').value=client?.document||'';
  document.getElementById('clientName').value=client?.name||'';
  document.getElementById('clientTradeName').value=client?.tradeName||'';
  document.getElementById('clientPhone').value=client?.phone||'';
  document.getElementById('clientWhatsapp').value=client?.whatsapp||'';
  document.getElementById('clientEmail').value=client?.email||'';
  document.getElementById('clientZip').value=client?.zip||'';
  document.getElementById('clientAddress').value=client?.address||'';
  document.getElementById('clientDistrict').value=client?.district||'';
  document.getElementById('clientCity').value=client?.city||'';
  document.getElementById('clientState').value=client?.state||'';
  document.getElementById('clientStatus').value=client?.status||'Ativo';
  document.getElementById('clientCreatedAt').value=client?.createdAt||currentISODate();
  document.getElementById('clientNotes').value=client?.notes||'';
  updateClientTypeUI(); panel.style.display='block'; setTimeout(()=>panel.scrollIntoView({behavior:'smooth',block:'start'}),30);
}
function closeClientForm(){const p=document.getElementById('clientFormPanel');if(p)p.style.display='none';}
function editClient(id){const c=clients.find(x=>x.id===id);if(c)openClientForm(c);}
function deleteClient(id){
  const c=clients.find(x=>x.id===id); if(!c)return;
  if(!confirm(`Excluir o cliente "${clientDisplayName(c)}"?`))return;
  clients=clients.filter(x=>x.id!==id); saveClients(); renderClients(); closeClientModal(); toast('Cliente excluído com sucesso.');
}
function viewClient(id){
  const c=clients.find(x=>x.id===id); if(!c)return;
  const modal=document.getElementById('clientModal'); const content=document.getElementById('clientModalContent'); if(!modal||!content)return;
  const relatedQuotes=quotes.filter(q=>q.cliente.trim().toLowerCase()===clientDisplayName(c).trim().toLowerCase()||q.cliente.trim().toLowerCase()===c.name.trim().toLowerCase());
  document.getElementById('clientModalTitle').textContent=clientDisplayName(c);
  document.getElementById('clientModalSubtitle').textContent=`${clientTypeLabel(c.type)} • cadastrado em ${brDate(c.createdAt)}`;
  const address=[c.address,c.district,[c.city,c.state].filter(Boolean).join('/')].filter(Boolean).join(' • ')||'Não informado';
  content.innerHTML=`
    <div class="client-detail-grid">
      <div><small>${c.type==='PJ'?'CNPJ':'CPF'}</small><b>${esc(c.document||'Não informado')}</b></div>
      <div><small>Status</small><b><span class="status ${c.status==='Ativo'?'paid':'expired'}">${esc(c.status)}</span></b></div>
      <div><small>Telefone</small><b>${esc(c.phone||'Não informado')}</b></div>
      <div><small>WhatsApp</small><b>${esc(c.whatsapp||'Não informado')}</b></div>
      <div><small>E-mail</small><b>${esc(c.email||'Não informado')}</b></div>
      <div><small>CEP</small><b>${esc(c.zip||'Não informado')}</b></div>
      <div class="wide"><small>Endereço</small><b>${esc(address)}</b></div>
      ${c.notes?`<div class="wide"><small>Observações</small><p>${esc(c.notes)}</p></div>`:''}
    </div>
    <div class="client-history-head"><div><h4>Histórico comercial</h4><small>Orçamentos já vinculados a este cliente</small></div><span class="history-count">${relatedQuotes.length} orçamento(s)</span></div>
    <div class="client-history-list">${relatedQuotes.length?relatedQuotes.map(q=>`<div class="history-item"><div><b>${esc(q.num)}</b><small>${esc(q.data)} • validade ${esc(q.validade)}</small></div><div><b>${esc(q.valor)}</b><span class="status ${statusClass(q.status)}">${esc(q.status)}</span></div></div>`).join(''):'<div class="history-empty">Nenhum orçamento vinculado a este cliente ainda.</div>'}</div>
    <div class="client-modal-actions"><button class="btn btn-line" type="button" onclick="editClient('${c.id}');closeClientModal()">Editar cadastro</button>${c.whatsapp?`<button class="btn btn-primary" type="button" onclick="openClientWhatsapp('${c.id}')">Abrir WhatsApp</button>`:''}</div>`;
  modal.classList.add('show'); modal.setAttribute('aria-hidden','false'); document.body.style.overflow='hidden';
}
function closeClientModal(){const m=document.getElementById('clientModal');if(!m)return;m.classList.remove('show');m.setAttribute('aria-hidden','true');document.body.style.overflow='';}
function openClientWhatsapp(id){
  const c=clients.find(x=>x.id===id); if(!c||!c.whatsapp)return;
  const num=onlyDigits(c.whatsapp); if(!num)return; window.open(`https://wa.me/55${num}`,'_blank','noopener');
}
window.openClientForm=openClientForm; window.editClient=editClient; window.deleteClient=deleteClient; window.viewClient=viewClient; window.closeClientModal=closeClientModal; window.openClientWhatsapp=openClientWhatsapp;

document.getElementById('newClientBtn')?.addEventListener('click',()=>openClientForm());
document.getElementById('closeClientBtn')?.addEventListener('click',closeClientForm);
document.getElementById('cancelClientBtn')?.addEventListener('click',closeClientForm);
document.getElementById('clientSearch')?.addEventListener('input',renderClients);
document.getElementById('clientTypeFilter')?.addEventListener('change',renderClients);
document.getElementById('clientStatusFilter')?.addEventListener('change',renderClients);
document.getElementById('clientType')?.addEventListener('change',updateClientTypeUI);
document.getElementById('clientDocument')?.addEventListener('input',e=>e.target.value=document.getElementById('clientType').value==='PJ'?formatCNPJ(e.target.value):formatCPF(e.target.value));
document.getElementById('clientPhone')?.addEventListener('input',e=>e.target.value=formatPhone(e.target.value));
document.getElementById('clientWhatsapp')?.addEventListener('input',e=>e.target.value=formatPhone(e.target.value));
document.getElementById('clientZip')?.addEventListener('input',e=>e.target.value=formatZip(e.target.value));
document.querySelectorAll('[data-close-client-modal]').forEach(el=>el.addEventListener('click',closeClientModal));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('clientModal')?.classList.contains('show'))closeClientModal();});
document.getElementById('clientForm')?.addEventListener('submit',e=>{
  e.preventDefault();
  const id=document.getElementById('clientEditId').value;
  const type=document.getElementById('clientType').value;
  const documentValue=document.getElementById('clientDocument').value.trim();
  const name=document.getElementById('clientName').value.trim();
  if(!name||!documentValue){toast(`Informe ${type==='PJ'?'a razão social e o CNPJ':'o nome e o CPF'} do cliente.`);return;}
  if(type==='PF'&&!validCPF(documentValue)){toast('Informe um CPF válido.');return;}
  if(type==='PJ'&&!validCNPJ(documentValue)){toast('Informe um CNPJ válido.');return;}
  const normalized=onlyDigits(documentValue);
  if(clients.some(c=>onlyDigits(c.document)===normalized&&c.id!==id)){toast('Já existe um cliente com esse CPF/CNPJ.');return;}
  const email=document.getElementById('clientEmail').value.trim();
  const item={id:id||('c'+Date.now()),type,document:type==='PJ'?formatCNPJ(documentValue):formatCPF(documentValue),name,tradeName:document.getElementById('clientTradeName').value.trim(),phone:formatPhone(document.getElementById('clientPhone').value),whatsapp:formatPhone(document.getElementById('clientWhatsapp').value),email,zip:formatZip(document.getElementById('clientZip').value),address:document.getElementById('clientAddress').value.trim(),district:document.getElementById('clientDistrict').value.trim(),city:document.getElementById('clientCity').value.trim(),state:document.getElementById('clientState').value,status:document.getElementById('clientStatus').value,createdAt:document.getElementById('clientCreatedAt').value||currentISODate(),notes:document.getElementById('clientNotes').value.trim()};
  if(id)clients=clients.map(c=>c.id===id?item:c); else clients.unshift(item);
  saveClients(); renderClients(); closeClientForm(); toast(id?'Cliente atualizado com sucesso.':'Cliente cadastrado com sucesso.');
});
renderClients();
initQuotes();

// V3 - navegação mobile e tabelas responsivas
(function(){
  const sidebar=document.getElementById('sidebar');
  const overlay=document.getElementById('sidebarOverlay');
  const menuBtn=document.getElementById('mobileMenuBtn');
  function setMenu(open){
    if(!sidebar||!overlay||!menuBtn)return;
    sidebar.classList.toggle('open',open);
    overlay.classList.toggle('show',open);
    menuBtn.setAttribute('aria-expanded',String(open));
    document.body.style.overflow=open?'hidden':'';
  }
  menuBtn?.addEventListener('click',()=>setMenu(!sidebar.classList.contains('open')));
  overlay?.addEventListener('click',()=>setMenu(false));
  document.querySelectorAll('#nav button').forEach(btn=>btn.addEventListener('click',()=>{
    if(window.innerWidth<=860)setMenu(false);
  }));
  window.addEventListener('resize',()=>{
    if(window.innerWidth>860)setMenu(false);
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape')setMenu(false)});

  document.querySelectorAll('table.data-table').forEach(table=>{
    // As tabelas do Dashboard devem se adaptar ao card e nunca criar barra horizontal.
    if(table.closest('#dashboard')) return;
    if(table.parentElement?.classList.contains('table-scroll'))return;
    const wrap=document.createElement('div');
    wrap.className='table-scroll';
    table.parentNode.insertBefore(wrap,table);
    wrap.appendChild(table);
  });
})();


// =====================================================
// V7 - VENDAS FUNCIONAIS
// =====================================================
const defaultSales=[];
let sales=JSON.parse(localStorage.getItem('mj_sales')||'null')||defaultSales;
if(!Array.isArray(sales)) sales=[];
sales=sales.filter(Boolean).map((s,index)=>({
  ...s,
  id:String(s.id||`sale-${Date.now()}-${index}`),
  num:String(s.num||''),
  date:String(s.date||currentISODate()).slice(0,10),
  clientId:String(s.clientId||''),
  clientName:String(s.clientName||''),
  seller:String(s.seller||''),
  items:Array.isArray(s.items)?s.items:[],
  subtotal:Number(s.subtotal||0),
  discount:Number(s.discount||0),
  total:Number(s.total||0),
  payment:String(s.payment||'Outro'),
  status:String(s.status||'Pendente')
}));


/* =====================================================
   V9 — INFINITEPAY
   Checkout Integrado: configuração, geração e retorno
   ===================================================== */
const IP_CONFIG_KEY='mj_infinitepay_config';
const IP_TX_KEY='mj_infinitepay_transactions';
let infinitePayConfig=JSON.parse(localStorage.getItem(IP_CONFIG_KEY)||'null')||{enabled:false,handle:'',redirectUrl:'',webhookUrl:''};
let infinitePayTransactions=JSON.parse(localStorage.getItem(IP_TX_KEY)||'null')||[];
function saveInfinitePayConfig(){localStorage.setItem(IP_CONFIG_KEY,JSON.stringify(infinitePayConfig));window.MJCloud?.pushKey('mj_infinitepay_config',infinitePayConfig).catch(err=>console.error('[MJ Cloud] InfinitePay config:',err));}
function saveInfinitePayTransactions(){localStorage.setItem(IP_TX_KEY,JSON.stringify(infinitePayTransactions));window.MJCloud?.pushKey('mj_infinitepay_transactions',infinitePayTransactions).catch(err=>console.error('[MJ Cloud] InfinitePay transações:',err));}
function cleanHandle(v){return String(v||'').trim().replace(/^\$/,'').replace(/\s+/g,'');}
function isHttpUrl(v){try{const u=new URL(v);return u.protocol==='https:'||u.protocol==='http:';}catch{return false;}}
function currentPublicUrl(){return /^https?:$/.test(location.protocol)?`${location.origin}${location.pathname}`:'';}
function ipMethodLabel(v){return v==='pix'?'PIX':v==='credit_card'?'Cartão de crédito':v||'-';}
function ipStatusClass(status){return status==='Pago'?'paid':status==='Aguardando pagamento'||status==='Checkout gerado'||status==='Retorno recebido'||status==='Verificando'||status==='Gerando checkout'?'pending':status==='Cancelado'?'rejected':'expired';}
function getInfinitePayTxBySale(saleId){return infinitePayTransactions.find(t=>t.saleId===saleId);}
function upsertInfinitePayTx(data){const i=infinitePayTransactions.findIndex(t=>t.saleId===data.saleId);const old=i>=0?infinitePayTransactions[i]:{};const item={...old,...data,updatedAt:new Date().toISOString(),createdAt:old.createdAt||data.createdAt||new Date().toISOString()};if(i>=0)infinitePayTransactions[i]=item;else infinitePayTransactions.unshift(item);saveInfinitePayTransactions();renderInfinitePayTransactions();return item;}
function clientInfinitePayData(sale){const c=sale.clientId?clients.find(x=>x.id===sale.clientId):null;if(!c)return null;const phone=onlyDigits(c.whatsapp||c.phone||'');const formattedPhone=phone?`+55${phone.startsWith('55')?phone.slice(2):phone}`:'';const customer={name:clientDisplayName(c)};if(c.email)customer.email=c.email;if(formattedPhone.length>=12)customer.phone_number=formattedPhone;return customer;}
function infinitePayPayload(sale){const cfg=infinitePayConfig;const payload={handle:cleanHandle(cfg.handle),order_nsu:sale.num,items:[{quantity:1,price:Math.max(0,Math.round(Number(sale.total)*100)),description:`Venda ${sale.num} - ${saleClientName(sale)}`}]};const redirect=String(cfg.redirectUrl||'').trim()||currentPublicUrl();if(isHttpUrl(redirect))payload.redirect_url=redirect;const webhook=String(cfg.webhookUrl||'').trim();if(isHttpUrl(webhook))payload.webhook_url=webhook;const customer=clientInfinitePayData(sale);if(customer)payload.customer=customer;return payload;}
async function ipFetchJson(url,payload){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);try{const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});let data={};try{data=await response.json();}catch{}if(!response.ok)throw new Error(data?.message||data?.error||`HTTP ${response.status}`);return data;}finally{clearTimeout(timer);}}
function infinitePayConfigReady(){return infinitePayConfig.enabled&&cleanHandle(infinitePayConfig.handle).length>1;}
async function createInfinitePayCheckoutForSale(saleId,redirectToCheckout=true){const sale=sales.find(s=>s.id===saleId);if(!sale){toast('Venda não encontrada.');return null;}if(!infinitePayConfigReady()){toast('Configure e ative a InfinitePay antes de gerar a cobrança.');go('configuracoes');return null;}const payload=infinitePayPayload(sale);upsertInfinitePayTx({saleId:sale.id,saleNum:sale.num,orderNsu:sale.num,value:sale.total,status:'Gerando checkout',method:'-',checkoutUrl:sale.infinitePay?.checkoutUrl||''});try{const data=await ipFetchJson('https://api.checkout.infinitepay.io/links',payload);if(!data?.url)throw new Error('A InfinitePay não retornou a URL do checkout.');sale.infinitePay={...(sale.infinitePay||{}),orderNsu:sale.num,checkoutUrl:data.url,status:'Aguardando pagamento',requestedAt:new Date().toISOString()};saveSales();upsertInfinitePayTx({saleId:sale.id,saleNum:sale.num,orderNsu:sale.num,value:sale.total,status:'Aguardando pagamento',checkoutUrl:data.url,method:'-'});renderSales();if(redirectToCheckout){toast('Checkout gerado. Redirecionando para a InfinitePay...');setTimeout(()=>{location.href=data.url;},350);}return data.url;}catch(err){sale.infinitePay={...(sale.infinitePay||{}),orderNsu:sale.num,status:'Erro ao gerar checkout',error:String(err.message||err)};saveSales();upsertInfinitePayTx({saleId:sale.id,saleNum:sale.num,orderNsu:sale.num,value:sale.total,status:'Erro',error:String(err.message||err)});renderSales();toast(`Não foi possível gerar o checkout: ${err.message||err}`);return null;}}
async function verifyInfinitePayPayment(saleId,override={}){const sale=sales.find(s=>s.id===saleId);if(!sale){toast('Venda não encontrada.');return false;}if(!infinitePayConfigReady()){toast('Configure a InfinitePay para verificar o pagamento.');return false;}const tx=getInfinitePayTxBySale(saleId)||{};const orderNsu=override.orderNsu||tx.orderNsu||sale.num;const transactionNsu=override.transactionNsu||tx.transactionNsu||sale.infinitePay?.transactionNsu;const slug=override.slug||tx.slug||sale.infinitePay?.slug;if(!transactionNsu||!slug){toast('A transação ainda não retornou NSU e slug para verificação.');return false;}upsertInfinitePayTx({saleId:sale.id,saleNum:sale.num,orderNsu,value:sale.total,status:'Verificando',transactionNsu,slug,receiptUrl:override.receiptUrl||tx.receiptUrl||'',method:override.captureMethod||tx.method||'-'});try{const result=await ipFetchJson('https://api.checkout.infinitepay.io/payment_check',{handle:cleanHandle(infinitePayConfig.handle),order_nsu:orderNsu,transaction_nsu:transactionNsu,slug});if(!result?.success||!result?.paid){upsertInfinitePayTx({saleId:sale.id,saleNum:sale.num,orderNsu,value:sale.total,status:'Aguardando pagamento',transactionNsu,slug,method:result?.capture_method||override.captureMethod||'-'});toast('Pagamento ainda não confirmado pela InfinitePay.');return false;}const expected=Math.round(Number(sale.total)*100),received=Number(result.amount);if(Number.isFinite(received)&&received!==expected){upsertInfinitePayTx({saleId:sale.id,saleNum:sale.num,orderNsu,value:sale.total,status:'Divergência de valor',transactionNsu,slug,method:result.capture_method||override.captureMethod||'-',receivedAmount:received});toast('Pagamento localizado, mas o valor não confere com a venda.');return false;}sale.status='Pago';sale.payment='InfinitePay';sale.infinitePay={...(sale.infinitePay||{}),orderNsu,transactionNsu,slug,receiptUrl:override.receiptUrl||tx.receiptUrl||'',captureMethod:result.capture_method||override.captureMethod||'',installments:result.installments||1,paidAt:new Date().toISOString(),status:'Pago'};saveSales();const ft=financialTransactions.find(t=>t.source==='Venda'&&t.sourceId===sale.id);if(ft){ft.status='Pago';ft.payment='InfinitePay';ft.paidAt=currentISODate();saveFinancial();}upsertInfinitePayTx({saleId:sale.id,saleNum:sale.num,orderNsu,value:sale.total,status:'Pago',transactionNsu,slug,receiptUrl:sale.infinitePay.receiptUrl,method:result.capture_method||override.captureMethod||'-',installments:result.installments||1,paidAmount:result.paid_amount});renderSales();renderFinance();toast(`${sale.num} confirmada como paga pela InfinitePay.`);return true;}catch(err){upsertInfinitePayTx({saleId:sale.id,saleNum:sale.num,orderNsu,value:sale.total,status:'Erro na verificação',transactionNsu,slug,error:String(err.message||err)});toast(`Falha ao verificar pagamento: ${err.message||err}`);return false;}}
function openInfinitePayCheckout(saleId){const sale=sales.find(s=>s.id===saleId);const url=sale?.infinitePay?.checkoutUrl||getInfinitePayTxBySale(saleId)?.checkoutUrl;if(url){window.open(url,'_blank','noopener');return;}createInfinitePayCheckoutForSale(saleId,true);}
function openInfinitePayReceipt(saleId){const sale=sales.find(s=>s.id===saleId);const url=sale?.infinitePay?.receiptUrl||getInfinitePayTxBySale(saleId)?.receiptUrl;if(url)window.open(url,'_blank','noopener');else toast('Comprovante ainda não disponível.');}
function infinitePayRowActions(s){if(s.payment!=='InfinitePay')return '';const tx=getInfinitePayTxBySale(s.id);if(s.status==='Pago')return (s.infinitePay?.receiptUrl||tx?.receiptUrl)?`<button class="table-action success" onclick="openInfinitePayReceipt('${s.id}')">Comprovante</button>`:'';return `${s.infinitePay?.checkoutUrl||tx?.checkoutUrl?`<button class="table-action" onclick="openInfinitePayCheckout('${s.id}')">Checkout</button>`:`<button class="table-action" onclick="createInfinitePayCheckoutForSale('${s.id}',true)">Gerar cobrança</button>`}<button class="table-action success" onclick="verifyInfinitePayPayment('${s.id}')">Verificar</button>`;}
function renderInfinitePayTransactions(){const body=document.getElementById('ipTransactionsBody');if(!body)return;const list=[...infinitePayTransactions].sort((a,b)=>String(b.updatedAt||b.createdAt).localeCompare(String(a.updatedAt||a.createdAt)));body.innerHTML=list.map(t=>{const sale=sales.find(s=>s.id===t.saleId);return `<tr><td><b>${esc(t.saleNum||sale?.num||'-')}</b><span class="ip-order-meta">${esc(t.orderNsu||'')}</span></td><td>${new Date(t.createdAt||Date.now()).toLocaleDateString('pt-BR')}</td><td><b>${moneyBR(t.value||sale?.total||0)}</b></td><td>${esc(ipMethodLabel(t.method))}</td><td><span class="status ${ipStatusClass(t.status)}">${esc(t.status||'-')}</span></td><td><span class="ip-order-meta">${esc(t.transactionNsu||'-')}</span></td><td><div class="quote-actions">${t.checkoutUrl&&t.status!=='Pago'?`<button class="table-action" onclick="openInfinitePayCheckout('${t.saleId}')">Abrir</button>`:''}${t.status!=='Pago'?`<button class="table-action success" onclick="verifyInfinitePayPayment('${t.saleId}')">Verificar</button>`:''}${t.receiptUrl?`<button class="table-action" onclick="openInfinitePayReceipt('${t.saleId}')">Recibo</button>`:''}</div></td></tr>`}).join('')||'<tr><td colspan="7"><div class="empty-note">Nenhuma cobrança InfinitePay gerada.</div></td></tr>';document.getElementById('ipTransactionCount').textContent=`${list.length} transação(ões)`;}
function populateInfinitePayConfig(){const h=document.getElementById('ipHandle');if(!h)return;h.value=infinitePayConfig.handle||'';document.getElementById('ipEnabled').value=infinitePayConfig.enabled?'true':'false';document.getElementById('ipRedirectUrl').value=infinitePayConfig.redirectUrl||currentPublicUrl();document.getElementById('ipWebhookUrl').value=infinitePayConfig.webhookUrl||'';renderInfinitePayConfigStatus();renderInfinitePayTransactions();}
function renderInfinitePayConfigStatus(){const pill=document.getElementById('ipConfigStatus'),sw=document.getElementById('ipSwitch');if(!pill||!sw)return;const ready=infinitePayConfigReady();pill.textContent=ready?'Ativa e configurada':infinitePayConfig.enabled?'Handle pendente':'Desativada';pill.className=`ip-status-pill ${ready?'on':infinitePayConfig.enabled?'warn':'off'}`;sw.classList.toggle('on',!!infinitePayConfig.enabled);}
function readInfinitePayConfigForm(){return{enabled:document.getElementById('ipEnabled').value==='true',handle:cleanHandle(document.getElementById('ipHandle').value),redirectUrl:document.getElementById('ipRedirectUrl').value.trim(),webhookUrl:document.getElementById('ipWebhookUrl').value.trim()};}
function syncInfinitePaySaleFields(){const payment=document.getElementById('salePayment'),status=document.getElementById('saleStatus'),notice=document.getElementById('infinitePaySaleNotice'),btn=document.getElementById('finishSaleBtn');if(!payment||!status)return;const isIP=payment.value==='InfinitePay';notice.hidden=!isIP;status.disabled=isIP;if(isIP)status.value='Pendente';if(btn)btn.textContent=isIP?'∞ Gerar cobrança':'✓ Finalizar venda';}
function showIpReturnBanner(text){const d=document.createElement('div');d.className='ip-return-banner';d.innerHTML=`<div class="ip-mini-logo">∞</div><div><b>InfinitePay</b><span>${esc(text)}</span></div>`;document.body.appendChild(d);setTimeout(()=>d.remove(),7000);}
async function handleInfinitePayReturn(){const params=new URLSearchParams(location.search);const orderNsu=params.get('order_nsu');const transactionNsu=params.get('transaction_nsu');const slug=params.get('slug');if(!orderNsu||!transactionNsu||!slug)return;const sale=sales.find(s=>s.num===orderNsu);if(!sale){showIpReturnBanner(`Retorno recebido para ${orderNsu}, mas a venda não foi encontrada neste navegador.`);return;}const receiptUrl=params.get('receipt_url')||'',captureMethod=params.get('capture_method')||'';upsertInfinitePayTx({saleId:sale.id,saleNum:sale.num,orderNsu,value:sale.total,status:'Retorno recebido',transactionNsu,slug,receiptUrl,method:captureMethod});sale.infinitePay={...(sale.infinitePay||{}),orderNsu,transactionNsu,slug,receiptUrl,captureMethod,status:'Retorno recebido'};saveSales();showIpReturnBanner(`Retorno da ${sale.num} recebido. Confirmando o pagamento...`);await verifyInfinitePayPayment(sale.id,{orderNsu,transactionNsu,slug,receiptUrl,captureMethod});if(/^https?:$/.test(location.protocol)){const clean=`${location.origin}${location.pathname}${location.hash||''}`;history.replaceState({},document.title,clean);}}
function initInfinitePayV9(){populateInfinitePayConfig();document.getElementById('saveInfinitePayConfigBtn')?.addEventListener('click',()=>{const cfg=readInfinitePayConfigForm();if(cfg.enabled&&!cfg.handle){toast('Informe a InfiniteTag / Handle.');return;}if(cfg.redirectUrl&&!isHttpUrl(cfg.redirectUrl)){toast('A URL de retorno precisa começar com http:// ou https://');return;}if(cfg.webhookUrl&&!isHttpUrl(cfg.webhookUrl)){toast('A URL do webhook precisa começar com http:// ou https://');return;}infinitePayConfig=cfg;saveInfinitePayConfig();renderInfinitePayConfigStatus();toast('Configurações da InfinitePay salvas.');});document.getElementById('validateInfinitePayBtn')?.addEventListener('click',()=>{const cfg=readInfinitePayConfigForm();if(!cfg.handle){toast('Informe a InfiniteTag / Handle.');return;}if(cfg.redirectUrl&&!isHttpUrl(cfg.redirectUrl)){toast('URL de retorno inválida.');return;}toast('Configuração válida para gerar checkout.');});document.getElementById('openInfinitePayDocsBtn')?.addEventListener('click',()=>window.open('https://www.infinitepay.io/checkout-documentacao','_blank','noopener'));document.getElementById('ipSwitch')?.addEventListener('click',()=>{const sel=document.getElementById('ipEnabled');sel.value=sel.value==='true'?'false':'true';infinitePayConfig={...infinitePayConfig,...readInfinitePayConfigForm()};saveInfinitePayConfig();renderInfinitePayConfigStatus();});document.getElementById('ipEnabled')?.addEventListener('change',()=>{infinitePayConfig={...infinitePayConfig,...readInfinitePayConfigForm()};renderInfinitePayConfigStatus();});document.getElementById('salePayment')?.addEventListener('change',syncInfinitePaySaleFields);syncInfinitePaySaleFields();renderInfinitePayTransactions();handleInfinitePayReturn();}
window.createInfinitePayCheckoutForSale=createInfinitePayCheckoutForSale;window.verifyInfinitePayPayment=verifyInfinitePayPayment;window.openInfinitePayCheckout=openInfinitePayCheckout;window.openInfinitePayReceipt=openInfinitePayReceipt;

let financialTransactions=JSON.parse(localStorage.getItem('mj_financial_transactions')||'null')||[];
let saleItemsDraft=[];
let saleSourceQuoteId='';
function saveSales(){localStorage.setItem('mj_sales',JSON.stringify(sales));window.MJCloud?.pushKey('mj_sales',sales).catch(err=>console.error('[MJ Cloud] Vendas:',err));}
function saveFinancial(){localStorage.setItem('mj_financial_transactions',JSON.stringify(financialTransactions));window.MJCloud?.pushKey('mj_financial_transactions',financialTransactions).catch(err=>console.error('[MJ Cloud] Financeiro:',err));}
function nextSaleNumber(){const nums=sales.map(s=>parseInt(String(s.num||'').replace(/\D/g,''),10)).filter(Number.isFinite);return `VEN-${String((nums.length?Math.max(...nums):0)+1).padStart(5,'0')}`;}
function saleClientName(s){const c=s.clientId?clients.find(x=>x.id===s.clientId):null;return c?clientDisplayName(c):(s.clientName||'Cliente Balcão');}
function saleStatusClass(s){return s==='Pago'?'paid':s==='Pendente'?'pending':'rejected';}
function populateSaleClients(){const el=document.getElementById('saleClient');if(!el)return;const cur=el.value;el.innerHTML='<option value="">Cliente Balcão</option>'+clients.filter(c=>c.status==='Ativo').map(c=>`<option value="${c.id}">${esc(clientDisplayName(c))} — ${esc(c.document)}</option>`).join('');el.value=cur;}
function populateSaleProducts(){const el=document.getElementById('saleProductSelect');if(!el)return;el.innerHTML='<option value="">Selecione...</option>'+products.filter(p=>p.status==='Ativo').map(p=>`<option value="${p.id}">${esc(p.code)} — ${esc(p.name)}${isVariablePriceProduct(p)?' • Preço variável':''}${p.category!=='Serviços'?` (Estoque: ${Number(p.stock).toLocaleString('pt-BR')})`:''}</option>`).join('');}
function saleCalc(){const subtotal=saleItemsDraft.reduce((s,i)=>s+Number(i.qty)*Number(i.unitPrice),0);const discount=Math.min(parseMoneyBR(document.getElementById('saleDiscount')?.value||0),subtotal);const total=Math.max(0,subtotal-discount);document.getElementById('saleSubtotal').textContent=moneyBR(subtotal);document.getElementById('saleTotal').textContent=moneyBR(total);return{subtotal,discount,total};}
function renderSaleDraft(){const body=document.getElementById('saleItemsBody');if(!body)return;body.innerHTML=saleItemsDraft.map(i=>`<tr><td><b>${esc(i.name)}</b>${i.code?`<span class="quote-item-code">${esc(i.code)}</span>`:''}</td><td><input class="quote-table-input qty" type="number" min="0.01" step="0.01" value="${i.qty}" onchange="updateSaleItem('${i.id}','qty',this.value)"></td><td><input class="quote-table-input price" value="${Number(i.unitPrice).toLocaleString('pt-BR',{minimumFractionDigits:2})}" onchange="updateSaleItem('${i.id}','price',this.value)"></td><td><b>${moneyBR(Number(i.qty)*Number(i.unitPrice))}</b></td><td><button class="table-action danger" onclick="removeSaleItem('${i.id}')">×</button></td></tr>`).join('');document.getElementById('saleEmptyItems').style.display=saleItemsDraft.length?'none':'block';saleCalc();}
function addSaleItem(){const pid=document.getElementById('saleProductSelect').value;const p=products.find(x=>x.id===pid);if(!p){toast('Selecione um produto ou serviço.');return;}const qty=Number(document.getElementById('saleItemQty').value||0);const priceInput=document.getElementById('saleItemPrice');const rawPrice=String(priceInput.value||'').trim();if(isVariablePriceProduct(p)&&!rawPrice){toast('Informe o valor unitário deste item. O produto está com preço variável.');priceInput.focus();return;}const price=parseMoneyBR(rawPrice||p.price);if(qty<=0){toast('Informe uma quantidade válida.');return;}if(price<0){toast('Informe um valor válido.');return;}const existing=saleItemsDraft.find(i=>i.productId===pid&&Number(i.unitPrice)===price);if(existing)existing.qty=Number(existing.qty)+qty;else saleItemsDraft.push({id:'si'+Date.now(),productId:p.id,code:p.code,name:p.name,qty,unitPrice:price});document.getElementById('saleProductSelect').value='';document.getElementById('saleItemQty').value='1';document.getElementById('saleItemPrice').value='';renderSaleDraft();}
function updateSaleItem(id,field,value){const i=saleItemsDraft.find(x=>x.id===id);if(!i)return;if(field==='qty')i.qty=Math.max(.01,Number(value)||.01);if(field==='price')i.unitPrice=Math.max(0,parseMoneyBR(value));renderSaleDraft();}
function removeSaleItem(id){saleItemsDraft=saleItemsDraft.filter(i=>i.id!==id);renderSaleDraft();}
function clearSaleForm(confirmClear=false){if(confirmClear&&(saleItemsDraft.length||saleSourceQuoteId)&&!confirm('Limpar a venda atual e remover o vínculo com o orçamento?'))return;saleItemsDraft=[];saleSourceQuoteId='';localStorage.removeItem('mj_sale_draft');populateSaleClients();const set=(id,value)=>{const el=document.getElementById(id);if(el)el.value=value;};set('saleClient','');set('saleDate',currentISODate());set('saleSeller','Caio');set('saleDiscount','0,00');set('salePayment','PIX');set('saleStatus','Pago');set('saleObs','');set('saleProductSelect','');set('saleItemQty','1');set('saleItemPrice','');const banner=document.getElementById('saleSourceBanner');if(banner){banner.hidden=true;banner.style.display='none';banner.innerHTML='';}const preview=document.getElementById('saleNumberPreview');if(preview)preview.textContent=nextSaleNumber();renderSaleDraft();if(typeof syncInfinitePaySaleFields==='function')syncInfinitePaySaleFields();if(confirmClear)toast('Venda limpa. Você pode iniciar uma venda direta.');}
function loadSaleDraft(){const raw=localStorage.getItem('mj_sale_draft');if(!raw)return false;try{const d=JSON.parse(raw);saleSourceQuoteId=d.sourceQuoteId||'';saleItemsDraft=(d.items||[]).map((i,n)=>({id:'sd'+Date.now()+n,productId:i.productId||'',code:products.find(p=>p.id===i.productId)?.code||'',name:i.name||'Item',qty:Number(i.qty||1),unitPrice:Number(i.unitPrice||0)}));populateSaleClients();document.getElementById('saleClient').value=d.clientId||'';document.getElementById('saleDiscount').value=Number(d.discount||0).toLocaleString('pt-BR',{minimumFractionDigits:2});document.getElementById('saleObs').value=d.obs||'';const b=document.getElementById('saleSourceBanner');b.innerHTML=`<b>Venda originada do orçamento ${esc(d.sourceQuoteNumber||'')}</b><span>Cliente e itens foram carregados automaticamente.</span>`;b.hidden=false;b.style.display='';renderSaleDraft();return true;}catch(e){return false;}}
function validateSaleStock(){for(const i of saleItemsDraft){if(!i.productId)continue;const p=products.find(x=>x.id===i.productId);if(!p||p.category==='Serviços'||Number(p.minStock)===0&&Number(p.stock)===0)continue;if(Number(i.qty)>Number(p.stock))return `Estoque insuficiente para ${p.name}. Disponível: ${Number(p.stock).toLocaleString('pt-BR')}.`;}return '';}
async function finishSale(){
 if(!saleItemsDraft.length){toast('Adicione pelo menos um item à venda.');return;}
 const stockError=validateSaleStock();if(stockError){toast(stockError);return;}
 const calc=saleCalc();if(calc.total<=0&&!confirm('O total da venda é R$ 0,00. Deseja continuar?'))return;
 const num=nextSaleNumber(),payment=document.getElementById('salePayment').value,isIP=payment==='InfinitePay';
 if(isIP&&!infinitePayConfigReady()){toast('Configure a InfinitePay antes de gerar a cobrança.');go('configuracoes');return;}
 const status=isIP?'Pendente':document.getElementById('saleStatus').value;
 const sale={id:'s'+Date.now(),num,date:document.getElementById('saleDate').value||currentISODate(),clientId:document.getElementById('saleClient').value,clientName:document.getElementById('saleClient').value?'':'Cliente Balcão',seller:document.getElementById('saleSeller').value.trim(),items:saleItemsDraft.map(i=>({...i})),subtotal:calc.subtotal,discount:calc.discount,total:calc.total,payment,status,obs:document.getElementById('saleObs').value.trim(),sourceQuoteId:saleSourceQuoteId,createdAt:new Date().toISOString()};
 sale.items.forEach(i=>{const p=products.find(x=>x.id===i.productId);if(p&&p.category!=='Serviços'&&!(Number(p.minStock)===0&&Number(p.stock)===0))p.stock=Math.max(0,Number(p.stock)-Number(i.qty));});saveProducts();
 sales.unshift(sale);saveSales();
 financialTransactions.unshift({id:'ft'+Date.now(),type:'Entrada',source:'Venda',sourceId:sale.id,description:`Venda ${num} - ${saleClientName(sale)}`,category:'Vendas',date:sale.date,dueDate:sale.date,value:sale.total,payment,status:status==='Pago'?'Pago':'Pendente',notes:isIP?'Aguardando confirmação da InfinitePay.':'Lançamento gerado automaticamente pela venda.'});saveFinancial();
 if(saleSourceQuoteId){const q=quotes.find(x=>x.id===saleSourceQuoteId);if(q){q.status='Convertido';q.saleId=sale.id;saveQuotes();renderQuotes();}}
 localStorage.removeItem('mj_sale_draft');renderSales();renderProducts();renderStock();renderFinancialSummary();clearSaleForm(false);
 if(isIP){toast(`${num} criada. Gerando checkout InfinitePay...`);await createInfinitePayCheckoutForSale(sale.id,true);return;}
 toast(`${num} finalizada com sucesso.`);go('vendas');
}
function renderSaleStats(){const paid=sales.filter(s=>s.status==='Pago');const pending=sales.filter(s=>s.status==='Pendente');document.getElementById('saleCount').textContent=sales.length;document.getElementById('salePaidCount').textContent=paid.length;document.getElementById('saleRevenue').textContent=moneyBR(paid.reduce((a,s)=>a+Number(s.total),0));document.getElementById('salePendingValue').textContent=moneyBR(pending.reduce((a,s)=>a+Number(s.total),0));}
function renderSales(){const body=document.getElementById('salesBody');if(!body)return;const q=(document.getElementById('saleSearch')?.value||'').toLowerCase();const sf=document.getElementById('saleStatusFilter')?.value||'';const df=document.getElementById('saleDateFilter')?.value||'';const list=sales.filter(s=>{const num=String(s?.num||'').toLowerCase(),client=String(saleClientName(s)||'').toLowerCase(),status=String(s?.status||''),date=String(s?.date||'').slice(0,10);return(!q||num.includes(q)||client.includes(q))&&(!sf||status===sf)&&(!df||date===df);});body.innerHTML=list.length?list.map(s=>`<tr><td><b>${esc(s.num)}</b>${s.sourceQuoteId?'<span class="quote-item-code">via orçamento</span>':''}${s.payment==='InfinitePay'?'<span class="ip-checkout-badge">InfinitePay</span>':''}</td><td>${brDate(s.date)}</td><td>${esc(saleClientName(s))}</td><td><b>${moneyBR(s.total)}</b></td><td>${esc(s.payment)}</td><td><span class="status ${saleStatusClass(s.status)}">${esc(s.status)}</span></td><td><div class="sale-row-actions"><button type="button" class="table-action" data-sale-action="view" data-sale-id="${s.id}"><span class="action-icon">◉</span> Ver</button><button type="button" class="table-action" data-sale-action="print" data-sale-id="${s.id}"><span class="action-icon">▣</span> Imprimir</button>${infinitePayRowActions(s)}${s.status!=='Cancelado'?`<button type="button" class="table-action danger" data-sale-action="cancel" data-sale-id="${s.id}"><span class="action-icon">✕</span> Cancelar</button>`:''}</div></td></tr>`).join(''):'<tr><td colspan="7"><div class="empty-note">Nenhuma venda encontrada.</div></td></tr>';document.getElementById('saleResultCount').textContent=`${list.length} resultado${list.length===1?'':'s'}`;renderSaleStats();renderFinancialSummary();renderInfinitePayTransactions();}
function saleDetailHTML(s){const ip=s.infinitePay||{};return `<div class="quote-detail-head"><div><small>Cliente</small><h4>${esc(saleClientName(s))}</h4><p>Vendedor: ${esc(s.seller||'-')}</p></div><span class="status ${saleStatusClass(s.status)}">${esc(s.status)}</span></div><div class="quote-detail-meta"><div><small>Data</small><b>${brDate(s.date)}</b></div><div><small>Pagamento</small><b>${esc(s.payment)}</b></div><div><small>Origem</small><b>${s.sourceQuoteId?'Orçamento convertido':'Venda direta'}</b></div>${s.payment==='InfinitePay'?`<div><small>Order NSU</small><b>${esc(ip.orderNsu||s.num)}</b></div><div><small>Transaction NSU</small><b>${esc(ip.transactionNsu||'Aguardando')}</b></div><div><small>Método InfinitePay</small><b>${esc(ipMethodLabel(ip.captureMethod))}</b></div>`:''}</div><div class="table-scroll"><table class="data-table"><thead><tr><th>Item</th><th>Qtd.</th><th>Unitário</th><th>Subtotal</th></tr></thead><tbody>${(Array.isArray(s.items)?s.items:[]).map(i=>`<tr><td>${esc(i.name)}</td><td>${Number(i.qty).toLocaleString('pt-BR')}</td><td>${moneyBR(i.unitPrice)}</td><td><b>${moneyBR(Number(i.qty)*Number(i.unitPrice))}</b></td></tr>`).join('')}</tbody></table></div><div class="quote-detail-footer"><div class="quote-detail-obs"><small>Observação</small><p>${esc(s.obs||'Sem observações.')}</p></div><div class="quote-totals compact"><div class="summary-row"><span>Subtotal</span><b>${moneyBR(s.subtotal)}</b></div><div class="summary-row"><span>Desconto</span><b>${moneyBR(s.discount)}</b></div><div class="summary-row total"><span>Total</span><span>${moneyBR(s.total)}</span></div></div></div><div class="client-modal-actions"><button class="btn btn-line" onclick="printSale('${s.id}')">Imprimir</button>${s.payment==='InfinitePay'&&s.status!=='Pago'?`<button class="btn btn-soft" onclick="openInfinitePayCheckout('${s.id}')">∞ Abrir checkout</button><button class="btn btn-line" onclick="verifyInfinitePayPayment('${s.id}')">Verificar pagamento</button>`:''}${s.payment==='InfinitePay'&&s.status==='Pago'&&ip.receiptUrl?`<button class="btn btn-soft" onclick="openInfinitePayReceipt('${s.id}')">Ver comprovante</button>`:''}${s.status!=='Cancelado'?`<button class="btn btn-line danger-text" onclick="cancelSale('${s.id}')">Cancelar venda</button>`:''}</div>`;}
function viewSale(id){const s=sales.find(x=>x.id===id);if(!s)return;document.getElementById('saleModalTitle').textContent=s.num;document.getElementById('saleModalSubtitle').textContent=`Venda de ${saleClientName(s)}`;document.getElementById('saleModalContent').innerHTML=saleDetailHTML(s);const m=document.getElementById('saleModal');m.classList.add('show');m.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';}
function closeSaleModal(){const m=document.getElementById('saleModal');if(!m)return;m.classList.remove('show');m.setAttribute('aria-hidden','true');document.body.style.overflow='';}
let pendingSaleCancelId='';
function closeSaleCancelConfirm(){const m=document.getElementById('confirmSaleCancelModal');if(m){m.classList.remove('show');m.setAttribute('aria-hidden','true');}pendingSaleCancelId='';}
function closeSaleCancelSuccess(){const m=document.getElementById('saleCancelSuccessModal');if(m){m.classList.remove('show');m.setAttribute('aria-hidden','true');}go('vendas');}
function cancelSale(id){const s=sales.find(x=>x.id===id);if(!s||s.status==='Cancelado')return;pendingSaleCancelId=id;const m=document.getElementById('confirmSaleCancelModal');const summary=document.getElementById('confirmSaleCancelSummary');if(summary)summary.innerHTML=`<strong>${esc(s.num)}</strong> · ${esc(saleClientName(s))} · ${moneyBR(s.total)}`;if(m){m.classList.add('show');m.setAttribute('aria-hidden','false');}}
function executeSaleCancellation(){const s=sales.find(x=>x.id===pendingSaleCancelId);if(!s)return closeSaleCancelConfirm();s.items.forEach(i=>{const p=products.find(x=>x.id===i.productId);if(p&&p.category!=='Serviços'&&!(Number(p.minStock)===0&&Number(p.stock)===0))p.stock=Number(p.stock)+Number(i.qty);});saveProducts();financialTransactions=financialTransactions.filter(t=>!(t.source==='Venda'&&t.sourceId===s.id));saveFinancial();s.status='Cancelado';s.cancelledAt=new Date().toISOString();saveSales();const num=s.num;closeSaleCancelConfirm();closeSaleModal();renderSales();renderProducts();renderStock();renderFinancialSummary();go('vendas');const text=document.getElementById('saleCancelSuccessText');if(text)text.innerHTML=`A venda <strong>${esc(num)}</strong> foi cancelada.`;const success=document.getElementById('saleCancelSuccessModal');if(success){success.classList.add('show');success.setAttribute('aria-hidden','false');}}
function printSale(id){const s=sales.find(x=>x.id===id);if(!s)return;const w=window.open('','_blank');if(!w){toast('O navegador bloqueou a janela de impressão.');return;}w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(s.num)}</title><style>body{font-family:Arial;color:#251d3a;margin:40px}header{display:flex;justify-content:space-between;border-bottom:3px solid #6a20ff;padding-bottom:18px}.brand{font-size:26px;font-weight:900;color:#6a20ff}.muted{color:#777;font-size:12px}table{width:100%;border-collapse:collapse;margin:22px 0}th,td{padding:10px;border-bottom:1px solid #ddd;text-align:left}th{background:#f5f2ff}.total{font-size:20px;text-align:right;margin-top:20px}@media print{body{margin:18mm}}</style></head><body><header><div><div class="brand">MJ ENVELOPAMENTO</div><div class="muted">Qualidade • Estilo • Personalização</div></div><div style="text-align:right"><b>${esc(s.num)}</b><div class="muted">${brDate(s.date)} • ${esc(s.payment)}</div></div></header><h2>COMPROVANTE DE VENDA</h2><p><b>Cliente:</b> ${esc(saleClientName(s))}</p><table><thead><tr><th>Item</th><th>Qtd.</th><th>Unitário</th><th>Total</th></tr></thead><tbody>${(Array.isArray(s.items)?s.items:[]).map(i=>`<tr><td>${esc(i.name)}</td><td>${Number(i.qty).toLocaleString('pt-BR')}</td><td>${moneyBR(i.unitPrice)}</td><td>${moneyBR(Number(i.qty)*Number(i.unitPrice))}</td></tr>`).join('')}</tbody></table><div class="total">Total: <b>${moneyBR(s.total)}</b></div><script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close();}
function renderFinancialSummary(){const month=currentISODate().slice(0,7);const inc=financialTransactions.filter(t=>t.type==='Entrada'&&String(t.date).startsWith(month)).reduce((a,t)=>a+Number(t.value),0);const exp=financialTransactions.filter(t=>t.type==='Saída'&&String(t.date).startsWith(month)).reduce((a,t)=>a+Number(t.value),0);const a=document.getElementById('financeIncome'),b=document.getElementById('financeExpense'),c=document.getElementById('financeBalance');if(a)a.textContent=moneyBR(inc);if(b)b.textContent=moneyBR(exp);if(c)c.textContent=moneyBR(inc-exp);}
function handleSaleTableAction(event){
 const btn=event.target.closest('[data-sale-action][data-sale-id]');
 if(!btn)return;
 const id=btn.dataset.saleId;
 const action=btn.dataset.saleAction;
 if(action==='view')viewSale(id);
 else if(action==='print')printSale(id);
 else if(action==='cancel')cancelSale(id);
}
function initSales(){document.getElementById('salesBody')?.addEventListener('click',handleSaleTableAction);populateSaleClients();populateSaleProducts();document.getElementById('saleDate').value=currentISODate();document.getElementById('saleNumberPreview').textContent=nextSaleNumber();document.getElementById('saleProductSelect')?.addEventListener('change',e=>{const p=products.find(x=>x.id===e.target.value);const input=document.getElementById('saleItemPrice');if(!input)return;input.value=p&&!isVariablePriceProduct(p)?Number(p.price||0).toLocaleString('pt-BR',{minimumFractionDigits:2}):'';input.placeholder=p&&isVariablePriceProduct(p)?'Informe o valor manualmente':'0,00';if(p&&isVariablePriceProduct(p))setTimeout(()=>input.focus(),0);});document.getElementById('addSaleItemBtn')?.addEventListener('click',addSaleItem);document.getElementById('saleDiscount')?.addEventListener('input',saleCalc);document.getElementById('finishSaleBtn')?.addEventListener('click',finishSale);document.getElementById('clearSaleBtn')?.addEventListener('click',()=>clearSaleForm(true));document.getElementById('newSaleBtn')?.addEventListener('click',()=>{clearSaleForm(false);go('nova-venda')});document.getElementById('saleSearch')?.addEventListener('input',renderSales);document.getElementById('saleStatusFilter')?.addEventListener('change',renderSales);document.getElementById('saleDateFilter')?.addEventListener('change',renderSales);document.getElementById('clearSaleFilters')?.addEventListener('click',()=>{document.getElementById('saleSearch').value='';document.getElementById('saleStatusFilter').value='';document.getElementById('saleDateFilter').value='';renderSales();});document.querySelectorAll('[data-close-sale-modal]').forEach(el=>el.addEventListener('click',closeSaleModal));renderSales();if(!loadSaleDraft())renderSaleDraft();renderFinancialSummary();}
window.updateSaleItem=updateSaleItem;window.removeSaleItem=removeSaleItem;window.viewSale=viewSale;window.printSale=printSale;window.cancelSale=cancelSale;window.closeSaleModal=closeSaleModal;window.loadSaleDraft=loadSaleDraft;
initSales();


// =====================================================
// V8 - FINANCEIRO + DESPESAS FUNCIONAIS
// =====================================================
const defaultExpenses=[];
let expenses=JSON.parse(localStorage.getItem('mj_expenses')||'null')||defaultExpenses;
function saveExpenses(){localStorage.setItem('mj_expenses',JSON.stringify(expenses));window.MJCloud?.pushKey('mj_expenses',expenses).catch(err=>console.error('[MJ Cloud] Despesas:',err));}
function financeStatusClass(s){return s==='Pago'?'paid':'pending';}
function txStatus(t){return t.status||'Pago';}
function normalizeFinancialTransactions(){
  financialTransactions=financialTransactions.map((t,i)=>({
    id:t.id||`ft-mig-${Date.now()}-${i}`,type:t.type==='Saída'?'Saída':'Entrada',source:t.source||'Manual',sourceId:t.sourceId||'',description:t.description||'Lançamento',category:t.category||(t.type==='Saída'?'Outros':'Outros'),date:t.date||currentISODate(),dueDate:t.dueDate||t.date||currentISODate(),value:Number(t.value)||0,payment:t.payment||'Outro',status:t.status||'Pago',notes:t.notes||'',createdAt:t.createdAt||new Date().toISOString()
  }));
  // garante que vendas antigas também apareçam no financeiro, inclusive pendentes
  sales.filter(s=>s.status!=='Cancelado').forEach(s=>{
    if(!financialTransactions.some(t=>t.source==='Venda'&&t.sourceId===s.id)){
      financialTransactions.push({id:`ft-sale-${s.id}`,type:'Entrada',source:'Venda',sourceId:s.id,description:`Venda ${s.num} - ${saleClientName(s)}`,category:'Vendas',date:s.date,dueDate:s.date,value:Number(s.total)||0,payment:s.payment||'Outro',status:s.status==='Pago'?'Pago':'Pendente',notes:'Lançamento migrado automaticamente da venda.',createdAt:s.createdAt||new Date().toISOString()});
    }
  });
  saveFinancial();
}
function syncExpenseTransaction(expense){
  financialTransactions=financialTransactions.filter(t=>!(t.source==='Despesa'&&t.sourceId===expense.id));
  financialTransactions.unshift({id:`ft-exp-${expense.id}`,type:'Saída',source:'Despesa',sourceId:expense.id,description:expense.description,category:expense.category,date:expense.date,dueDate:expense.dueDate,value:Number(expense.value)||0,payment:expense.payment||'Outro',status:expense.status,notes:expense.notes||'',createdAt:expense.createdAt||new Date().toISOString()});
  saveFinancial();
}
function syncSaleFromTransaction(t){
  if(t.source!=='Venda'||!t.sourceId)return;
  const s=sales.find(x=>x.id===t.sourceId);if(!s)return;
  s.status=t.status==='Pago'?'Pago':'Pendente';saveSales();renderSales();
}
function syncExpenseFromTransaction(t){
  if(t.source!=='Despesa'||!t.sourceId)return;
  const e=expenses.find(x=>x.id===t.sourceId);if(!e)return;
  e.status=t.status;e.value=Number(t.value)||0;e.payment=t.payment;e.date=t.date;e.dueDate=t.dueDate||t.date;e.description=t.description;e.category=t.category||e.category;e.notes=t.notes||'';saveExpenses();renderExpenses();
}
function isOverdue(date,status){return status==='Pendente'&&date&&date<currentISODate();}
function renderFinancialSummary(){
  const month=currentISODate().slice(0,7);
  const paid=financialTransactions.filter(t=>txStatus(t)==='Pago');
  const incList=paid.filter(t=>t.type==='Entrada'&&String(t.date).startsWith(month));
  const expList=paid.filter(t=>t.type==='Saída'&&String(t.date).startsWith(month));
  const inc=incList.reduce((a,t)=>a+Number(t.value),0),exp=expList.reduce((a,t)=>a+Number(t.value),0),bal=inc-exp;
  const rec=financialTransactions.filter(t=>t.type==='Entrada'&&txStatus(t)==='Pendente');
  const pay=financialTransactions.filter(t=>t.type==='Saída'&&txStatus(t)==='Pendente');
  const set=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val};
  set('financeIncome',moneyBR(inc));set('financeExpense',moneyBR(exp));set('financeBalance',moneyBR(bal));set('financeIncomeCount',`${incList.length} recebimento(s)`);set('financeExpenseCount',`${expList.length} pagamento(s)`);
  set('financeReceivable',moneyBR(rec.reduce((a,t)=>a+Number(t.value),0)));set('financePayable',moneyBR(pay.reduce((a,t)=>a+Number(t.value),0)));set('financeReceivableCount',`${rec.length} pendente(s)`);set('financePayableCount',`${pay.length} pendente(s)`);
  const be=document.getElementById('financeBalance');if(be)be.classList.toggle('negative',bal<0);
  renderFinanceBars();
}
function monthKeyShift(offset){const d=new Date();d.setDate(1);d.setMonth(d.getMonth()+offset);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;}
function monthShort(key){const [y,m]=key.split('-');return new Date(Number(y),Number(m)-1,1).toLocaleDateString('pt-BR',{month:'short'}).replace('.','');}
function renderFinanceBars(){
  const box=document.getElementById('financeBars');if(!box)return;const keys=[-5,-4,-3,-2,-1,0].map(monthKeyShift);
  const vals=keys.map(k=>({k,inc:financialTransactions.filter(t=>t.type==='Entrada'&&txStatus(t)==='Pago'&&String(t.date).startsWith(k)).reduce((s,t)=>s+Number(t.value),0),out:financialTransactions.filter(t=>t.type==='Saída'&&txStatus(t)==='Pago'&&String(t.date).startsWith(k)).reduce((s,t)=>s+Number(t.value),0)}));
  const max=Math.max(1,...vals.flatMap(v=>[v.inc,v.out]));
  box.innerHTML=vals.map(v=>`<div class="finance-month"><div class="finance-month-bars"><div class="finance-bar in" style="height:${Math.max(3,v.inc/max*145)}px" title="Entradas: ${moneyBR(v.inc)}"></div><div class="finance-bar out" style="height:${Math.max(3,v.out/max*145)}px" title="Saídas: ${moneyBR(v.out)}"></div></div><b>${monthShort(v.k)}</b><small>${moneyBR(v.inc)} / ${moneyBR(v.out)}</small></div>`).join('');
  const label=document.getElementById('financePeriodLabel');if(label)label.innerHTML='<span class="finance-legend"><span><i class="lin"></i>Entradas</span><span><i class="lout"></i>Saídas</span></span>';
}
function renderFinance(){
  const body=document.getElementById('financeBody');if(!body)return;
  const q=(document.getElementById('financeSearch')?.value||'').trim().toLowerCase(),type=document.getElementById('financeTypeFilter')?.value||'',status=document.getElementById('financeStatusFilter')?.value||'',month=document.getElementById('financeMonthFilter')?.value||'';
  const list=[...financialTransactions].sort((a,b)=>String(b.date).localeCompare(String(a.date))).filter(t=>{const hay=[t.description,t.source,t.category,t.payment].join(' ').toLowerCase();return(!q||hay.includes(q))&&(!type||t.type===type)&&(!status||txStatus(t)===status)&&(!month||String(t.date).startsWith(month));});
  body.innerHTML=list.map(t=>`<tr><td>${brDate(t.date)}${isOverdue(t.dueDate,txStatus(t))?`<span class="overdue-label">Vencido ${brDate(t.dueDate)}</span>`:(txStatus(t)==='Pendente'&&t.dueDate&&t.dueDate!==t.date?`<span class="due-soon-label">Vence ${brDate(t.dueDate)}</span>`:'')}</td><td><b>${esc(t.description)}</b>${t.category?`<span class="quote-item-code">${esc(t.category)}</span>`:''}</td><td><div class="finance-origin"><b>${esc(t.source)}</b><small>${t.sourceId?'Automático / vinculado':'Manual'}</small></div></td><td><span class="finance-type ${t.type==='Entrada'?'income':'expense'}">${esc(t.type)}</span></td><td><b class="${t.type==='Entrada'?'value-income':'value-expense'}">${t.type==='Entrada'?'+ ':'- '}${moneyBR(t.value)}</b></td><td>${esc(t.payment||'-')}</td><td><span class="status ${financeStatusClass(txStatus(t))}">${esc(txStatus(t))}</span></td><td><div class="quote-actions">${txStatus(t)==='Pendente'?`<button class="table-action success" onclick="markFinancialPaid('${t.id}')">Baixar</button>`:''}<button class="table-action" onclick="editFinancial('${t.id}')">Editar</button>${t.source==='Manual'?`<button class="table-action danger" onclick="deleteFinancial('${t.id}')">Excluir</button>`:''}</div></td></tr>`).join('')||'<tr><td colspan="8"><div class="empty-note">Nenhum lançamento encontrado.</div></td></tr>';
  document.getElementById('financeResultCount').textContent=`${list.length} lançamento(s)`;renderFinancialSummary();renderExpenseStats();
}
function openFinancialForm(t=null){
  const p=document.getElementById('financialFormPanel');p.hidden=false;document.getElementById('financialForm').reset();document.getElementById('financialEditId').value=t?.id||'';document.getElementById('financialFormTitle').textContent=t?'Editar lançamento':'Novo lançamento';document.getElementById('financialType').value=t?.type||'Entrada';document.getElementById('financialStatus').value=t?txStatus(t):'Pago';document.getElementById('financialDate').value=t?.date||currentISODate();document.getElementById('financialDueDate').value=t?.dueDate||t?.date||currentISODate();document.getElementById('financialDescription').value=t?.description||'';document.getElementById('financialCategory').value=t?.category||'';document.getElementById('financialValue').value=t?Number(t.value).toLocaleString('pt-BR',{minimumFractionDigits:2}):'';document.getElementById('financialPayment').value=[...document.getElementById('financialPayment').options].some(o=>o.value===(t?.payment||''))?(t?.payment||'PIX'):'Outro';document.getElementById('financialNotes').value=t?.notes||'';p.scrollIntoView({behavior:'smooth',block:'start'});
}
function closeFinancialForm(){document.getElementById('financialFormPanel').hidden=true;}
function editFinancial(id){const t=financialTransactions.find(x=>x.id===id);if(!t)return;openFinancialForm(t);}
function deleteFinancial(id){const t=financialTransactions.find(x=>x.id===id);if(!t||t.source!=='Manual')return;if(!confirm('Excluir este lançamento manual?'))return;financialTransactions=financialTransactions.filter(x=>x.id!==id);saveFinancial();renderFinance();toast('Lançamento excluído.');}
function markFinancialPaid(id){const t=financialTransactions.find(x=>x.id===id);if(!t)return;t.status='Pago';t.paidAt=currentISODate();saveFinancial();syncSaleFromTransaction(t);syncExpenseFromTransaction(t);renderFinance();toast('Lançamento marcado como pago.');}
function renderExpenseCategories(){const s=document.getElementById('expenseCategoryFilter');if(!s)return;const cur=s.value;const cats=[...new Set(expenses.map(e=>e.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));s.innerHTML='<option value="">Todas as categorias</option>'+cats.map(c=>`<option>${esc(c)}</option>`).join('');s.value=cats.includes(cur)?cur:'';}
function renderExpenseStats(){
  const month=currentISODate().slice(0,7),paid=expenses.filter(e=>e.status==='Pago'&&String(e.date).startsWith(month)),pending=expenses.filter(e=>e.status==='Pendente'),overdue=pending.filter(e=>isOverdue(e.dueDate,e.status));
  const set=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val};set('expensePaidMonth',moneyBR(paid.reduce((s,e)=>s+Number(e.value),0)));set('expensePendingValue',moneyBR(pending.reduce((s,e)=>s+Number(e.value),0)));set('expenseOverdueCount',overdue.length);set('expenseTotalCount',expenses.length);
  // atualiza card de despesas do dashboard com as saídas pagas de hoje
  const dash=document.querySelector('#dashboard .metric:nth-child(4) strong');if(dash){const today=expenses.filter(e=>e.status==='Pago'&&e.date===currentISODate()).reduce((s,e)=>s+Number(e.value),0);dash.textContent=moneyBR(today);}
}
function renderExpenses(){
  const body=document.getElementById('expensesBody');if(!body)return;renderExpenseCategories();const q=(document.getElementById('expenseSearch')?.value||'').toLowerCase().trim(),status=document.getElementById('expenseStatusFilter')?.value||'',cat=document.getElementById('expenseCategoryFilter')?.value||'',month=document.getElementById('expenseMonthFilter')?.value||'';
  const list=[...expenses].sort((a,b)=>String(b.date).localeCompare(String(a.date))).filter(e=>{const hay=[e.description,e.category,e.supplier,e.payment].join(' ').toLowerCase();return(!q||hay.includes(q))&&(!status||e.status===status)&&(!cat||e.category===cat)&&(!month||String(e.date).startsWith(month));});
  body.innerHTML=list.map(e=>`<tr><td>${brDate(e.date)}</td><td>${brDate(e.dueDate)}${isOverdue(e.dueDate,e.status)?'<span class="overdue-label">VENCIDA</span>':''}</td><td><b>${esc(e.description)}</b>${e.payment?`<span class="quote-item-code">${esc(e.payment)}</span>`:''}</td><td>${esc(e.category)}</td><td>${esc(e.supplier||'-')}</td><td><b>${moneyBR(e.value)}</b></td><td><span class="status ${financeStatusClass(e.status)}">${esc(e.status)}</span></td><td><div class="quote-actions">${e.status==='Pendente'?`<button class="table-action success" onclick="markExpensePaid('${e.id}')">Pagar</button>`:''}<button class="table-action" onclick="editExpense('${e.id}')">Editar</button><button class="table-action danger" onclick="deleteExpense('${e.id}')">Excluir</button></div></td></tr>`).join('')||'<tr><td colspan="8"><div class="empty-note">Nenhuma despesa encontrada.</div></td></tr>';
  document.getElementById('expenseResultCount').textContent=`${list.length} despesa(s)`;renderExpenseStats();
}
function openExpenseForm(e=null){const p=document.getElementById('expenseFormPanel');p.hidden=false;document.getElementById('expenseForm').reset();document.getElementById('expenseEditId').value=e?.id||'';document.getElementById('expenseFormTitle').textContent=e?'Editar despesa':'Registrar despesa';document.getElementById('expenseDate').value=e?.date||currentISODate();document.getElementById('expenseDueDate').value=e?.dueDate||currentISODate();document.getElementById('expenseStatus').value=e?.status||'Pago';document.getElementById('expenseValue').value=e?Number(e.value).toLocaleString('pt-BR',{minimumFractionDigits:2}):'';document.getElementById('expenseDescription').value=e?.description||'';document.getElementById('expenseCategory').value=e?.category||'Operacional';document.getElementById('expensePayment').value=[...document.getElementById('expensePayment').options].some(o=>o.value===(e?.payment||''))?(e?.payment||'PIX'):'Outro';document.getElementById('expenseSupplier').value=e?.supplier||'';document.getElementById('expenseNotes').value=e?.notes||'';p.scrollIntoView({behavior:'smooth',block:'start'});}
function closeExpenseForm(){document.getElementById('expenseFormPanel').hidden=true;}
function editExpense(id){const e=expenses.find(x=>x.id===id);if(e)openExpenseForm(e);}
function deleteExpense(id){const e=expenses.find(x=>x.id===id);if(!e)return;if(!confirm(`Excluir a despesa “${e.description}”?`))return;expenses=expenses.filter(x=>x.id!==id);financialTransactions=financialTransactions.filter(t=>!(t.source==='Despesa'&&t.sourceId===id));saveExpenses();saveFinancial();renderExpenses();renderFinance();toast('Despesa excluída.');}
function markExpensePaid(id){const e=expenses.find(x=>x.id===id);if(!e)return;e.status='Pago';saveExpenses();syncExpenseTransaction(e);renderExpenses();renderFinance();toast('Despesa marcada como paga.');}
function initFinanceV8(){
  normalizeFinancialTransactions();renderFinance();renderExpenses();
  document.getElementById('newFinancialBtn')?.addEventListener('click',()=>openFinancialForm());document.getElementById('closeFinancialBtn')?.addEventListener('click',closeFinancialForm);document.getElementById('cancelFinancialBtn')?.addEventListener('click',closeFinancialForm);
  ['financeSearch','financeTypeFilter','financeStatusFilter','financeMonthFilter'].forEach(id=>document.getElementById(id)?.addEventListener(id==='financeSearch'?'input':'change',renderFinance));document.getElementById('clearFinanceFilters')?.addEventListener('click',()=>{document.getElementById('financeSearch').value='';document.getElementById('financeTypeFilter').value='';document.getElementById('financeStatusFilter').value='';document.getElementById('financeMonthFilter').value='';renderFinance();});
  document.getElementById('financialForm')?.addEventListener('submit',ev=>{ev.preventDefault();const id=document.getElementById('financialEditId').value,old=id?financialTransactions.find(t=>t.id===id):null;const value=parseMoneyBR(document.getElementById('financialValue').value),description=document.getElementById('financialDescription').value.trim();if(!description||value<=0){toast('Informe a descrição e um valor maior que zero.');return;}const item={id:id||`ft${Date.now()}`,type:document.getElementById('financialType').value,source:old?.source||'Manual',sourceId:old?.sourceId||'',description,category:document.getElementById('financialCategory').value.trim()||'Outros',date:document.getElementById('financialDate').value||currentISODate(),dueDate:document.getElementById('financialDueDate').value||document.getElementById('financialDate').value||currentISODate(),value,payment:document.getElementById('financialPayment').value,status:document.getElementById('financialStatus').value,notes:document.getElementById('financialNotes').value.trim(),createdAt:old?.createdAt||new Date().toISOString()};if(id)financialTransactions=financialTransactions.map(t=>t.id===id?item:t);else financialTransactions.unshift(item);saveFinancial();syncSaleFromTransaction(item);syncExpenseFromTransaction(item);closeFinancialForm();renderFinance();toast(id?'Lançamento atualizado.':'Lançamento cadastrado.');});
  document.getElementById('newExpenseBtn')?.addEventListener('click',()=>openExpenseForm());document.getElementById('closeExpenseBtn')?.addEventListener('click',closeExpenseForm);document.getElementById('cancelExpenseBtn')?.addEventListener('click',closeExpenseForm);
  ['expenseSearch','expenseStatusFilter','expenseCategoryFilter','expenseMonthFilter'].forEach(id=>document.getElementById(id)?.addEventListener(id==='expenseSearch'?'input':'change',renderExpenses));document.getElementById('clearExpenseFilters')?.addEventListener('click',()=>{document.getElementById('expenseSearch').value='';document.getElementById('expenseStatusFilter').value='';document.getElementById('expenseCategoryFilter').value='';document.getElementById('expenseMonthFilter').value='';renderExpenses();});
  document.getElementById('expenseForm')?.addEventListener('submit',ev=>{ev.preventDefault();const id=document.getElementById('expenseEditId').value,old=id?expenses.find(e=>e.id===id):null;const value=parseMoneyBR(document.getElementById('expenseValue').value),description=document.getElementById('expenseDescription').value.trim();if(!description||value<=0){toast('Informe a descrição e um valor maior que zero.');return;}const item={id:id||`ex${Date.now()}`,date:document.getElementById('expenseDate').value||currentISODate(),dueDate:document.getElementById('expenseDueDate').value||currentISODate(),status:document.getElementById('expenseStatus').value,value,description,category:document.getElementById('expenseCategory').value,payment:document.getElementById('expensePayment').value,supplier:document.getElementById('expenseSupplier').value.trim(),notes:document.getElementById('expenseNotes').value.trim(),createdAt:old?.createdAt||new Date().toISOString()};if(id)expenses=expenses.map(e=>e.id===id?item:e);else expenses.unshift(item);saveExpenses();syncExpenseTransaction(item);closeExpenseForm();renderExpenses();renderFinance();toast(id?'Despesa atualizada.':'Despesa registrada.');});
}
window.editFinancial=editFinancial;window.deleteFinancial=deleteFinancial;window.markFinancialPaid=markFinancialPaid;window.editExpense=editExpense;window.deleteExpense=deleteExpense;window.markExpensePaid=markExpensePaid;
initFinanceV8();


initInfinitePayV9();

// V11.5 cancelamento visual
document.addEventListener('click',e=>{if(e.target.closest('[data-cancel-sale-dismiss]'))closeSaleCancelConfirm();if(e.target.closest('[data-sale-success-dismiss]'))closeSaleCancelSuccess();if(e.target.closest('#confirmSaleCancelBtn'))executeSaleCancellation();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeSaleCancelConfirm();closeSaleCancelSuccess();}});

// V11.12 - Dashboard e estoque exibem somente dados reais do Google Sheets/cache.
try{renderDashboardLowStock();renderDashboardLiveData();}catch(e){console.warn('[MJ V11.12] Dashboard inicial:',e);}
