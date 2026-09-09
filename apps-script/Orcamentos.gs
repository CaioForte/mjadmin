/** MJ ADMIN V11 - Orçamentos */
function salvarOrcamento_(orcamento){
  if(!orcamento.id) throw new Error('Orçamento sem ID.');
  if(!orcamento.clientId) throw new Error('Selecione o cliente do orçamento.');
  if(!arr_(orcamento.items).length) throw new Error('O orçamento precisa ter ao menos um item.');
  return withLock_(function(){
    upsertObject_('Orcamentos',orcamento);
    replaceItemsForParent_('OrcamentosItens',orcamento.id,'orcamentoId',orcamento.items);
    log_('salvarOrcamento',orcamento.id,orcamento.num||'');
    return orcamento;
  });
}
function excluirOrcamento_(id){ if(!id)throw new Error('ID do orçamento não informado.'); return withLock_(function(){ deleteObject_('Orcamentos',id); replaceItemsForParent_('OrcamentosItens',id,'orcamentoId',[]); log_('excluirOrcamento',id,''); }); }
function converterOrcamento_(id,saleId){ const q=readObjects_('Orcamentos').find(x=>String(x.id)===String(id)); if(!q)throw new Error('Orçamento não encontrado.'); q.status='Convertido'; q.convertedAt=nowIso_(); if(saleId)q.saleId=saleId; upsertObject_('Orcamentos',q); return q; }
