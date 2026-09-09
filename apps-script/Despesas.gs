/** MJ ADMIN V11 - Despesas */
function salvarDespesa_(despesa){
  if(!despesa.id)despesa.id=uid_('ex');
  return withLock_(function(){
    upsertObject_('Despesas',despesa);
    const all=readObjects_('Financeiro'), idx=all.findIndex(f=>f.source==='Despesa'&&String(f.sourceId)===String(despesa.id));
    const ft={id:idx>=0?all[idx].id:uid_('ft'),type:'Saida',source:'Despesa',sourceId:despesa.id,description:despesa.description,category:despesa.category||'Operacional',date:despesa.date||todayIso_(),dueDate:despesa.dueDate||despesa.date||todayIso_(),value:num_(despesa.value),payment:despesa.payment||'Outro',status:despesa.status||'Pendente',notes:despesa.notes||'',createdAt:idx>=0?all[idx].createdAt:nowIso_(),paidAt:despesa.status==='Pago'?todayIso_():''};
    if(idx>=0)all[idx]=ft;else all.unshift(ft); writeObjects_('Financeiro',all); log_('salvarDespesa',despesa.id,despesa.description||''); return {despesa:despesa,financeiro:ft};
  });
}
function excluirDespesa_(id){ return withLock_(function(){ deleteObject_('Despesas',id); writeObjects_('Financeiro',readObjects_('Financeiro').filter(f=>!(f.source==='Despesa'&&String(f.sourceId)===String(id)))); log_('excluirDespesa',id,''); }); }
function marcarDespesaPaga_(id){ const d=readObjects_('Despesas').find(x=>String(x.id)===String(id)); if(!d)throw new Error('Despesa não encontrada.'); d.status='Pago'; return salvarDespesa_(d); }
